output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.only_facts.name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint (private)"
  value       = google_container_cluster.only_facts.endpoint
  sensitive   = true
}

output "load_balancer_ip" {
  description = "Internal load balancer IP"
  value       = kubernetes_service.only_facts.status[0].load_balancer[0].ingress[0].ip
}

output "artifact_registry_url" {
  description = "Container image registry URL"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/${google_artifact_registry_repository.only_facts.repository_id}"
}

output "service_account_email" {
  description = "GKE workload identity service account email"
  value       = google_service_account.gke_workload.email
}
