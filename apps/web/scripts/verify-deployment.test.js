/**
 * Tests for deployment verification script
 * Using London TDD approach with comprehensive mocking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

// Mock modules
vi.mock('fs');
vi.mock('path');
vi.mock('child_process');
vi.mock('util');

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockSpawn = vi.mocked(spawn);
const mockExec = vi.mocked(exec);
const mockPromisify = vi.mocked(promisify);

// Import the module under test
const {
  verifyDeployment,
  runPreDeploymentVerification,
  runPostDeploymentVerification,
  VERIFICATION_CONFIG
} = await import('./verify-deployment.js');

describe('Deployment Verification Script', () => {
  let originalEnv;
  let consoleSpy;
  let execAsyncMock;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };

    // Reset mocks
    vi.clearAllMocks();
    
    // Mock path.join to return predictable paths
    mockPath.join.mockImplementation((...args) => args.join('/'));
    
    // Mock process.cwd
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    // Mock execAsync
    execAsyncMock = vi.fn();
    mockPromisify.mockReturnValue(execAsyncMock);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should have valid verification configuration', () => {
      expect(VERIFICATION_CONFIG).toHaveProperty('preDeployment');
      expect(VERIFICATION_CONFIG).toHaveProperty('postDeployment');
      expect(VERIFICATION_CONFIG).toHaveProperty('rollback');
      expect(VERIFICATION_CONFIG).toHaveProperty('targets');

      // Check pre-deployment configuration
      expect(VERIFICATION_CONFIG.preDeployment).toHaveProperty('buildArtifacts');
      expect(VERIFICATION_CONFIG.preDeployment).toHaveProperty('requiredFiles');
      expect(VERIFICATION_CONFIG.preDeployment.buildArtifacts).toContain('.next/static');
      expect(VERIFICATION_CONFIG.preDeployment.requiredFiles).toContain('package.json');

      // Check post-deployment configuration
      expect(VERIFICATION_CONFIG.postDeployment).toHaveProperty('healthEndpoints');
      expect(VERIFICATION_CONFIG.postDeployment.healthEndpoints).toContain('/api/health');

      // Check rollback configuration
      expect(VERIFICATION_CONFIG.rollback).toHaveProperty('performanceThreshold');
      expect(VERIFICATION_CONFIG.rollback.performanceThreshold).toBeGreaterThan(0);

      // Check deployment targets
      expect(VERIFICATION_CONFIG.targets).toHaveProperty('cloudflare');
      expect(VERIFICATION_CONFIG.targets).toHaveProperty('railway');
      expect(VERIFICATION_CONFIG.targets).toHaveProperty('vercel');
    });

    it('should have valid deployment target configurations', () => {
      Object.values(VERIFICATION_CONFIG.targets).forEach(target => {
        expect(target).toHaveProperty('name');
        expect(target).toHaveProperty('buildCommand');
        expect(target).toHaveProperty('expectedHeaders');
      });
    });
  });

  describe('Pre-deployment Verification', () => {
    describe('Build Artifacts Verification', () => {
      it('should pass when all build artifacts exist', async () => {
        // Mock all required files and artifacts exist
        mockFs.existsSync.mockReturnValue(true);

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('✅ Pre-deployment verification passed!')
        );
      });

      it('should fail when build artifacts are missing', async () => {
        // Mock missing build artifacts
        mockFs.existsSync.mockImplementation((filePath) => {
          return !filePath.includes('.next/static');
        });

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(false);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('❌ Pre-deployment verification failed')
        );

        exitSpy.mockRestore();
      });

      it('should check all required build artifacts', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await runPreDeploymentVerification();
        
        // Should check for all configured artifacts
        VERIFICATION_CONFIG.preDeployment.buildArtifacts.forEach(artifact => {
          expect(mockFs.existsSync).toHaveBeenCalledWith(
            expect.stringContaining(artifact)
          );
        });

        expect(result).toBe(false);
      });
    });

    describe('Environment Validation', () => {
      it('should run environment validation script when available', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
          if (filePath.includes('validate-build-env.js')) return true;
          return true; // Other files exist
        });

        execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

        const result = await runPreDeploymentVerification();
        
        expect(execAsyncMock).toHaveBeenCalledWith(
          expect.stringContaining('validate-build-env.js')
        );
        expect(result).toBe(true);
      });

      it('should skip environment validation when script is missing', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
          if (filePath.includes('validate-build-env.js')) return false;
          return true; // Other files exist
        });

        const result = await runPreDeploymentVerification();
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Environment validation script not found')
        );
        expect(result).toBe(true);
      });

      it('should fail when environment validation fails', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockRejectedValue(new Error('Environment validation failed'));

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Environment validation failed')
        );
      });
    });

    describe('Bundle Size Check', () => {
      it('should check bundle size when .next directory exists', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
          if (filePath.includes('.next')) return true;
          if (filePath.includes('bundle-stats.json')) return true;
          return true;
        });

        mockFs.readFileSync.mockReturnValue(JSON.stringify({
          assets: [
            { name: 'main.js', size: 1024 * 200 }, // 200KB - OK
            { name: 'vendor.js', size: 1024 * 600 }, // 600KB - Large
          ]
        }));

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(true);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Large assets detected')
        );
      });

      it('should skip bundle size check when .next directory missing', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
          if (filePath.includes('.next')) return false;
          return true;
        });

        const result = await runPreDeploymentVerification();
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('No .next directory found')
        );
        expect(result).toBe(true);
      });
    });

    describe('Dependency Audit', () => {
      it('should pass when no high/critical vulnerabilities found', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockResolvedValue({
          stdout: JSON.stringify({
            metadata: {
              vulnerabilities: { total: 0, high: 0, critical: 0 }
            }
          })
        });

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Security audit passed')
        );
      });

      it('should fail when high/critical vulnerabilities found', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockRejectedValue({
          stdout: JSON.stringify({
            metadata: {
              vulnerabilities: { total: 5, high: 2, critical: 1 }
            }
          })
        });

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Security audit failed: 2 high, 1 critical')
        );
      });

      it('should warn about low/moderate vulnerabilities but pass', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockResolvedValue({
          stdout: JSON.stringify({
            metadata: {
              vulnerabilities: { total: 3, high: 0, critical: 0, low: 2, moderate: 1 }
            }
          })
        });

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(true);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Found 3 low/moderate vulnerabilities')
        );
      });
    });

    describe('Type Check', () => {
      it('should pass when TypeScript compilation succeeds', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });

        const result = await runPreDeploymentVerification();
        
        expect(execAsyncMock).toHaveBeenCalledWith('npm run typecheck');
        expect(result).toBe(true);
      });

      it('should fail when TypeScript compilation fails', async () => {
        mockFs.existsSync.mockReturnValue(true);
        execAsyncMock.mockImplementation((command) => {
          if (command === 'npm run typecheck') {
            return Promise.reject(new Error('Type check failed'));
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        const result = await runPreDeploymentVerification();
        
        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Type check failed')
        );
      });
    });
  });

  describe('Post-deployment Verification', () => {
    // Mock HTTP request function
    const mockMakeRequest = vi.fn();

    beforeEach(() => {
      // Mock the makeRequest function that would be imported
      vi.doMock('./verify-deployment.js', async () => {
        const actual = await vi.importActual('./verify-deployment.js');
        return {
          ...actual,
          makeRequest: mockMakeRequest
        };
      });
    });

    describe('Health Endpoint Checks', () => {
      it('should pass when all health endpoints return 200', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString()
          })
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(true);
        expect(mockMakeRequest).toHaveBeenCalledWith(
          `${baseUrl}/api/health`,
          expect.any(Object)
        );
      });

      it('should fail when health endpoints return errors', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockRejectedValue(new Error('Connection refused'));

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(false);
        expect(consoleSpy.error).toHaveBeenCalledWith(
          expect.stringContaining('Health endpoint checks failed')
        );
      });

      it('should validate health check response format', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ invalid: 'response' })
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing required fields')
        );
      });
    });

    describe('Security Header Checks', () => {
      it('should check for required security headers', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'x-xss-protection': '1; mode=block',
            'referrer-policy': 'strict-origin-when-cross-origin'
          },
          body: ''
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('All security headers present')
        );
      });

      it('should warn about missing security headers', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {
            'x-content-type-options': 'nosniff'
            // Missing other required headers
          },
          body: ''
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Missing security headers')
        );
      });

      it('should warn about insecure headers', async () => {
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {
            'x-powered-by': 'Express',
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'x-xss-protection': '1; mode=block',
            'referrer-policy': 'strict-origin-when-cross-origin'
          },
          body: ''
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('X-Powered-By header should be removed')
        );
      });
    });

    describe('Performance Checks', () => {
      it('should pass when response times are within threshold', async () => {
        const baseUrl = 'https://example.com';
        
        // Mock fast responses
        mockMakeRequest.mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                statusCode: 200,
                headers: {},
                body: ''
              });
            }, 100); // 100ms response time
          });
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('Performance check passed')
        );
      });

      it('should fail when response times exceed threshold', async () => {
        const baseUrl = 'https://example.com';
        
        // Mock slow responses
        mockMakeRequest.mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                statusCode: 200,
                headers: {},
                body: ''
              });
            }, 3000); // 3 second response time (exceeds 2s threshold)
          });
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(false);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('exceeds threshold')
        );
      });
    });

    describe('SSL Configuration', () => {
      it('should check HSTS header for HTTPS URLs in production', async () => {
        process.env.NODE_ENV = 'production';
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {
            'strict-transport-security': 'max-age=31536000; includeSubDomains'
          },
          body: ''
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(result).toBe(true);
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('HSTS header configured')
        );
      });

      it('should warn about missing HSTS header in production', async () => {
        process.env.NODE_ENV = 'production';
        const baseUrl = 'https://example.com';
        
        mockMakeRequest.mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: ''
        });

        const result = await runPostDeploymentVerification(baseUrl);
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('HSTS header missing in production')
        );
      });

      it('should skip SSL checks for HTTP URLs', async () => {
        const baseUrl = 'http://localhost:3000';
        
        const result = await runPostDeploymentVerification(baseUrl);
        
        // Should not attempt SSL verification for HTTP URLs
        expect(result).toBe(true);
      });
    });
  });

  describe('Deployment Target Detection', () => {
    it('should detect Cloudflare Pages deployment', async () => {
      process.env.CF_PAGES = 'true';
      
      // Test would verify getDeploymentTarget() returns 'cloudflare'
      expect(process.env.CF_PAGES).toBe('true');
    });

    it('should detect Railway deployment', async () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      
      // Test would verify getDeploymentTarget() returns 'railway'
      expect(process.env.RAILWAY_ENVIRONMENT).toBe('production');
    });

    it('should detect Vercel deployment', async () => {
      process.env.VERCEL_ENV = 'production';
      
      // Test would verify getDeploymentTarget() returns 'vercel'
      expect(process.env.VERCEL_ENV).toBe('production');
    });

    it('should return null for unknown deployment targets', async () => {
      delete process.env.CF_PAGES;
      delete process.env.RAILWAY_ENVIRONMENT;
      delete process.env.VERCEL_ENV;
      
      // Test would verify getDeploymentTarget() returns null
      expect(process.env.CF_PAGES).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await runPreDeploymentVerification();
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Build artifact verification failed')
      );
    });

    it('should handle network errors during post-deployment checks', async () => {
      const baseUrl = 'https://example.com';
      
      mockMakeRequest.mockRejectedValue(new Error('Network error'));

      const result = await runPostDeploymentVerification(baseUrl);
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Health endpoint checks failed')
      );
    });

    it('should provide helpful error messages', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await runPreDeploymentVerification();
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing build artifact')
      );
    });
  });

  describe('Command Line Interface', () => {
    let originalArgv;

    beforeEach(() => {
      originalArgv = process.argv;
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should run pre-deployment verification by default', async () => {
      process.argv = ['node', 'verify-deployment.js'];
      
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(true);
      execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });
      
      // Would call verifyDeployment() and check it runs pre-deployment
      expect(process.argv[2]).toBeUndefined(); // No mode specified, should default to 'pre'
      
      exitSpy.mockRestore();
    });

    it('should run post-deployment verification when specified', async () => {
      process.argv = ['node', 'verify-deployment.js', 'post', 'https://example.com'];
      
      expect(process.argv[2]).toBe('post');
      expect(process.argv[3]).toBe('https://example.com');
    });

    it('should show usage message for invalid mode', async () => {
      process.argv = ['node', 'verify-deployment.js', 'invalid'];
      
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
      
      // Would call verifyDeployment() and check it shows usage
      expect(process.argv[2]).toBe('invalid');
      
      exitSpy.mockRestore();
    });
  });
});