# Infrastructure Setup Guide

This guide walks through setting up the GCP infrastructure for the only-facts project.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5.0
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (gcloud CLI)
- A GCP project with billing enabled
- GitHub repository access

## Step 1: Authenticate to GCP

```bash
# Login to GCP
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable compute.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable iam.googleapis.com
gcloud services enable iamcredentials.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

## Step 2: Run Bootstrap Terraform

The bootstrap configuration creates:
- GCS bucket for Terraform state
- Service account for GitHub Actions
- Workload Identity Federation pool and provider
- Required IAM bindings

```bash
cd infra/bootstrap

# Create terraform.tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values:
# - gcp_project = "your-project-id"
# - github_owner = "ZioHimself"
# - github_repo = "only-facts"

# Initialize and apply
terraform init
terraform plan
terraform apply
```

Save the outputs - you'll need them for GitHub Actions configuration.

## Step 3: Configure GitHub Actions

After bootstrap completes, set up GitHub repository variables and secrets.

### Repository Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Value | Description |
|----------|-------|-------------|
| `TF_STATE_BUCKET` | `{project-id}-tf-state` | GCS bucket for Terraform state |
| `WIF_PROVIDER` | `projects/{num}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | From bootstrap output |
| `WIF_SERVICE_ACCOUNT` | `github-actions-terraform@{project}.iam.gserviceaccount.com` | From bootstrap output |
| `GCP_PROJECT` | `your-project-id` | Your GCP project ID |

### Repository Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Value | Description |
|--------|-------|-------------|
| `MONGO_URI` | `mongodb+srv://...` | (Optional) External MongoDB connection string. Only needed if `use_internal_mongodb = false` |

> **Note:** By default, the infrastructure deploys MongoDB on GKE. No external MongoDB connection is required.

## Step 4: Verify Setup

Push a change to `infra/` to trigger the Terraform workflow:

```bash
# Make a small change
echo "# Test" >> infra/main.tf

# Commit and push
git add infra/
git commit -m "[SDD] Test Terraform workflow"
git push
```

Check GitHub Actions to verify the workflow runs successfully.

## MongoDB Configuration

By default, the infrastructure deploys MongoDB as a StatefulSet on GKE with:
- **Persistent storage**: 10Gi PVC (configurable via `mongodb_storage_size`)
- **Credentials**: Auto-generated random passwords
- **Internal access**: Accessible within the cluster at `mongodb-internal.mongodb.svc.cluster.local:27017`

### Internal MongoDB (Default)

No additional configuration needed. The app connects via internal Kubernetes DNS.

```hcl
# environments/prod.tfvars
use_internal_mongodb = true
mongodb_storage_size = "10Gi"
```

### External MongoDB (MongoDB Atlas)

To use an external MongoDB instance:

```hcl
# environments/prod.tfvars
use_internal_mongodb = false

# Set MONGO_URI as a GitHub secret, or via environment variable:
# TF_VAR_mongo_uri="mongodb+srv://..."
```

### Accessing MongoDB

For debugging, you can port-forward to MongoDB:

```bash
# Get cluster credentials
gcloud container clusters get-credentials only-facts --region=us-central1

# Port forward
kubectl port-forward -n mongodb svc/mongodb-internal 27017:27017

# Connect with mongosh
mongosh mongodb://localhost:27017
```

## Directory Structure

```
infra/
├── bootstrap/              # One-time setup (state bucket, WIF)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
├── main.tf                 # Main provider config
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── vpc.tf                  # VPC, subnet, NAT
├── gke.tf                  # GKE cluster
├── iam.tf                  # Service accounts
├── mongodb.tf              # MongoDB StatefulSet
├── kubernetes.tf           # K8s resources (app)
├── artifact-registry.tf    # Container registry
├── terraform.tfvars.example
└── environments/
    └── prod.tfvars         # Production values
```

## Troubleshooting

### "Permission denied" errors
Ensure the service account has the required roles. The bootstrap creates these automatically.

### "Bucket not found" error
Run the bootstrap first to create the state bucket.

### WIF authentication fails
1. Verify the `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` variables are correct
2. Ensure the GitHub repository matches the attribute condition in the WIF provider
3. Check that `id-token: write` permission is set in the workflow

### API not enabled
Run: `gcloud services enable {api-name}.googleapis.com`

## Manual GCS Bucket Creation (Alternative)

If you prefer to create the bucket manually:

```bash
# Create bucket
gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-tf-state

# Enable versioning
gsutil versioning set on gs://YOUR_PROJECT_ID-tf-state

# Set lifecycle (keep last 5 versions)
cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"numNewerVersions": 5}
      }
    ]
  }
}
EOF
gsutil lifecycle set lifecycle.json gs://YOUR_PROJECT_ID-tf-state
rm lifecycle.json
```

## Manual WIF Setup (Alternative)

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='ZioHimself/only-facts'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create service account
gcloud iam service-accounts create github-actions-terraform \
  --display-name="GitHub Actions Terraform"

# Grant roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions-terraform@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/editor"

# Allow WIF to impersonate
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-terraform@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/ZioHimself/only-facts"
```

---

*Last updated: Infrastructure includes MongoDB StatefulSet on GKE with auto-generated credentials.*
