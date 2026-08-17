#!/usr/bin/env bash
# Create the S3 bucket + DynamoDB table that hold Terraform's remote state.
#
# This exists as a script rather than Terraform because of a genuine chicken-and-
# egg problem: Terraform cannot create the bucket that stores its own state. The
# standard solve is a tiny imperative bootstrap, run once.
#
# Idempotent — safe to re-run.
#
# These two resources are DELIBERATELY EXCLUDED from `terraform destroy`. When you
# tear the cluster down nightly to save money, the state must survive, or
# Terraform forgets what exists and can neither recreate nor clean up.

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="hot-outreach-tfstate-${ACCOUNT_ID}"
TABLE="hot-outreach-tflock"

echo "Account : ${ACCOUNT_ID}"
echo "Region  : ${REGION}"
echo "Bucket  : ${BUCKET}"
echo "Table   : ${TABLE}"
echo

# ── S3 bucket ────────────────────────────────────────────────────────────────
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "✓ bucket already exists"
else
  echo "creating bucket..."
  # Every region EXCEPT us-east-1 requires LocationConstraint. ap-south-1 does.
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}"
fi

# Versioning is the safety net that matters: it lets you recover a previous state
# file after a corrupted or partial apply. Without it, a bad write is terminal.
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

# State contains every managed secret in plaintext. This bucket must never be
# public, regardless of account-level settings.
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "✓ bucket configured (versioned, encrypted, private)"

# ── DynamoDB lock table ──────────────────────────────────────────────────────
# Prevents two applies running at once. Matters even solo: your laptop and a CI
# job racing on the same state produces a corrupted state file, which is the
# worst failure mode Terraform has.
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "✓ lock table already exists"
else
  echo "creating lock table..."
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}" >/dev/null
  aws dynamodb wait table-exists --table-name "${TABLE}" --region "${REGION}"
  echo "✓ lock table created"
fi

echo
echo "Done. Cost: a few cents/month (state is KBs; DynamoDB is pay-per-request)."
echo
echo "Next:"
echo "  cd infra/terraform && terraform init && terraform apply"
