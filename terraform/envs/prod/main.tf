terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }

  backend "s3" {
    bucket         = "cicd-aws-terraform-deploy-tfstate-filbert"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "cicd-aws-terraform-deploy"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "github.com/${var.github_owner}/cicd-aws-terraform-deploy"
    }
  }
}

# ── Networking ─────────────────────────────────────────────────
module "networking" {
  source = "../../modules/networking"

  app_name           = var.app_name
  environment        = var.environment
  vpc_cidr           = "10.0.0.0/16"
  public_subnets     = ["10.0.1.0/24", "10.0.2.0/24"]
  availability_zones = ["${var.aws_region}a", "${var.aws_region}b"]
}

# ── Security ───────────────────────────────────────────────────
module "security" {
  source = "../../modules/security"

  app_name    = var.app_name
  environment = var.environment
  vpc_id      = module.networking.vpc_id
  ssh_cidr    = var.ssh_cidr
}

# ── Compute ────────────────────────────────────────────────────
module "compute" {
  source = "../../modules/compute"

  app_name           = var.app_name
  environment        = var.environment
  instance_type      = var.instance_type
  key_pair_name      = var.key_pair_name
  subnet_ids         = module.networking.public_subnet_ids
  app_sg_id          = module.security.app_sg_id
  alb_sg_id          = module.security.alb_sg_id
  vpc_id             = module.networking.vpc_id
  dockerhub_username = var.dockerhub_username
  app_version        = var.app_version
  min_size           = 1
  max_size           = 3
  desired_capacity   = 1
  certificate_arn = "arn:aws:acm:us-east-1:234506497205:certificate/0311de9d-fc07-4c96-9715-b4c04a2e0d48"
}


