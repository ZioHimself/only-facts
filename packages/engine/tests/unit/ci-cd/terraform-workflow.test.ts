import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const TERRAFORM_WORKFLOW_PATH = path.join(WORKSPACE_ROOT, '.github/workflows/terraform.yml');

interface WorkflowTrigger {
  push?: {
    branches?: string[];
    paths?: string[];
  };
  pull_request?: {
    branches?: string[];
    paths?: string[];
  };
}

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  if?: string;
  'continue-on-error'?: boolean;
}

interface WorkflowJob {
  'runs-on'?: string;
  steps?: WorkflowStep[];
  permissions?: Record<string, string>;
}

interface GitHubWorkflow {
  name?: string;
  on?: WorkflowTrigger;
  jobs?: Record<string, WorkflowJob>;
}

describe('Terraform Workflow', () => {
  let workflowContent: string;
  let workflow: GitHubWorkflow;

  beforeAll(() => {
    if (!fs.existsSync(TERRAFORM_WORKFLOW_PATH)) {
      throw new Error(`Terraform workflow file not found at ${TERRAFORM_WORKFLOW_PATH}`);
    }
    workflowContent = fs.readFileSync(TERRAFORM_WORKFLOW_PATH, 'utf-8');
    workflow = yaml.load(workflowContent) as GitHubWorkflow;
  });

  describe('file existence and syntax', () => {
    it('should exist at .github/workflows/terraform.yml', () => {
      expect(fs.existsSync(TERRAFORM_WORKFLOW_PATH)).toBe(true);
    });

    it('should be valid YAML', () => {
      expect(() => yaml.load(workflowContent)).not.toThrow();
    });

    it('should have a name', () => {
      expect(workflow.name).toBeDefined();
    });
  });

  describe('trigger configuration (trunk-based)', () => {
    it('should trigger on push to main', () => {
      expect(workflow.on?.push?.branches).toContain('main');
    });

    it('should trigger on infra/** path changes', () => {
      expect(workflow.on?.push?.paths).toContain('infra/**');
    });

    it('should NOT trigger on pull_request (trunk-based development)', () => {
      expect(workflow.on?.pull_request).toBeUndefined();
    });
  });

  describe('job configuration', () => {
    let terraformJob: WorkflowJob | undefined;

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      terraformJob = jobs['terraform'] || jobs['deploy'] || Object.values(jobs)[0];
    });

    it('should have at least one job defined', () => {
      expect(Object.keys(workflow.jobs || {}).length).toBeGreaterThan(0);
    });

    it('should use ubuntu-latest runner', () => {
      expect(terraformJob?.['runs-on']).toBe('ubuntu-latest');
    });

    it('should have steps defined', () => {
      expect(terraformJob?.steps?.length).toBeGreaterThan(0);
    });
  });

  describe('GCP authentication', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const terraformJob = jobs['terraform'] || jobs['deploy'] || Object.values(jobs)[0];
      steps = terraformJob?.steps || [];
    });

    it('should use google-github-actions/auth for authentication', () => {
      const authStep = steps.find((step) => step.uses?.includes('google-github-actions/auth'));
      expect(authStep).toBeDefined();
    });

    it('should NOT have hardcoded credentials', () => {
      const workflowString = JSON.stringify(workflow);
      expect(workflowString).not.toMatch(/GCLOUD_SERVICE_KEY|service_account_key.*:[^$]/i);
    });
  });

  describe('Terraform steps', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const terraformJob = jobs['terraform'] || jobs['deploy'] || Object.values(jobs)[0];
      steps = terraformJob?.steps || [];
    });

    it('should have terraform init step', () => {
      const initStep = steps.find((step) => step.run?.includes('terraform init'));
      expect(initStep).toBeDefined();
    });

    it('should have terraform validate step', () => {
      const validateStep = steps.find((step) => step.run?.includes('terraform validate'));
      expect(validateStep).toBeDefined();
    });

    it('should have terraform fmt check step', () => {
      const fmtStep = steps.find((step) => step.run?.includes('terraform fmt'));
      expect(fmtStep).toBeDefined();
    });

    it('should have terraform plan step', () => {
      const planStep = steps.find((step) => step.run?.includes('terraform plan'));
      expect(planStep).toBeDefined();
    });

    it('should have terraform apply step', () => {
      const applyStep = steps.find((step) => step.run?.includes('terraform apply'));
      expect(applyStep).toBeDefined();
    });

    it('should use -auto-approve flag for apply', () => {
      const applyStep = steps.find((step) => step.run?.includes('terraform apply'));
      expect(applyStep?.run).toContain('-auto-approve');
    });
  });

  describe('state backend configuration', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const terraformJob = jobs['terraform'] || jobs['deploy'] || Object.values(jobs)[0];
      steps = terraformJob?.steps || [];
    });

    it('should use backend-config from GitHub variables', () => {
      const initStep = steps.find((step) => step.run?.includes('terraform init'));
      expect(initStep?.run).toMatch(/backend-config.*\$\{\{.*vars\./);
    });
  });

  describe('sensitive variables handling', () => {
    it('should use GitHub secrets for sensitive values', () => {
      const workflowString = JSON.stringify(workflow);
      expect(workflowString).toMatch(/\$\{\{\s*secrets\./);
    });

    it('should NOT have hardcoded secrets', () => {
      const workflowString = workflowContent.toLowerCase();
      expect(workflowString).not.toMatch(/mongo.*=\s*["'][^$]/);
      expect(workflowString).not.toMatch(/password\s*[:=]\s*["'][^$]/);
      expect(workflowString).not.toMatch(/api[_-]?key\s*[:=]\s*["'][^$]/);
    });
  });

  describe('fail-fast behavior', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const terraformJob = jobs['terraform'] || jobs['deploy'] || Object.values(jobs)[0];
      steps = terraformJob?.steps || [];
    });

    it('should NOT have continue-on-error on validation steps', () => {
      const validationSteps = steps.filter(
        (step) =>
          step.run?.includes('terraform validate') ||
          step.run?.includes('terraform fmt') ||
          step.run?.includes('terraform plan')
      );

      validationSteps.forEach((step) => {
        expect(step['continue-on-error']).not.toBe(true);
      });
    });
  });
});
