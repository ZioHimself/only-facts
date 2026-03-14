# Production Environment Configuration
# Non-sensitive values only - sensitive values come from GitHub secrets

environment = "prod"
gcp_region  = "europe-west1"

# Application settings
app_port = 3000

# MongoDB settings - using internal MongoDB on GKE
use_internal_mongodb = true
mongodb_storage_size = "10Gi"

# GKE node pool settings
gke_node_count_min = 1
gke_node_count_max = 3
use_preemptible    = true
machine_type       = "e2-small"

# Note: gcp_project is set via TF_VAR_gcp_project from GitHub vars
# Note: mongo_uri is not needed when use_internal_mongodb = true
