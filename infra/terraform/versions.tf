terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Remote state. Created by ../bootstrap-state.sh before the first `init`,
  # because Terraform cannot create the bucket that holds its own state.
  #
  # Why remote at all, for a solo project: the state file is the only record of
  # what exists. Lose it and Terraform no longer knows about your EKS cluster,
  # so `apply` tries to create a second one and `destroy` cannot clean up the
  # first. S3 gives versioning (recover a corrupted state) and DynamoDB gives
  # locking (no concurrent applies from your laptop and CI).
  #
  # NOTE: state contains secrets in plaintext -- which is why *.tfstate is in
  # .gitignore and the bucket is encrypted and private.
  backend "s3" {
    bucket         = "hot-outreach-tfstate-984174955350"
    key            = "platform/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "hot-outreach-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "hot-outreach"
      ManagedBy = "terraform"
    }
  }
}
