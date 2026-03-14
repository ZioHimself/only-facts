resource "kubernetes_namespace" "mongodb" {
  metadata {
    name = "mongodb"

    labels = {
      app         = "mongodb"
      environment = var.environment
    }
  }

  depends_on = [google_container_cluster.only_facts]
}

resource "random_password" "mongodb_root" {
  length  = 24
  special = false
}

resource "random_password" "mongodb_app" {
  length  = 24
  special = false
}

resource "kubernetes_secret" "mongodb_credentials" {
  metadata {
    name      = "mongodb-credentials"
    namespace = kubernetes_namespace.mongodb.metadata[0].name
  }

  data = {
    MONGO_INITDB_ROOT_USERNAME = "root"
    MONGO_INITDB_ROOT_PASSWORD = random_password.mongodb_root.result
    MONGO_APP_USERNAME         = "only-facts"
    MONGO_APP_PASSWORD         = random_password.mongodb_app.result
    MONGO_APP_DATABASE         = "only-facts"
  }

  type = "Opaque"
}

resource "kubernetes_config_map" "mongodb_init" {
  metadata {
    name      = "mongodb-init"
    namespace = kubernetes_namespace.mongodb.metadata[0].name
  }

  data = {
    "init-user.js" = <<-EOF
      db = db.getSiblingDB('only-facts');
      db.createUser({
        user: 'only-facts',
        pwd: '${random_password.mongodb_app.result}',
        roles: [
          { role: 'readWrite', db: 'only-facts' }
        ]
      });
    EOF
  }
}

resource "kubernetes_stateful_set" "mongodb" {
  metadata {
    name      = "mongodb"
    namespace = kubernetes_namespace.mongodb.metadata[0].name

    labels = {
      app         = "mongodb"
      environment = var.environment
    }
  }

  spec {
    service_name = "mongodb"
    replicas     = 1

    selector {
      match_labels = {
        app = "mongodb"
      }
    }

    template {
      metadata {
        labels = {
          app         = "mongodb"
          environment = var.environment
        }
      }

      spec {
        container {
          name  = "mongodb"
          image = "mongo:7"

          port {
            container_port = 27017
            name           = "mongodb"
          }

          env {
            name = "MONGO_INITDB_ROOT_USERNAME"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongodb_credentials.metadata[0].name
                key  = "MONGO_INITDB_ROOT_USERNAME"
              }
            }
          }

          env {
            name = "MONGO_INITDB_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongodb_credentials.metadata[0].name
                key  = "MONGO_INITDB_ROOT_PASSWORD"
              }
            }
          }

          env {
            name = "MONGO_INITDB_DATABASE"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.mongodb_credentials.metadata[0].name
                key  = "MONGO_APP_DATABASE"
              }
            }
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
          }

          volume_mount {
            name       = "mongodb-data"
            mount_path = "/data/db"
          }

          volume_mount {
            name       = "mongodb-init"
            mount_path = "/docker-entrypoint-initdb.d"
            read_only  = true
          }

          liveness_probe {
            exec {
              command = ["mongosh", "--eval", "db.adminCommand('ping')"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
          }

          readiness_probe {
            exec {
              command = ["mongosh", "--eval", "db.adminCommand('ping')"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
          }
        }

        volume {
          name = "mongodb-init"
          config_map {
            name = kubernetes_config_map.mongodb_init.metadata[0].name
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "mongodb-data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "standard-rwo"

        resources {
          requests = {
            storage = var.mongodb_storage_size
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "mongodb" {
  metadata {
    name      = "mongodb"
    namespace = kubernetes_namespace.mongodb.metadata[0].name

    labels = {
      app = "mongodb"
    }
  }

  spec {
    selector = {
      app = "mongodb"
    }

    port {
      port        = 27017
      target_port = 27017
      name        = "mongodb"
    }

    type       = "ClusterIP"
    cluster_ip = "None"
  }
}

resource "kubernetes_service" "mongodb_internal" {
  metadata {
    name      = "mongodb-internal"
    namespace = kubernetes_namespace.mongodb.metadata[0].name

    labels = {
      app = "mongodb"
    }
  }

  spec {
    selector = {
      app = "mongodb"
    }

    port {
      port        = 27017
      target_port = 27017
      name        = "mongodb"
    }

    type = "ClusterIP"
  }
}
