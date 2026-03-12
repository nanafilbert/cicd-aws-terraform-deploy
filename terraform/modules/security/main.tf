variable "app_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "ssh_cidr" { type = string }

# ALB Security Group — public HTTP/HTTPS traffic
resource "aws_security_group" "alb" {
  name        = "${var.app_name}-sg-alb"
  description = "Allow inbound HTTP/HTTPS to the load balancer"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.app_name}-sg-alb", Environment = var.environment }
}

# App Security Group — only allow traffic from ALB + SSH from your IP
resource "aws_security_group" "app" {
  name        = "${var.app_name}-sg-app"
  description = "Allow traffic from ALB and restricted SSH"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "HTTP from ALB only"
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
    description = "SSH from trusted IP only"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.app_name}-sg-app", Environment = var.environment }
}

output "alb_sg_id" { value = aws_security_group.alb.id }
output "app_sg_id" { value = aws_security_group.app.id }
