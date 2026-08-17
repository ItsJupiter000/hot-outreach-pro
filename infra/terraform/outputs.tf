output "ecr_repository_url" {
  description = "Set this as the GitHub Actions variable ECR_REPOSITORY."
  value       = aws_ecr_repository.app.repository_url
}

output "github_actions_role_arn" {
  description = "Set this as the GitHub Actions variable AWS_ROLE_ARN."
  value       = aws_iam_role.github_actions.arn
}

output "aws_region" {
  value = var.aws_region
}

# Printed after apply so the GitHub side is a copy-paste, not a hunt through the
# console.
output "next_steps" {
  value = <<-EOT

    Configure the repo with the gh CLI (or Settings > Secrets and variables > Actions > Variables):

      gh variable set AWS_ROLE_ARN     --body "${aws_iam_role.github_actions.arn}"
      gh variable set ECR_REPOSITORY   --body "${aws_ecr_repository.app.repository_url}"
      gh variable set AWS_REGION       --body "${var.aws_region}"

    These are VARIABLES, not secrets -- none of them is sensitive. A role ARN is
    useless without a matching OIDC token, which is the whole point of OIDC.

    The two build-time Supabase values ARE needed at build time and must be set
    too (URL and anon key are public by design, but keep them as secrets so they
    are masked in logs):

      gh secret set NEXT_PUBLIC_SUPABASE_URL
      gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY

    WARNING: your .env has Windows CRLF line endings, so piping values from it
    will carry a trailing \\r into the secret. Use `tr -d '\\r'` or type them in.
  EOT
}
