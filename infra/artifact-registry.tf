resource "google_artifact_registry_repository" "only_facts" {
  location      = var.gcp_region
  repository_id = "only-facts"
  description   = "Docker repository for only-facts application"
  format        = "DOCKER"
  project       = var.gcp_project

  labels = {
    environment = var.environment
    app         = "only-facts"
  }
}
