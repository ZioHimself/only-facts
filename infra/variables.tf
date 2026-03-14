variable "environment" {
  description = "Deployment environment (e.g., prod, staging)"
  type        = string
}

variable "gcp_project" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "app_port" {
  description = "Application container port"
  type        = number
  default     = 3000
}

variable "mongo_uri" {
  description = "External MongoDB connection string (optional - leave empty to use internal MongoDB)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "use_internal_mongodb" {
  description = "Deploy MongoDB on GKE (set to false if using external MongoDB)"
  type        = bool
  default     = true
}

variable "mongodb_storage_size" {
  description = "Storage size for MongoDB persistent volume"
  type        = string
  default     = "10Gi"
}

variable "gke_node_count_min" {
  description = "Minimum number of GKE nodes"
  type        = number
  default     = 1
}

variable "gke_node_count_max" {
  description = "Maximum number of GKE nodes"
  type        = number
  default     = 3
}

variable "use_preemptible" {
  description = "Use preemptible/spot VMs for cost savings"
  type        = bool
  default     = true
}

variable "machine_type" {
  description = "GKE node machine type"
  type        = string
  default     = "e2-medium"
}
