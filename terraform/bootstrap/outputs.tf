output "role_arn" {
  description = "Copy this value into GitHub Secrets as AWS_ROLE_ARN"
  value       = aws_iam_role.github_actions.arn
}

output "state_bucket_name" {
  description = "Update terraform/envs/prod/main.tf backend block with this bucket name"
  value       = aws_s3_bucket.tfstate.bucket
}

output "lock_table_name" {
  description = "Update terraform/envs/prod/main.tf backend block with this table name"
  value       = aws_dynamodb_table.tfstate_lock.name
}

output "next_steps" {
  description = "What to do after this apply"
  value       = <<-EOT

    ✅ Bootstrap complete! Here's what to do next:

    1. Add this to GitHub Secrets as AWS_ROLE_ARN:
       ${aws_iam_role.github_actions.arn}

    2. Update terraform/envs/prod/main.tf backend block:
       bucket         = "${aws_s3_bucket.tfstate.bucket}"
       dynamodb_table = "${aws_dynamodb_table.tfstate_lock.name}"

    3. Push to main — the pipeline will take it from there.
  EOT
}
