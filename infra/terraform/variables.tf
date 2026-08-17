variable "aws_region" {
  description = "AWS region. Mumbai: same region as the existing EC2 instance, so there is no cross-region data transfer during cutover."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "hot-outreach"
}

variable "github_owner" {
  description = "GitHub org/user that owns the repo."
  type        = string
  default     = "ItsJupiter000"
}

variable "github_repo" {
  description = "Repository name. NOTE the upstream typo: the remote is 'hot-outreact-pro' (react, not reach). The OIDC trust policy must match the ACTUAL repo name or every CI auth attempt fails with a confusing AccessDenied."
  type        = string
  default     = "hot-outreact-pro"
}

variable "github_allowed_refs" {
  description = <<-EOT
    Which git refs may assume the CI role.

    Scoped deliberately tightly. The `sub` claim on a GitHub OIDC token encodes
    the repo AND the ref, so restricting it here means a workflow running on a
    fork or an untrusted branch cannot obtain AWS credentials -- even though the
    workflow file itself is identical.

    A common mistake is `repo:owner/name:*`, which permits ANY ref including
    pull_request from forks. That is how OIDC setups get compromised.
  EOT
  type        = list(string)
  default     = ["repo:ItsJupiter000/hot-outreact-pro:ref:refs/heads/main"]
}

variable "image_retention_count" {
  description = "How many tagged images to keep in ECR before expiring the oldest."
  type        = number
  default     = 20
}
