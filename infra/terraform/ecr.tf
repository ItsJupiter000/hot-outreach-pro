resource "aws_ecr_repository" "app" {
  name = var.project

  # IMMUTABLE is the important setting here.
  #
  # With MUTABLE tags, someone can push a different image over an existing tag.
  # That breaks the core GitOps guarantee: "the cluster runs the image named in
  # git" stops being verifiable, and a rollback to an older tag might fetch
  # something other than what that tag pointed to when it was deployed.
  #
  # It also makes the deploy non-reproducible in exactly the way the current
  # `git pull && npm run build` flow is non-reproducible -- which is the problem
  # we are here to solve.
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    # Free, and it keeps scanning AFTER the push -- so a CVE disclosed next month
    # against an image you already shipped still surfaces. CI-time scanning
    # (Trivy) only knows what was public on build day.
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  # Every push is a new immutable tag, so without expiry this grows forever at
  # ~$0.10/GB-month. Two rules, and order matters: rules run by priority and the
  # first match wins.
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day (build leftovers, failed pushes)"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the most recent ${var.image_retention_count} tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = var.image_retention_count
        }
        action = { type = "expire" }
      },
    ]
  })
}
