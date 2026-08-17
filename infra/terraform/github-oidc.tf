# ─────────────────────────────────────────────────────────────────────────────
# GitHub Actions → AWS via OIDC federation.
#
# THE ALTERNATIVE, AND WHY IT LOSES
# Store an AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY pair in GitHub secrets. It
# works, and it is what most tutorials do. The problems:
#   - The credential is long-lived. It is valid until someone remembers to rotate
#     it, which is never.
#   - It exists in two places (AWS + GitHub), so it can leak from either.
#   - Anyone with repo admin can exfiltrate it via a workflow change.
#   - Rotating it means coordinating an AWS change with a GitHub change.
#
# With OIDC, GitHub mints a short-lived JWT describing *which repo and which ref*
# is running. AWS validates that JWT against the trust policy below and issues
# temporary credentials that expire in an hour. There is no secret to leak, and
# nothing to rotate.
# ─────────────────────────────────────────────────────────────────────────────

# AWS requires a thumbprint even though it no longer verifies it for GitHub's
# well-known endpoint. Fetching it dynamically means a GitHub certificate
# rotation does not require a hardcoded-hash update in this file.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    # BOTH conditions are required.
    #
    # Without the `aud` check, a token minted for a different audience could be
    # replayed. Without the `sub` check, ANY GitHub repository in the world could
    # assume this role -- the OIDC provider is GitHub-wide, not repo-specific.
    # Omitting `sub` is the single most common and most serious mistake in OIDC
    # setups.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.github_allowed_refs
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-github-actions"
  description        = "Assumed by GitHub Actions via OIDC to push images to ECR"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json

  # 1 hour. Long enough for a build, short enough that a leaked token is
  # near-worthless.
  max_session_duration = 3600
}

data "aws_iam_policy_document" "ecr_push" {
  # GetAuthorizationToken cannot be resource-scoped -- the API is account-level,
  # so `*` here is required rather than lazy. It only returns a token; the actual
  # push permissions below are what matter.
  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Scoped to this one repository. No ecr:*, no wildcard resource. If the CI role
  # is ever compromised, the blast radius is "can push images to one repo".
  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages",
    ]
    resources = [aws_ecr_repository.app.arn]
  }
}

resource "aws_iam_role_policy" "ecr_push" {
  name   = "ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ecr_push.json
}
