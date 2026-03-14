output "terraform_state_bucket" {
  description = "GCS bucket name for Terraform state"
  value       = google_storage_bucket.terraform_state.name
}

output "workload_identity_provider" {
  description = "Workload Identity Provider resource name (for GitHub Actions)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "Service account email for GitHub Actions"
  value       = google_service_account.github_actions.email
}

output "github_actions_variables" {
  description = "Values to set as GitHub Actions variables"
  value = {
    TF_STATE_BUCKET     = google_storage_bucket.terraform_state.name
    WIF_PROVIDER        = google_iam_workload_identity_pool_provider.github.name
    WIF_SERVICE_ACCOUNT = google_service_account.github_actions.email
    GCP_PROJECT         = var.gcp_project
  }
}
