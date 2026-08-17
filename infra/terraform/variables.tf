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
  description = <<-EOT
    Repository name AS GITHUB CURRENTLY KNOWS IT -- not necessarily what your git
    remote says.

    This cost an hour. The local remote is
    https://github.com/ItsJupiter000/hot-outreact-pro.git (note: "outreact"), but
    the repo was renamed to "hot-outreach-pro". GitHub permanently redirects the
    old URL, so `git push` and `git fetch` keep working against the stale name --
    while the OIDC token always carries the CURRENT name. The trust policy was
    therefore matching a repo that no longer exists, and STS returned only
    "Not authorized to perform sts:AssumeRoleWithWebIdentity" with no hint why.

    To find the real value, read the `sub` claim out of CloudTrail (AWS records it
    in the Username field for AssumeRoleWithWebIdentity):

      aws cloudtrail lookup-events --region ap-south-1 \
        --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
        --max-results 5 --query 'Events[].{time:EventTime,user:Username}' --output table
  EOT
  type        = string
  default     = "hot-outreach-pro"
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
  type = list(string)

  # Exact match, no wildcard -- confirmed against the real `sub` claim observed in
  # CloudTrail. Deliberately NOT "repo:owner/name:*", which would let any ref in
  # the repository (including a pull_request from a fork) obtain AWS credentials.
  default = ["repo:ItsJupiter000/hot-outreach-pro:ref:refs/heads/main"]
}

variable "image_retention_count" {
  description = "How many tagged images to keep in ECR before expiring the oldest."
  type        = number
  default     = 20
}
