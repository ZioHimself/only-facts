/**
 * Integration tests for project scaffolding.
 * Verifies that all configuration files exist, parse correctly,
 * and have the required structure and values.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

describe("Project Scaffolding Integration Tests", () => {
  describe("package.json", () => {
    let packageJson: Record<string, unknown>;

    beforeAll(() => {
      const filePath = path.join(ROOT, "package.json");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      packageJson = JSON.parse(content);
    });

    it('should have name "only-facts"', () => {
      expect(packageJson.name).toBe("only-facts");
    });

    it("should have build script", () => {
      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.build).toBeDefined();
    });

    it("should have test script", () => {
      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.test).toBeDefined();
    });

    it("should have lint script", () => {
      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.lint).toBeDefined();
    });

    it("should have format script", () => {
      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.format).toBeDefined();
    });

    it("should have dev script", () => {
      const scripts = packageJson.scripts as Record<string, string>;
      expect(scripts.dev).toBeDefined();
    });
  });

  describe("tsconfig.json", () => {
    let tsconfig: Record<string, unknown>;

    beforeAll(() => {
      const filePath = path.join(ROOT, "tsconfig.json");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      tsconfig = JSON.parse(content);
    });

    it("should have strict mode enabled", () => {
      const opts = tsconfig.compilerOptions as Record<string, unknown>;
      expect(opts.strict).toBe(true);
    });

    it("should target ES2022", () => {
      const opts = tsconfig.compilerOptions as Record<string, unknown>;
      expect(opts.target).toBe("ES2022");
    });

    it("should use NodeNext module", () => {
      const opts = tsconfig.compilerOptions as Record<string, unknown>;
      expect(opts.module).toBe("NodeNext");
    });

    it("should output to dist directory", () => {
      const opts = tsconfig.compilerOptions as Record<string, unknown>;
      expect(opts.outDir).toBe("dist");
    });
  });

  describe(".eslintrc.json", () => {
    let eslintConfig: Record<string, unknown>;

    beforeAll(() => {
      const filePath = path.join(ROOT, ".eslintrc.json");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      eslintConfig = JSON.parse(content);
    });

    it("should use TypeScript parser", () => {
      expect(eslintConfig.parser).toBe("@typescript-eslint/parser");
    });

    it("should have no-explicit-any rule as error", () => {
      const rules = eslintConfig.rules as Record<string, unknown>;
      expect(rules["@typescript-eslint/no-explicit-any"]).toBe("error");
    });

    it("should include TypeScript plugin", () => {
      const plugins = eslintConfig.plugins as string[];
      expect(plugins).toContain("@typescript-eslint");
    });
  });

  describe(".prettierrc", () => {
    let prettierConfig: Record<string, unknown>;

    beforeAll(() => {
      const filePath = path.join(ROOT, ".prettierrc");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      prettierConfig = JSON.parse(content);
    });

    it("should exist with formatting rules", () => {
      expect(prettierConfig).toBeDefined();
      expect(typeof prettierConfig.semi).toBe("boolean");
      expect(typeof prettierConfig.singleQuote).toBe("boolean");
    });
  });

  describe("jest.config.ts", () => {
    it("should exist", () => {
      const filePath = path.join(ROOT, "jest.config.ts");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should contain ts-jest preset", () => {
      const filePath = path.join(ROOT, "jest.config.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ts-jest");
    });
  });

  describe("Directory structure", () => {
    const srcDirs = [
      "config",
      "models",
      "services",
      "routes",
      "middleware",
      "utils",
      "types",
    ];

    it.each(srcDirs)("should have src/%s directory", (dir) => {
      const dirPath = path.join(ROOT, "src", dir);
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it("should have tests/unit directory", () => {
      const dirPath = path.join(ROOT, "tests", "unit");
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it("should have tests/integration directory", () => {
      const dirPath = path.join(ROOT, "tests", "integration");
      expect(fs.existsSync(dirPath)).toBe(true);
    });
  });

  describe(".env.example", () => {
    let envContent: string;

    beforeAll(() => {
      const filePath = path.join(ROOT, ".env.example");
      expect(fs.existsSync(filePath)).toBe(true);
      envContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should document PORT variable", () => {
      expect(envContent).toContain("PORT");
    });

    it("should document NODE_ENV variable", () => {
      expect(envContent).toContain("NODE_ENV");
    });

    it("should document MONGO_URI variable", () => {
      expect(envContent).toContain("MONGO_URI");
    });

    it("should document LOG_LEVEL variable", () => {
      expect(envContent).toContain("LOG_LEVEL");
    });
  });

  describe("src/index.ts entry point", () => {
    it("should exist", () => {
      const filePath = path.join(ROOT, "src", "index.ts");
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe(".gitignore", () => {
    let gitignoreContent: string;

    beforeAll(() => {
      const filePath = path.join(ROOT, ".gitignore");
      expect(fs.existsSync(filePath)).toBe(true);
      gitignoreContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should ignore node_modules", () => {
      expect(gitignoreContent).toContain("node_modules");
    });

    it("should ignore dist", () => {
      expect(gitignoreContent).toContain("dist");
    });

    it("should ignore .env", () => {
      expect(gitignoreContent).toMatch(/^\.env$/m);
    });

    it("should ignore coverage", () => {
      expect(gitignoreContent).toContain("coverage");
    });
  });

  describe("Build verification", () => {
    it("should compile TypeScript without errors", () => {
      expect(() => {
        execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
      }).not.toThrow();
    });
  });

  describe("Lint verification", () => {
    it("should pass linting", () => {
      expect(() => {
        execSync("npm run lint", { cwd: ROOT, stdio: "pipe" });
      }).not.toThrow();
    });
  });
});
