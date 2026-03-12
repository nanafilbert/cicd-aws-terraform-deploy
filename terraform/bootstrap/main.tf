terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # No remote backend here — this runs locally just once
  # State file will be created in this folder as terraform.tfstate
}

provider "aws" {
  region = var.aws_region
}

# ── 1. S3 Bucket for Terraform Remote State ───────────────────
resource "aws_s3_bucket" "tfstate" {
  bucket        = var.state_bucket_name
  force_destroy = false

  tags = {
    Name      = "Terraform Remote State"
    ManagedBy = "terraform-bootstrap"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"  # Keeps history of every state file — lets you roll back
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── 2. DynamoDB Table for State Locking ───────────────────────
resource "aws_dynamodb_table" "tfstate_lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name      = "Terraform State Lock"
    ManagedBy = "terraform-bootstrap"
  }
}

# ── 3. GitHub OIDC Identity Provider ─────────────────────────
# Tells AWS to trust tokens issued by GitHub Actions
data "aws_iam_openid_connect_provider" "github" {
  # Check if it already exists before creating
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1",
                     "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = {
    Name      = "GitHub Actions OIDC Provider"
    ManagedBy = "terraform-bootstrap"
  }
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? (
    aws_iam_openid_connect_provider.github[0].arn
  ) : (
    data.aws_iam_openid_connect_provider.github[0].arn
  )
}

# ── 4. IAM Role for GitHub Actions ───────────────────────────
resource "aws_iam_role" "github_actions" {
  name        = "${var.project_name}-github-actions-role"
  description = "Assumed by GitHub Actions via OIDC for ${var.github_repo}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = local.oidc_provider_arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Only YOUR repo can assume this role — not any GitHub repo
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name      = "GitHub Actions Role"
    ManagedBy = "terraform-bootstrap"
    Repo      = var.github_repo
  }
}

# ── 5. IAM Policy — Least Privilege ──────────────────────────
# Only the permissions the pipeline actually needs
resource "aws_iam_policy" "github_actions" {
  name        = "${var.project_name}-github-actions-policy"
  description = "Least-privilege policy for the CI/CD pipeline"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # EC2 + Auto Scaling + Launch Templates
      {
        Effect = "Allow"
        Action = [
          "ec2:*",
          "autoscaling:*",
          "elasticloadbalancing:*"
        ]
        Resource = "*"
      },
      # VPC + Networking
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateVpc", "ec2:DeleteVpc",
          "ec2:CreateSubnet", "ec2:DeleteSubnet",
          "ec2:CreateInternetGateway", "ec2:DeleteInternetGateway",
          "ec2:CreateRouteTable", "ec2:DeleteRouteTable",
          "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
          "ec2:CreateTags", "ec2:DescribeTags",
          "ec2:AllocateAddress", "ec2:ReleaseAddress",
          "ec2:AssociateAddress", "ec2:DisassociateAddress",
          "ec2:DescribeVpcs", "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups", "ec2:DescribeInternetGateways",
          "ec2:DescribeRouteTables", "ec2:DescribeAddresses",
          "ec2:DescribeInstances", "ec2:DescribeImages",
          "ec2:DescribeKeyPairs", "ec2:DescribeAvailabilityZones",
          "ec2:DescribeAccountAttributes", "ec2:DescribeNetworkInterfaces",
          "ec2:ModifyVpcAttribute", "ec2:AssociateRouteTable",
          "ec2:DisassociateRouteTable", "ec2:CreateRoute", "ec2:DeleteRoute",
          "ec2:AttachInternetGateway", "ec2:DetachInternetGateway"
        ]
        Resource = "*"
      },
      # IAM (for EC2 instance profile)
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole",
          "iam:GetRole", "iam:ListRoles",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy",
          "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile", "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile",
          "iam:PassRole", "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies", "iam:TagRole", "iam:UntagRole",
          "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy",
          "iam:GetPolicyVersion",
           "iam:ListPolicyVersions",
          "iam:TagInstanceProfile",
          "iam:CreateServiceLinkedRole"
        ]
        Resource = "*"
      },
      # S3 (Terraform state only)
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject", "s3:PutObject",
          "s3:DeleteObject", "s3:ListBucket",
          "s3:GetBucketVersioning", "s3:GetBucketAcl",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::${var.state_bucket_name}",
          "arn:aws:s3:::${var.state_bucket_name}/*"
        ]
      },
      # DynamoDB (state locking)
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem",
          "dynamodb:DeleteItem", "dynamodb:DescribeTable"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/${var.lock_table_name}"
      },
      # SSM (for EC2 Session Manager access)
      {
        Effect   = "Allow"
        Action   = ["ssm:*"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions.arn
}
