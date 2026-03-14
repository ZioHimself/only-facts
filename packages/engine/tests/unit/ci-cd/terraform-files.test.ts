import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const INFRA_DIR = path.join(WORKSPACE_ROOT, 'infra');

describe('Terraform Files Structure', () => {
  describe('directory existence', () => {
    it('should have infra/ directory at workspace root', () => {
      expect(fs.existsSync(INFRA_DIR)).toBe(true);
    });

    it('should have environments/ subdirectory', () => {
      expect(fs.existsSync(path.join(INFRA_DIR, 'environments'))).toBe(true);
    });
  });

  describe('required Terraform files', () => {
    const requiredFiles = ['main.tf', 'variables.tf', 'outputs.tf'];

    requiredFiles.forEach((file) => {
      it(`should have ${file}`, () => {
        expect(fs.existsSync(path.join(INFRA_DIR, file))).toBe(true);
      });
    });
  });

  describe('optional but expected files', () => {
    const expectedFiles = [
      'vpc.tf',
      'gke.tf',
      'iam.tf',
      'artifact-registry.tf',
      'kubernetes.tf',
      'terraform.tfvars.example',
    ];

    expectedFiles.forEach((file) => {
      it(`should have ${file}`, () => {
        expect(fs.existsSync(path.join(INFRA_DIR, file))).toBe(true);
      });
    });
  });

  describe('environment configuration', () => {
    it('should have environments/prod.tfvars', () => {
      expect(fs.existsSync(path.join(INFRA_DIR, 'environments', 'prod.tfvars'))).toBe(true);
    });
  });
});

describe('Terraform File Contents', () => {
  describe('main.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'main.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define Google provider', () => {
      expect(content).toMatch(/provider\s+"google"/);
    });

    it('should configure GCS backend', () => {
      expect(content).toMatch(/backend\s+"gcs"/);
    });

    it('should specify required Terraform version', () => {
      expect(content).toMatch(/required_version\s*=/);
    });
  });

  describe('variables.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'variables.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    const requiredVariables = ['environment', 'gcp_project', 'gcp_region', 'mongo_uri'];

    requiredVariables.forEach((varName) => {
      it(`should define variable "${varName}"`, () => {
        expect(content).toMatch(new RegExp(`variable\\s+"${varName}"`));
      });
    });

    it('should mark mongo_uri as sensitive', () => {
      const mongoUriBlock = content.match(/variable\s+"mongo_uri"\s*\{[^}]+\}/s);
      expect(mongoUriBlock?.[0]).toMatch(/sensitive\s*=\s*true/);
    });
  });

  describe('outputs.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'outputs.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    const requiredOutputs = ['gke_cluster_name', 'gke_cluster_endpoint', 'load_balancer_ip'];

    requiredOutputs.forEach((outputName) => {
      it(`should define output "${outputName}"`, () => {
        expect(content).toMatch(new RegExp(`output\\s+"${outputName}"`));
      });
    });
  });

  describe('vpc.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'vpc.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define VPC network resource', () => {
      expect(content).toMatch(/google_compute_network/);
    });

    it('should define subnet resource', () => {
      expect(content).toMatch(/google_compute_subnetwork/);
    });

    it('should define Cloud NAT for egress', () => {
      expect(content).toMatch(/google_compute_router_nat/);
    });
  });

  describe('gke.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'gke.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define GKE cluster resource', () => {
      expect(content).toMatch(/google_container_cluster/);
    });

    it('should define GKE node pool resource', () => {
      expect(content).toMatch(/google_container_node_pool/);
    });

    it('should enable private nodes', () => {
      expect(content).toMatch(/enable_private_nodes\s*=\s*true/);
    });

    it('should configure master authorized networks', () => {
      expect(content).toMatch(/master_authorized_networks_config/);
    });

    it('should enable workload identity', () => {
      expect(content).toMatch(/workload_identity_config/);
    });
  });

  describe('kubernetes.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'kubernetes.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define Kubernetes namespace', () => {
      expect(content).toMatch(/kubernetes_namespace/);
    });

    it('should define Kubernetes deployment', () => {
      expect(content).toMatch(/kubernetes_deployment/);
    });

    it('should define Kubernetes service', () => {
      expect(content).toMatch(/kubernetes_service/);
    });

    it('should define internal-only ingress', () => {
      expect(content).toMatch(/kubernetes_ingress/);
      expect(content).toMatch(/gce-internal|internal/i);
    });
  });

  describe('iam.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'iam.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define service account', () => {
      expect(content).toMatch(/google_service_account/);
    });

    it('should define IAM bindings', () => {
      expect(content).toMatch(/google_project_iam_member|google_service_account_iam/);
    });
  });

  describe('artifact-registry.tf', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'artifact-registry.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define Artifact Registry repository', () => {
      expect(content).toMatch(/google_artifact_registry_repository/);
    });

    it('should use DOCKER format', () => {
      expect(content).toMatch(/format\s*=\s*"DOCKER"/);
    });
  });
});

describe('Bootstrap Terraform Files', () => {
  const BOOTSTRAP_DIR = path.join(INFRA_DIR, 'bootstrap');

  describe('directory existence', () => {
    it('should have bootstrap/ subdirectory', () => {
      expect(fs.existsSync(BOOTSTRAP_DIR)).toBe(true);
    });
  });

  describe('required bootstrap files', () => {
    const requiredFiles = ['main.tf', 'variables.tf', 'outputs.tf', 'terraform.tfvars.example'];

    requiredFiles.forEach((file) => {
      it(`should have ${file}`, () => {
        expect(fs.existsSync(path.join(BOOTSTRAP_DIR, file))).toBe(true);
      });
    });
  });

  describe('bootstrap main.tf content', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(BOOTSTRAP_DIR, 'main.tf');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should define GCS bucket for state', () => {
      expect(content).toMatch(/google_storage_bucket.*terraform_state/s);
    });

    it('should define workload identity pool', () => {
      expect(content).toMatch(/google_iam_workload_identity_pool/);
    });

    it('should define workload identity provider', () => {
      expect(content).toMatch(/google_iam_workload_identity_pool_provider/);
    });

    it('should define GitHub Actions service account', () => {
      expect(content).toMatch(/google_service_account.*github_actions/s);
    });

    it('should enable required APIs', () => {
      expect(content).toMatch(/google_project_service.*required_apis/s);
    });
  });
});

describe('Terraform Security Checks', () => {
  describe('no secrets in tfvars.example', () => {
    let content: string;

    beforeAll(() => {
      const filePath = path.join(INFRA_DIR, 'terraform.tfvars.example');
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      }
    });

    it('should not contain actual MongoDB URIs', () => {
      expect(content).not.toMatch(/mongodb\+srv:\/\/[^#\n]+@/);
    });

    it('should not contain actual passwords', () => {
      expect(content).not.toMatch(/password\s*=\s*"[^"$]+[^"#]+"/i);
    });
  });

  describe('.gitignore coverage', () => {
    let gitignoreContent: string;

    beforeAll(() => {
      const gitignorePath = path.join(WORKSPACE_ROOT, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }
    });

    it('should ignore *.tfvars (except example)', () => {
      expect(gitignoreContent).toMatch(/\*\.tfvars|\*\*\/\*\.tfvars|infra\/\*\.tfvars/);
    });

    it('should ignore .terraform directory', () => {
      expect(gitignoreContent).toMatch(/\.terraform/);
    });
  });
});
