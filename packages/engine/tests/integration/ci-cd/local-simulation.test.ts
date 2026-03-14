import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const INFRA_DIR = path.join(WORKSPACE_ROOT, 'infra');

const execOptions: ExecSyncOptionsWithStringEncoding = {
  cwd: WORKSPACE_ROOT,
  encoding: 'utf-8',
  timeout: 120000,
  stdio: ['pipe', 'pipe', 'pipe'],
};

describe('CI Pipeline Local Simulation', () => {
  describe('npm commands', () => {
    it('should run npm ci successfully', () => {
      const result = execSync('npm ci', { ...execOptions, timeout: 180000 });
      expect(result).toBeDefined();
    }, 180000);

    it('should run npm run lint successfully', () => {
      const result = execSync('npm run lint', execOptions);
      expect(result).toBeDefined();
    }, 60000);

    it('should run npx tsc --noEmit successfully', () => {
      const result = execSync('npx tsc --noEmit', {
        ...execOptions,
        cwd: path.join(WORKSPACE_ROOT, 'packages/engine'),
      });
      expect(result).toBeDefined();
    }, 60000);

    it('should run npm run build successfully', () => {
      const result = execSync('npm run build', execOptions);
      expect(result).toBeDefined();
    }, 60000);
  });

  describe('build artifacts', () => {
    it('should produce dist/ directory after build', () => {
      const distPath = path.join(WORKSPACE_ROOT, 'packages/engine/dist');
      expect(fs.existsSync(distPath)).toBe(true);
    });

    it('should produce dist/index.js after build', () => {
      const indexPath = path.join(WORKSPACE_ROOT, 'packages/engine/dist/index.js');
      expect(fs.existsSync(indexPath)).toBe(true);
    });
  });
});

describe('Terraform Local Validation', () => {
  const terraformAvailable = (() => {
    try {
      execSync('terraform --version', { encoding: 'utf-8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  })();

  const infraExists = fs.existsSync(INFRA_DIR);

  beforeAll(() => {
    if (!terraformAvailable) {
      console.log('Skipping Terraform tests: terraform CLI not available');
    }
    if (!infraExists) {
      console.log('Skipping Terraform tests: infra/ directory not found');
    }
  });

  describe('terraform commands', () => {
    const skipCondition = !terraformAvailable || !infraExists;

    it('should run terraform init successfully', () => {
      if (skipCondition) {
        console.log('Skipped: terraform or infra/ not available');
        return;
      }

      const result = execSync('terraform init -backend=false', {
        ...execOptions,
        cwd: INFRA_DIR,
      });
      expect(result).toBeDefined();
    }, 60000);

    it('should run terraform validate successfully', () => {
      if (skipCondition) {
        console.log('Skipped: terraform or infra/ not available');
        return;
      }

      const result = execSync('terraform validate', {
        ...execOptions,
        cwd: INFRA_DIR,
      });
      expect(result).toContain('Success');
    }, 30000);

    it('should run terraform fmt -check successfully', () => {
      if (skipCondition) {
        console.log('Skipped: terraform or infra/ not available');
        return;
      }

      const result = execSync('terraform fmt -check', {
        ...execOptions,
        cwd: INFRA_DIR,
      });
      expect(result).toBeDefined();
    }, 30000);
  });
});
