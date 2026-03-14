resource "google_container_cluster" "only_facts" {
  name     = "only-facts-gke-${var.environment}"
  location = var.gcp_region
  project  = var.gcp_project

  network    = google_compute_network.only_facts.name
  subnetwork = google_compute_subnetwork.only_facts.name

  initial_node_count       = 1
  remove_default_node_pool = true
  deletion_protection      = false

  release_channel {
    channel = "REGULAR"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = google_compute_subnetwork.only_facts.ip_cidr_range
      display_name = "VPC Subnet"
    }
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.gcp_project}.svc.id.goog"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
  }
}

resource "google_container_node_pool" "only_facts" {
  name     = "only-facts-pool-${var.environment}"
  location = var.gcp_region
  cluster  = google_container_cluster.only_facts.name
  project  = var.gcp_project

  autoscaling {
    min_node_count = var.gke_node_count_min
    max_node_count = var.gke_node_count_max
  }

  node_config {
    machine_type = var.machine_type
    preemptible  = var.use_preemptible

    service_account = google_service_account.gke_node.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = {
      environment = var.environment
      app         = "only-facts"
    }

    tags = ["only-facts-node", var.environment]
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
