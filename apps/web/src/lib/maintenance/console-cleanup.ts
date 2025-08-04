/**
 * Console cleanup utility for production readiness
 * Identifies and helps fix console statements that should use proper logging
 */

import { createServerLogger } from "../logging/server";

const logger = createServerLogger({ serviceName: "console-cleanup" });

/**
 * Files where console usage is intentionally allowed for critical debugging
 */
const ALLOWED_CONSOLE_FILES = new Set([
	// Configuration files where console is used for critical startup logging
	"/lib/config/service.ts",
	"/lib/config/startup.ts",
	"/lib/config/index.ts",
	"/lib/config/validation.ts",
	"/lib/config/secure.ts",

	// Telemetry initialization (needs console for bootstrap debugging)
	"/lib/telemetry/index.ts",

	// Mock and development utilities
	"/lib/mock/build-exclusion.ts",
	"/lib/features/environment.ts",

	// Database connection notices (temporary for debugging deployment)
	"/lib/database/connection.ts",

	// Test files
	".test.ts",
	".test.js",
	".test.tsx",
	".test.jsx",
]);

/**
 * Console statements that should be replaced with proper logging
 */
export interface ConsoleIssue {
	file: string;
	line: number;
	type: "log" | "warn" | "error" | "info" | "debug";
	content: string;
	suggestion: string;
	priority: "high" | "medium" | "low";
}

/**
 * Analyze console usage and provide replacement suggestions
 */
export function analyzeConsoleUsage(
	filePath: string,
	content: string,
): ConsoleIssue[] {
	const issues: ConsoleIssue[] = [];

	// Skip allowed files
	if (
		ALLOWED_CONSOLE_FILES.has(filePath) ||
		[...ALLOWED_CONSOLE_FILES].some((allowed) => filePath.includes(allowed))
	) {
		return issues;
	}

	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const consoleMatch = line.match(
			/console\.(log|warn|error|info|debug)\s*\(/,
		);

		if (consoleMatch) {
			const type = consoleMatch[1] as ConsoleIssue["type"];
			const lineNumber = i + 1;

			let suggestion = "";
			let priority: ConsoleIssue["priority"] = "medium";

			// Determine appropriate logging replacement
			switch (type) {
				case "error":
					suggestion = "Replace with logger.error() for proper error tracking";
					priority = "high";
					break;
				case "warn":
					suggestion = "Replace with logger.warn() for proper warning tracking";
					priority = "high";
					break;
				case "info":
					suggestion = "Replace with logger.info() for structured logging";
					priority = "medium";
					break;
				case "log":
					if (
						line.includes("debug") ||
						line.includes("Dev") ||
						line.includes("development")
					) {
						suggestion = "Replace with logger.debug() for development logging";
						priority = "low";
					} else {
						suggestion = "Replace with logger.info() for structured logging";
						priority = "medium";
					}
					break;
				case "debug":
					suggestion = "Replace with logger.debug() for proper debug logging";
					priority = "low";
					break;
			}

			// Check for specific patterns that indicate debugging code
			if (
				line.includes("isAuthenticated") ||
				line.includes("mock") ||
				line.includes("sandbox")
			) {
				priority = "low";
				suggestion += " (appears to be debug/development code)";
			}

			issues.push({
				file: filePath,
				line: lineNumber,
				type,
				content: line.trim(),
				suggestion,
				priority,
			});
		}
	}

	return issues;
}

/**
 * Generate replacement code for console statements
 */
export function generateLoggingReplacement(issue: ConsoleIssue): string {
	const { type, content } = issue;

	// Extract the arguments from console statement
	const argsMatch = content.match(/console\.\w+\s*\((.+)\)$/);
	const args = argsMatch ? argsMatch[1] : '""';

	// Generate appropriate logger call
	const loggerMethod = type === "log" ? "info" : type;

	return `logger.${loggerMethod}(${args})`;
}

/**
 * Console cleanup recommendations for specific files
 */
export const CONSOLE_CLEANUP_PLAN = {
	"/hooks/use-github-auth.ts": {
		priority: "high",
		actions: [
			"Replace console.error calls with logger.error for proper error tracking",
			"Remove debug console.log statement or replace with logger.debug",
			"Add proper error context to logging statements",
		],
	},

	"/app/actions/vibekit.ts": {
		priority: "medium",
		actions: [
			"Replace console.log with logger.info for sandbox selection logging",
			"Replace console.warn with logger.warn for fallback scenarios",
			"Replace console.error with logger.error for VibeKit failures",
			"Add structured logging with context (taskId, sandbox type, etc.)",
		],
	},

	"/lib/database/query-service.ts": {
		priority: "medium",
		actions: [
			"Replace console.warn with logger.warn for slow query detection",
			"Replace console.log with logger.info for bulk operation logging",
			"Replace console.error with logger.error for operation failures",
			"Add query performance metrics to structured logging",
		],
	},
};

/**
 * Generate action items for console cleanup
 */
export function generateConsoleCleanupReport(): string {
	let report = "# Console Statement Cleanup Plan\n\n";
	report += `Generated: ${new Date().toISOString()}\n\n`;

	report += "## Overview\n\n";
	report +=
		"This report identifies console statements that should be replaced with proper structured logging for production readiness.\n\n";

	report += "## Files Requiring Cleanup\n\n";

	for (const [filePath, plan] of Object.entries(CONSOLE_CLEANUP_PLAN)) {
		report += `### ${filePath}\n`;
		report += `**Priority:** ${plan.priority}\n\n`;
		report += "**Actions needed:**\n";
		for (const action of plan.actions) {
			report += `- ${action}\n`;
		}
		report += "\n";
	}

	report += "## Implementation Guidelines\n\n";
	report +=
		"1. **Import logging:** Add `import { createContextLogger } from '@/lib/logging/factory';`\n";
	report +=
		"2. **Create logger:** Add `const logger = createContextLogger('component-name');`\n";
	report +=
		"3. **Replace calls:** Use appropriate logger method (error, warn, info, debug)\n";
	report += "4. **Add context:** Include relevant metadata in logging calls\n";
	report +=
		"5. **Test thoroughly:** Ensure logging works in all environments\n\n";

	report += "## Allowed Console Usage\n\n";
	report += "Console statements are intentionally allowed in:\n";
	for (const allowedFile of ALLOWED_CONSOLE_FILES) {
		report += `- ${allowedFile}\n`;
	}
	report +=
		"\nThese files use console for critical startup/configuration debugging.\n\n";

	return report;
}

logger.info("Console cleanup utility loaded", {
	allowedFiles: ALLOWED_CONSOLE_FILES.size,
	cleanupPlans: Object.keys(CONSOLE_CLEANUP_PLAN).length,
});
