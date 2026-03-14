resource "kubernetes_namespace" "only_facts" {
  metadata {
    name = "only-facts"

    labels = {
      app         = "only-facts"
      environment = var.environment
    }
  }

  depends_on = [google_container_cluster.only_facts]
}

resource "kubernetes_secret" "mongo_uri" {
  metadata {
    name      = "only-facts-secrets"
    namespace = kubernetes_namespace.only_facts.metadata[0].name
  }

  data = {
    MONGO_URI = var.mongo_uri
  }

  type = "Opaque"
}

resource "kubernetes_deployment" "only_facts" {
  metadata {
    name      = "only-facts"
    namespace = kubernetes_namespace.only_facts.metadata[0].name

    labels = {
      app         = "only-facts"
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "only-facts"
      }
    }

    template {
      metadata {
        labels = {
          app         = "only-facts"
          environment = var.environment
        }

        annotations = {
          "cluster-autoscaler.kubernetes.io/safe-to-evict" = "true"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.only_facts.metadata[0].name

        container {
          name  = "only-facts"
          image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/only-facts/engine:latest"

          port {
            container_port = var.app_port
            protocol       = "TCP"
          }

          env {
            name  = "PORT"
            value = tostring(var.app_port)
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name = "MONGO_URI"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongo_uri.metadata[0].name
                key  = "MONGO_URI"
              }
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = var.app_port
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = var.app_port
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service_account" "only_facts" {
  metadata {
    name      = "only-facts"
    namespace = kubernetes_namespace.only_facts.metadata[0].name

    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.gke_workload.email
    }
  }
}

resource "kubernetes_service" "only_facts" {
  metadata {
    name      = "only-facts"
    namespace = kubernetes_namespace.only_facts.metadata[0].name

    annotations = {
      "cloud.google.com/load-balancer-type" = "Internal"
    }
  }

  spec {
    selector = {
      app = "only-facts"
    }

    port {
      port        = 80
      target_port = var.app_port
      protocol    = "TCP"
    }

    type = "LoadBalancer"
  }
}

resource "kubernetes_ingress_v1" "only_facts" {
  metadata {
    name      = "only-facts"
    namespace = kubernetes_namespace.only_facts.metadata[0].name

    annotations = {
      "kubernetes.io/ingress.class"                   = "gce-internal"
      "kubernetes.io/ingress.regional-static-ip-name" = "only-facts-internal-ip"
    }
  }

  spec {
    default_backend {
      service {
        name = kubernetes_service.only_facts.metadata[0].name
        port {
          number = 80
        }
      }
    }

    rule {
      http {
        path {
          path      = "/*"
          path_type = "ImplementationSpecific"

          backend {
            service {
              name = kubernetes_service.only_facts.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
