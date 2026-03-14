resource "google_compute_network" "only_facts" {
  name                    = "only-facts-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.gcp_project
}

resource "google_compute_subnetwork" "only_facts" {
  name                     = "only-facts-subnet-${var.environment}"
  ip_cidr_range            = "10.0.0.0/24"
  region                   = var.gcp_region
  network                  = google_compute_network.only_facts.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }
}

resource "google_compute_router" "only_facts" {
  name    = "only-facts-router-${var.environment}"
  region  = var.gcp_region
  network = google_compute_network.only_facts.id
}

resource "google_compute_router_nat" "only_facts" {
  name                               = "only-facts-nat-${var.environment}"
  router                             = google_compute_router.only_facts.name
  region                             = var.gcp_region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_firewall" "allow_internal" {
  name    = "only-facts-allow-internal-${var.environment}"
  network = google_compute_network.only_facts.name

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}

resource "google_compute_firewall" "deny_all_ingress" {
  name     = "only-facts-deny-all-ingress-${var.environment}"
  network  = google_compute_network.only_facts.name
  priority = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}
