import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const CI_WORKFLOW_PATH = path.join(WORKSPACE_ROOT, '.github/workflows/ci.yml');

interface WorkflowTrigger {
  push?: {
    branches?: string[];
    paths?: string[];
  };
  pull_request?: {
    branches?: string[];
  };
}

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  'continue-on-error'?: boolean;
}

interface WorkflowJob {
  'runs-on'?: string;
  steps?: WorkflowStep[];
}

interface GitHubWorkflow {
  name?: string;
  on?: WorkflowTrigger;
  jobs?: Record<string, WorkflowJob>;
}

describe('CI Workflow', () => {
  let workflowContent: string;
  let workflow: GitHubWorkflow;

  beforeAll(() => {
    if (!fs.existsSync(CI_WORKFLOW_PATH)) {
      throw new Error(`CI workflow file not found at ${CI_WORKFLOW_PATH}`);
    }
    workflowContent = fs.readFileSync(CI_WORKFLOW_PATH, 'utf-8');
    workflow = yaml.load(workflowContent) as GitHubWorkflow;
  });

  describe('file existence and syntax', () => {
    it('should exist at .github/workflows/ci.yml', () => {
      expect(fs.existsSync(CI_WORKFLOW_PATH)).toBe(true);
    });

    it('should be valid YAML', () => {
      expect(() => yaml.load(workflowContent)).not.toThrow();
    });

    it('should have a name', () => {
      expect(workflow.name).toBeDefined();
    });
  });

  describe('trigger configuration', () => {
    it('should trigger on push to main', () => {
      expect(workflow.on?.push?.branches).toContain('main');
    });

    it('should NOT trigger on pull_request (trunk-based development)', () => {
      expect(workflow.on?.pull_request).toBeUndefined();
    });
  });

  describe('job configuration', () => {
    let ciJob: WorkflowJob | undefined;

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      ciJob = jobs['ci'] || jobs['build'] || Object.values(jobs)[0];
    });

    it('should have at least one job defined', () => {
      expect(Object.keys(workflow.jobs || {}).length).toBeGreaterThan(0);
    });

    it('should use ubuntu-latest runner', () => {
      expect(ciJob?.['runs-on']).toBe('ubuntu-latest');
    });

    it('should have steps defined', () => {
      expect(ciJob?.steps?.length).toBeGreaterThan(0);
    });
  });

  describe('Node.js setup', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const ciJob = jobs['ci'] || jobs['build'] || Object.values(jobs)[0];
      steps = ciJob?.steps || [];
    });

    it('should setup Node.js 20.x', () => {
      const setupNodeStep = steps.find(
        (step) =>
          step.uses?.includes('actions/setup-node') || step.name?.toLowerCase().includes('node')
      );
      expect(setupNodeStep).toBeDefined();

      const nodeVersion = setupNodeStep?.with?.['node-version'];
      expect(nodeVersion).toMatch(/^20/);
    });
  });

  describe('required CI steps', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const ciJob = jobs['ci'] || jobs['build'] || Object.values(jobs)[0];
      steps = ciJob?.steps || [];
    });

    it('should have npm ci step', () => {
      const npmCiStep = steps.find((step) => step.run?.includes('npm ci'));
      expect(npmCiStep).toBeDefined();
    });

    it('should have lint step', () => {
      const lintStep = steps.find(
        (step) => step.run?.includes('npm run lint') || step.run?.includes('lint')
      );
      expect(lintStep).toBeDefined();
    });

    it('should have typecheck step', () => {
      const typecheckStep = steps.find(
        (step) => step.run?.includes('tsc --noEmit') || step.run?.includes('typecheck')
      );
      expect(typecheckStep).toBeDefined();
    });

    it('should have test:coverage step', () => {
      const testStep = steps.find(
        (step) => step.run?.includes('test:coverage') || step.run?.includes('npm test')
      );
      expect(testStep).toBeDefined();
    });

    it('should have build step', () => {
      const buildStep = steps.find(
        (step) => step.run?.includes('npm run build') || step.run?.includes('build')
      );
      expect(buildStep).toBeDefined();
    });
  });

  describe('caching', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const ciJob = jobs['ci'] || jobs['build'] || Object.values(jobs)[0];
      steps = ciJob?.steps || [];
    });

    it('should use actions/cache or setup-node cache', () => {
      const cacheStep = steps.find(
        (step) => step.uses?.includes('actions/cache') || step.with?.cache === 'npm'
      );
      expect(cacheStep).toBeDefined();
    });
  });

  describe('fail-fast behavior', () => {
    let steps: WorkflowStep[];

    beforeAll(() => {
      const jobs = workflow.jobs || {};
      const ciJob = jobs['ci'] || jobs['build'] || Object.values(jobs)[0];
      steps = ciJob?.steps || [];
    });

    it('should NOT have continue-on-error on quality gate steps', () => {
      const qualitySteps = steps.filter(
        (step) =>
          step.run?.includes('lint') ||
          step.run?.includes('tsc') ||
          step.run?.includes('test') ||
          step.run?.includes('build')
      );

      qualitySteps.forEach((step) => {
        expect(step['continue-on-error']).not.toBe(true);
      });
    });
  });
});
