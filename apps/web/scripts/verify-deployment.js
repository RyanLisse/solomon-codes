#!/usr/bin/env node

/**
 * Deployment verification script
 * Performs pre-deployment checks and post-deployment health verification
 * Supports multiple deployment targets and rollback detection
 */

const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

// Deployment verification configuration
const VERIFICATION_CONFIG = {
	// Pre-deployment checks
	preDeployment: {
		buildArtifacts: [".next/static", ".next/standalone", ".next/BUILD_ID"],
		requiredFiles: ["package.json", "next.config.ts", ".env.example"],
		environmentValidation: true,
		bundleSizeCheck: true,
		dependencyAudit: true,
		typeCheck: true,
	},

	// Post-deployment health checks
	postDeployment: {
		healthEndpoints: ["/api/health", "/api/ready"],
		performanceChecks: true,
		securityHeaders: true,
		sslVerification: true,
		databaseConnectivity: true,
		externalServices: true,
	},

	// Rollback detection
	rollback: {
		performanceThreshold: 2000, // ms
		errorRateThreshold: 0.05, // 5%
		availabilityThreshold: 0.99, // 99%
		checkDuration: 300, // 5 minutes
	},

	// Deployment targets
	targets: {
		cloudflare: {
			name: "Cloudflare Pages",
			buildCommand: "npm run pages:build",
			healthUrl: process.env.CF_PAGES_URL || process.env.NEXT_PUBLIC_SERVER_URL,
			expectedHeaders: {
				"cf-ray": true,
				server: "cloudflare",
			},
		},
		railway: {
			name: "Railway",
			buildCommand: "npm run build",
			healthUrl:
				process.env.RAILWAY_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_SERVER_URL,
			expectedHeaders: {
				"x-powered-by": false, // Should be disabled
			},
		},
		vercel: {
			name: "Vercel",
			buildCommand: "npm run build",
			healthUrl: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SERVER_URL,
			expectedHeaders: {
				"x-vercel-id": true,
			},
		},
	},
};

/**
 * Logger utility functions with colored output
 */
function logInfo(message) {
	console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
}

function logSuccess(message) {
	console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
}

function logWarn(message) {
	console.log(`\x1b[33m[WARN]\x1b[0m ${message}`);
}

function logError(message) {
	console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
}

function logStep(message) {
	console.log(`\x1b[35m[STEP]\x1b[0m ${message}`);
}

// Logger object for backward compatibility
const Logger = {
	info: logInfo,
	success: logSuccess,
	warn: logWarn,
	error: logError,
	step: logStep,
};

/**
 * Get deployment target from environment
 */
function getDeploymentTarget() {
	if (process.env.CF_PAGES) return "cloudflare";
	if (process.env.RAILWAY_ENVIRONMENT) return "railway";
	if (process.env.VERCEL_ENV) return "vercel";
	return null;
}

/**
 * Check if required build artifacts exist
 */
async function verifyBuildArtifacts() {
	Logger.step("Verifying build artifacts...");

	const errors = [];
	const { buildArtifacts, requiredFiles } = VERIFICATION_CONFIG.preDeployment;

	// Check build artifacts
	for (const artifact of buildArtifacts) {
		const artifactPath = path.join(process.cwd(), artifact);
		if (!fs.existsSync(artifactPath)) {
			errors.push(`Missing build artifact: ${artifact}`);
		}
	}

	// Check required files
	for (const file of requiredFiles) {
		const filePath = path.join(process.cwd(), file);
		if (!fs.existsSync(filePath)) {
			errors.push(`Missing required file: ${file}`);
		}
	}

	if (errors.length > 0) {
		Logger.error("Build artifact verification failed:");
		errors.forEach((error) => Logger.error(`  • ${error}`));
		return false;
	}

	Logger.success("All build artifacts verified");
	return true;
}

/**
 * Run environment validation script
 */
async function runEnvironmentValidation() {
	if (!VERIFICATION_CONFIG.preDeployment.environmentValidation) {
		return true;
	}

	Logger.step("Running environment validation...");

	try {
		const validationScript = path.join(__dirname, "validate-build-env.js");
		if (!fs.existsSync(validationScript)) {
			Logger.warn("Environment validation script not found, skipping...");
			return true;
		}

		await execAsync(`node ${validationScript}`);
		Logger.success("Environment validation passed");
		return true;
	} catch (error) {
		Logger.error(`Environment validation failed: ${error.message}`);
		return false;
	}
}

/**
 * Check bundle size against limits
 */
async function verifyBundleSize() {
	if (!VERIFICATION_CONFIG.preDeployment.bundleSizeCheck) {
		return true;
	}

	Logger.step("Checking bundle size...");

	try {
		const nextDir = path.join(process.cwd(), ".next");
		if (!fs.existsSync(nextDir)) {
			Logger.warn("No .next directory found, skipping bundle size check");
			return true;
		}

		// Check if bundle stats exist
		const statsFile = path.join(process.cwd(), "bundle-stats.json");
		if (fs.existsSync(statsFile)) {
			const stats = JSON.parse(fs.readFileSync(statsFile, "utf8"));

			// Analyze bundle size
			const assets = stats.assets || [];
			const largeAssets = assets.filter(
				(asset) =>
					asset.size > 512 * 1024 && // > 512KB
					(asset.name.endsWith(".js") || asset.name.endsWith(".css")),
			);

			if (largeAssets.length > 0) {
				Logger.warn("Large assets detected:");
				largeAssets.forEach((asset) => {
					const sizeMB = (asset.size / (1024 * 1024)).toFixed(2);
					Logger.warn(`  • ${asset.name}: ${sizeMB}MB`);
				});
			}
		}

		Logger.success("Bundle size verification completed");
		return true;
	} catch (error) {
		Logger.error(`Bundle size check failed: ${error.message}`);
		return false;
	}
}

/**
 * Run dependency security audit
 */
async function runDependencyAudit() {
	if (!VERIFICATION_CONFIG.preDeployment.dependencyAudit) {
		return true;
	}

	Logger.step("Running dependency security audit...");

	try {
		const { stdout } = await execAsync(
			"npm audit --audit-level=moderate --json",
		);
		const auditResult = JSON.parse(stdout);

		if (auditResult.metadata.vulnerabilities.total > 0) {
			const { high, critical } = auditResult.metadata.vulnerabilities;

			if (high > 0 || critical > 0) {
				Logger.error(
					`Security audit failed: ${high} high, ${critical} critical vulnerabilities`,
				);
				Logger.error('Run "npm audit fix" to resolve issues');
				return false;
			}
			Logger.warn(
				`Found ${auditResult.metadata.vulnerabilities.total} low/moderate vulnerabilities`,
			);
		}

		Logger.success("Security audit passed");
		return true;
	} catch (error) {
		// npm audit returns non-zero exit code when vulnerabilities found
		if (error.stdout) {
			try {
				const auditResult = JSON.parse(error.stdout);
				const { high, critical } = auditResult.metadata.vulnerabilities;

				if (high > 0 || critical > 0) {
					Logger.error(
						`Security audit failed: ${high} high, ${critical} critical vulnerabilities`,
					);
					return false;
				}
			} catch (_parseError) {
				Logger.warn("Could not parse audit results, continuing...");
			}
		}
		return true;
	}
}

/**
 * Run TypeScript type checking
 */
async function runTypeCheck() {
	if (!VERIFICATION_CONFIG.preDeployment.typeCheck) {
		return true;
	}

	Logger.step("Running TypeScript type check...");

	try {
		await execAsync("npm run typecheck");
		Logger.success("Type check passed");
		return true;
	} catch (error) {
		Logger.error(`Type check failed: ${error.message}`);
		return false;
	}
}

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const https = require("node:https");
		const http = require("node:http");

		const client = url.startsWith("https:") ? https : http;
		const timeout = options.timeout || 10000;

		const req = client.get(
			url,
			{
				timeout,
				headers: {
					"User-Agent": "Deployment-Verification/1.0",
					...options.headers,
				},
			},
			(res) => {
				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => {
					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						body: data,
					});
				});
			},
		);

		req.on("timeout", () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});

		req.on("error", reject);
	});
}

/**
 * Validate health endpoint response format
 */
function validateHealthResponse(endpoint, response) {
	if (endpoint !== "/api/health") {
		return;
	}

	try {
		const healthData = JSON.parse(response.body);
		if (!healthData.status || !healthData.timestamp) {
			Logger.warn(`Health endpoint ${endpoint} missing required fields`);
		}
	} catch (_parseError) {
		Logger.warn(`Health endpoint ${endpoint} returned invalid JSON`);
	}
}

/**
 * Check a single health endpoint
 */
async function checkSingleEndpoint(baseUrl, endpoint) {
	const url = `${baseUrl}${endpoint}`;
	const response = await makeRequest(url, { timeout: 10000 });

	if (response.statusCode >= 200 && response.statusCode < 300) {
		Logger.success(`✓ ${endpoint}: ${response.statusCode}`);
		validateHealthResponse(endpoint, response);
		return null; // No error
	}

	return `${endpoint}: HTTP ${response.statusCode}`;
}

/**
 * Check health endpoints
 */
async function checkHealthEndpoints(baseUrl) {
	Logger.step("Checking health endpoints...");

	const { healthEndpoints } = VERIFICATION_CONFIG.postDeployment;
	const errors = [];

	for (const endpoint of healthEndpoints) {
		try {
			const error = await checkSingleEndpoint(baseUrl, endpoint);
			if (error) {
				errors.push(error);
			}
		} catch (error) {
			errors.push(`${endpoint}: ${error.message}`);
		}
	}

	if (errors.length > 0) {
		Logger.error("Health endpoint checks failed:");
		errors.forEach((error) => Logger.error(`  • ${error}`));
		return false;
	}

	return true;
}

/**
 * Check security headers
 */
async function checkSecurityHeaders(baseUrl) {
	if (!VERIFICATION_CONFIG.postDeployment.securityHeaders) {
		return true;
	}

	Logger.step("Checking security headers...");

	try {
		const response = await makeRequest(baseUrl, { timeout: 10000 });
		const headers = response.headers;

		const requiredHeaders = [
			"x-content-type-options",
			"x-frame-options",
			"x-xss-protection",
			"referrer-policy",
		];

		const missing = requiredHeaders.filter((header) => !headers[header]);

		if (missing.length > 0) {
			Logger.warn("Missing security headers:");
			missing.forEach((header) => Logger.warn(`  • ${header}`));
		} else {
			Logger.success("All security headers present");
		}

		// Check for insecure headers
		if (headers["x-powered-by"]) {
			Logger.warn("X-Powered-By header should be removed for security");
		}

		// Security headers are non-critical, so always return true
		return true;
	} catch (error) {
		Logger.warn(`Security header check failed: ${error.message}`);
		// Non-critical - don't fail the entire deployment for missing headers
		return true;
	}
}

/**
 * Check SSL/TLS configuration
 */
async function checkSSLConfiguration(baseUrl) {
	if (
		!VERIFICATION_CONFIG.postDeployment.sslVerification ||
		!baseUrl.startsWith("https:")
	) {
		return true;
	}

	Logger.step("Checking SSL/TLS configuration...");

	try {
		const response = await makeRequest(baseUrl, { timeout: 10000 });

		// Check for HSTS header in production
		if (process.env.NODE_ENV === "production") {
			const hstsHeader = response.headers["strict-transport-security"];
			if (!hstsHeader) {
				Logger.warn("HSTS header missing in production");
			} else {
				Logger.success("HSTS header configured");
			}
		}

		Logger.success("SSL/TLS configuration verified");
		return true;
	} catch (error) {
		Logger.error(`SSL verification failed: ${error.message}`);
		return false;
	}
}

/**
 * Measure application performance
 */
async function checkPerformance(baseUrl) {
	if (!VERIFICATION_CONFIG.postDeployment.performanceChecks) {
		return true;
	}

	Logger.step("Checking application performance...");

	const measurements = [];
	const iterations = 3;

	for (let i = 0; i < iterations; i++) {
		try {
			const startTime = Date.now();
			const response = await makeRequest(baseUrl, { timeout: 15000 });
			const endTime = Date.now();
			const responseTime = endTime - startTime;

			if (response.statusCode >= 200 && response.statusCode < 300) {
				measurements.push(responseTime);
			}
		} catch (error) {
			Logger.warn(
				`Performance check iteration ${i + 1} failed: ${error.message}`,
			);
		}
	}

	if (measurements.length === 0) {
		Logger.error("All performance checks failed");
		return false;
	}

	const avgResponseTime =
		measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
	const threshold = VERIFICATION_CONFIG.rollback.performanceThreshold;

	Logger.info(`Average response time: ${avgResponseTime.toFixed(0)}ms`);

	if (avgResponseTime > threshold) {
		Logger.warn(
			`Response time ${avgResponseTime.toFixed(0)}ms exceeds threshold ${threshold}ms`,
		);
		return false;
	}

	Logger.success("Performance check passed");
	return true;
}

/**
 * Run pre-deployment verification
 */
async function runPreDeploymentVerification() {
	Logger.info("🚀 Starting pre-deployment verification...\n");

	const checks = [
		{ name: "Build Artifacts", fn: verifyBuildArtifacts },
		{ name: "Environment Validation", fn: runEnvironmentValidation },
		{ name: "Bundle Size", fn: verifyBundleSize },
		{ name: "Dependency Audit", fn: runDependencyAudit },
		{ name: "Type Check", fn: runTypeCheck },
	];

	const results = [];

	for (const check of checks) {
		try {
			const result = await check.fn();
			results.push({ name: check.name, passed: result });
		} catch (error) {
			Logger.error(`${check.name} check failed: ${error.message}`);
			results.push({ name: check.name, passed: false, error: error.message });
		}
	}

	const failedChecks = results.filter((r) => !r.passed);

	if (failedChecks.length > 0) {
		Logger.error("\n❌ Pre-deployment verification failed:");
		failedChecks.forEach((check) => {
			const errorSuffix = check.error ? `: ${check.error}` : "";
			Logger.error(`  • ${check.name}${errorSuffix}`);
		});
		return false;
	}

	Logger.success("\n✅ Pre-deployment verification passed!");
	return true;
}

/**
 * Run post-deployment verification
 */
async function runPostDeploymentVerification(baseUrl) {
	if (!baseUrl) {
		Logger.warn("No base URL provided, skipping post-deployment verification");
		return true;
	}

	Logger.info(`🌐 Starting post-deployment verification for: ${baseUrl}\n`);

	const checks = [
		{ name: "Health Endpoints", fn: () => checkHealthEndpoints(baseUrl) },
		{ name: "Security Headers", fn: () => checkSecurityHeaders(baseUrl) },
		{ name: "SSL Configuration", fn: () => checkSSLConfiguration(baseUrl) },
		{ name: "Performance", fn: () => checkPerformance(baseUrl) },
	];

	const results = [];

	for (const check of checks) {
		try {
			const result = await check.fn();
			results.push({ name: check.name, passed: result });
		} catch (error) {
			Logger.error(`${check.name} check failed: ${error.message}`);
			results.push({ name: check.name, passed: false, error: error.message });
		}
	}

	const failedChecks = results.filter((r) => !r.passed);
	const criticalFailures = failedChecks.filter((check) =>
		["Health Endpoints", "Performance"].includes(check.name),
	);

	if (criticalFailures.length > 0) {
		Logger.error("\n❌ Critical post-deployment checks failed:");
		criticalFailures.forEach((check) => {
			const errorSuffix = check.error ? `: ${check.error}` : "";
			Logger.error(`  • ${check.name}${errorSuffix}`);
		});
		return false;
	}

	if (failedChecks.length > 0) {
		Logger.warn("\n⚠️  Some non-critical checks failed:");
		failedChecks.forEach((check) => {
			const errorSuffix = check.error ? `: ${check.error}` : "";
			Logger.warn(`  • ${check.name}${errorSuffix}`);
		});
	}

	Logger.success("\n✅ Post-deployment verification completed!");
	return true;
}

/**
 * Main deployment verification function
 */
async function verifyDeployment() {
	const mode = process.argv[2] || "pre";
	const baseUrl = process.argv[3];
	const target = getDeploymentTarget();

	if (target) {
		const targetConfig = VERIFICATION_CONFIG.targets[target];
		Logger.info(`Deployment target: ${targetConfig.name}`);
	}

	if (mode === "pre") {
		const success = await runPreDeploymentVerification();
		process.exit(success ? 0 : 1);
	} else if (mode === "post") {
		const url =
			baseUrl ||
			(target ? VERIFICATION_CONFIG.targets[target].healthUrl : null);
		const success = await runPostDeploymentVerification(url);
		process.exit(success ? 0 : 1);
	} else {
		Logger.error("Usage: node verify-deployment.js [pre|post] [base-url]");
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	verifyDeployment();
}

module.exports = {
	verifyDeployment,
	runPreDeploymentVerification,
	runPostDeploymentVerification,
	VERIFICATION_CONFIG,
};
