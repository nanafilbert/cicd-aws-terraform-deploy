variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name — used for naming AWS resources"
  type        = string
  default     = "cicd-aws-terraform-deploy"
}

variable "github_repo" {
  description = "GitHub repo in the format owner/cicd-aws-terraform-deploy"
  type        = string
}

variable "state_bucket_name" {
  description = "S3 bucket name for Terraform remote state (must be globally unique)"
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name for Terraform state locking"
  type        = string
  default     = "terraform-state-lock"
}

variable "create_oidc_provider" {
  description = "Set to false if the GitHub OIDC provider already exists in your AWS account"
  type        = bool
  default     = true
}
