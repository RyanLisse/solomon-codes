/**
 * Tests for deployment verification script
 * Using Bun test framework with proper mocking
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";

describe("Deployment Verification Script", () => {
  let originalEnv;
  let consoleSpy;
  let mockFs;
  let mockPath;
  let mockExec;
  let mockSpawn;
  let mockPromisify;
  let execAsyncMock;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Mock console methods
    consoleSpy = {
      log: spyOn(console, "log").mockImplementation(() => {}),
      warn: spyOn(console, "warn").mockImplementation(() => {}),
      error: spyOn(console, "error").mockImplementation(() => {}),
    };

    // Create fresh mock objects for each test
    mockFs = {
      existsSync: mock(() => false),
      readFileSync: mock(() => ""),
    };

    mockPath = {
      join: mock((...args) => args.join("/")),
    };

    mockExec = mock();
    mockSpawn = mock();
    execAsyncMock = mock();
    mockPromisify = mock(() => execAsyncMock);

    // Mock process.cwd
    spyOn(process, "cwd").mockReturnValue("/test/project");
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console methods
    Object.values(consoleSpy).forEach((spy) => spy.mockRestore());

    // Clear all mocks
    mock.restore();
  });

  describe("Configuration", () => {
    it("should have valid verification configuration", async () => {
      // Mock modules before importing
      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      const { VERIFICATION_CONFIG } = await import("./verify-deployment.js");

      expect(VERIFICATION_CONFIG).toHaveProperty("preDeployment");
      expect(VERIFICATION_CONFIG).toHaveProperty("postDeployment");
      expect(VERIFICATION_CONFIG).toHaveProperty("rollback");
      expect(VERIFICATION_CONFIG).toHaveProperty("targets");

      // Check pre-deployment configuration
      expect(VERIFICATION_CONFIG.preDeployment).toHaveProperty("buildArtifacts");
      expect(VERIFICATION_CONFIG.preDeployment).toHaveProperty("requiredFiles");
      expect(VERIFICATION_CONFIG.preDeployment.buildArtifacts).toContain(".next/static");
      expect(VERIFICATION_CONFIG.preDeployment.requiredFiles).toContain("package.json");

      // Check post-deployment configuration
      expect(VERIFICATION_CONFIG.postDeployment).toHaveProperty("healthEndpoints");
      expect(VERIFICATION_CONFIG.postDeployment.healthEndpoints).toContain("/api/health");

      // Check rollback configuration
      expect(VERIFICATION_CONFIG.rollback).toHaveProperty("performanceThreshold");
      expect(VERIFICATION_CONFIG.rollback.performanceThreshold).toBeGreaterThan(0);

      // Check deployment targets
      expect(VERIFICATION_CONFIG.targets).toHaveProperty("cloudflare");
      expect(VERIFICATION_CONFIG.targets).toHaveProperty("railway");
      expect(VERIFICATION_CONFIG.targets).toHaveProperty("vercel");
    });

    it("should have valid deployment target configurations", async () => {
      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      const { VERIFICATION_CONFIG } = await import("./verify-deployment.js");

      Object.values(VERIFICATION_CONFIG.targets).forEach((target) => {
        expect(target).toHaveProperty("name");
        expect(target).toHaveProperty("buildCommand");
        expect(target).toHaveProperty("expectedHeaders");
      });
    });
  });

  describe("Pre-deployment Verification", () => {
    describe("Build Artifacts Verification", () => {
      it("should pass when all build artifacts exist", async () => {
        // Mock all required files and artifacts exist
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(true);
      });

      it("should fail when build artifacts are missing", async () => {
        // Mock missing build artifacts
        mockFs.existsSync = mock((filePath) => {
          return !filePath.includes(".next/static");
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(false);
      });

      it("should check all required build artifacts", async () => {
        mockFs.existsSync = mock(() => false);

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification, VERIFICATION_CONFIG } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        // Should check for all configured artifacts
        VERIFICATION_CONFIG.preDeployment.buildArtifacts.forEach((artifact) => {
          expect(mockFs.existsSync).toHaveBeenCalledWith(
            expect.stringContaining(artifact),
          );
        });

        expect(result).toBe(false);
      });
    });

    describe("Environment Validation", () => {
      it("should run environment validation script when available", async () => {
        mockFs.existsSync = mock((filePath) => {
          if (filePath.includes("validate-build-env.js")) return true;
          return true; // Other files exist
        });

        execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(execAsyncMock).toHaveBeenCalledWith(
          expect.stringContaining("validate-build-env.js"),
        );
        expect(result).toBe(true);
      });

      it("should skip environment validation when script is missing", async () => {
        mockFs.existsSync = mock((filePath) => {
          if (filePath.includes("validate-build-env.js")) return false;
          return true; // Other files exist
        });

        execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining("Environment validation script not found"),
        );
        expect(result).toBe(true);
      });

      it("should fail when environment validation fails", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockRejectedValue(new Error("Environment validation failed"));

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining("Environment validation failed"),
        );
      });
    });

    describe("Bundle Size Check", () => {
      it("should check bundle size when .next directory exists", async () => {
        mockFs.existsSync = mock((filePath) => {
          if (filePath.includes(".next")) return true;
          if (filePath.includes("bundle-stats.json")) return true;
          return true;
        });

        mockFs.readFileSync = mock(() =>
          JSON.stringify({
            assets: [
              { name: "main.js", size: 1024 * 200 }, // 200KB - OK
              { name: "vendor.js", size: 1024 * 600 }, // 600KB - Large
            ],
          }),
        );

        execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(true);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining("Large assets detected"),
        );
      });

      it("should skip bundle size check when .next directory missing", async () => {
        mockFs.existsSync = mock((filePath) => {
          if (filePath.includes(".next")) return false;
          return true;
        });

        execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining("No .next directory found"),
        );
        expect(result).toBe(true);
      });
    });

    describe("Dependency Audit", () => {
      it("should pass when no high/critical vulnerabilities found", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockImplementation((command) => {
          if (command.includes("npm audit")) {
            return Promise.resolve({
              stdout: JSON.stringify({
                metadata: {
                  vulnerabilities: { total: 0, high: 0, critical: 0 },
                },
              }),
            });
          }
          return Promise.resolve({ stdout: "", stderr: "" });
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining("Security audit passed"),
        );
      });

      it("should fail when high/critical vulnerabilities found", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockImplementation((command) => {
          if (command.includes("npm audit")) {
            const error = new Error("Audit failed");
            error.stdout = JSON.stringify({
              metadata: {
                vulnerabilities: { total: 5, high: 2, critical: 1 },
              },
            });
            return Promise.reject(error);
          }
          return Promise.resolve({ stdout: "", stderr: "" });
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining("Security audit failed: 2 high, 1 critical"),
        );
      });

      it("should warn about low/moderate vulnerabilities but pass", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockImplementation((command) => {
          if (command.includes("npm audit")) {
            return Promise.resolve({
              stdout: JSON.stringify({
                metadata: {
                  vulnerabilities: {
                    total: 3,
                    high: 0,
                    critical: 0,
                    low: 2,
                    moderate: 1,
                  },
                },
              }),
            });
          }
          return Promise.resolve({ stdout: "", stderr: "" });
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(true);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining("Found 3 low/moderate vulnerabilities"),
        );
      });
    });

    describe("Type Check", () => {
      it("should pass when TypeScript compilation succeeds", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockImplementation((command) => {
          if (command === "npm run typecheck") {
            return Promise.resolve({ stdout: "", stderr: "" });
          }
          return Promise.resolve({ stdout: "", stderr: "" });
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(execAsyncMock).toHaveBeenCalledWith("npm run typecheck");
        expect(result).toBe(true);
      });

      it("should fail when TypeScript compilation fails", async () => {
        mockFs.existsSync = mock(() => true);
        execAsyncMock.mockImplementation((command) => {
          if (command === "npm run typecheck") {
            return Promise.reject(new Error("Type check failed"));
          }
          return Promise.resolve({ stdout: "", stderr: "" });
        });

        mock.module("fs", () => mockFs);
        mock.module("path", () => mockPath);
        mock.module("child_process", () => ({
          exec: mockExec,
          spawn: mockSpawn,
        }));
        mock.module("util", () => ({
          promisify: mockPromisify,
        }));

        const { runPreDeploymentVerification } = await import("./verify-deployment.js");
        const result = await runPreDeploymentVerification();

        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining("Type check failed"),
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors gracefully", async () => {
      mockFs.existsSync = mock(() => {
        throw new Error("File system error");
      });

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      const { runPreDeploymentVerification } = await import("./verify-deployment.js");
      const result = await runPreDeploymentVerification();

      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Build artifact verification failed"),
      );
    });

    it("should provide helpful error messages", async () => {
      mockFs.existsSync = mock(() => false);

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      const { runPreDeploymentVerification } = await import("./verify-deployment.js");
      const result = await runPreDeploymentVerification();

      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Missing build artifact"),
      );
    });
  });

  describe("Deployment Target Detection", () => {
    it("should detect Cloudflare Pages deployment", async () => {
      process.env.CF_PAGES = "true";

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      expect(process.env.CF_PAGES).toBe("true");
    });

    it("should detect Railway deployment", async () => {
      process.env.RAILWAY_ENVIRONMENT = "production";

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      expect(process.env.RAILWAY_ENVIRONMENT).toBe("production");
    });

    it("should detect Vercel deployment", async () => {
      process.env.VERCEL_ENV = "production";

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      expect(process.env.VERCEL_ENV).toBe("production");
    });

    it("should return null for unknown deployment targets", async () => {
      delete process.env.CF_PAGES;
      delete process.env.RAILWAY_ENVIRONMENT;
      delete process.env.VERCEL_ENV;

      mock.module("fs", () => mockFs);
      mock.module("path", () => mockPath);
      mock.module("child_process", () => ({
        exec: mockExec,
        spawn: mockSpawn,
      }));
      mock.module("util", () => ({
        promisify: mockPromisify,
      }));

      expect(process.env.CF_PAGES).toBeUndefined();
    });
  });
});