variable "aws_region" { type = string; default = "us-east-1" }
variable "app_name" { type = string; default = "cicd-aws-terraform-deploy-tfstate-filbert" }
variable "environment" { type = string; default = "production" }
variable "instance_type" { type = string; default = "t3.small" }
variable "key_pair_name" { type = string }
variable "ssh_cidr" { type = string; default = "0.0.0.0/0"; description = "154.161.5.230/32" }
variable "dockerhub_username" { type = string}
variable "app_version" { type = string; default = "latest" }
variable "github_owner" { type = string; default = "nanafilbert" }
