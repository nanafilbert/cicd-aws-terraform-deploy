variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Project name — used for naming AWS resources"
  type        = string
  default     = "cicd-aws-terraform-deploy"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "key_pair_name" {
  description = "Name of the AWS key pair for SSH access"
  type        = string
}

variable "ssh_cidr" {
  description = "Your IP in CIDR notation for SSH access e.g. 1.2.3.4/32"
  type        = string
  default     = "154.161.5.230/32"
}

variable "dockerhub_username" {
  description = "Docker Hub username to pull image from"
  type        = string
}

variable "app_version" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "github_owner" {
  description = "Your GitHub username"
  type        = string
  default     = "nanafilbert/cicd-aws-terraform-deploy"
}