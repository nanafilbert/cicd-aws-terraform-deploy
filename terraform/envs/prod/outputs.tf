output "app_url" {
  description = "Public URL of the application (via ALB)"
  value       = "http://${module.compute.alb_dns_name}"
}

output "health_check_url" {
  description = "Health check readiness endpoint"
  value       = "http://${module.compute.alb_dns_name}/health/ready"
}

output "alb_dns_name" {
  description = "ALB DNS name (point your domain's CNAME here)"
  value       = module.compute.alb_dns_name
}
