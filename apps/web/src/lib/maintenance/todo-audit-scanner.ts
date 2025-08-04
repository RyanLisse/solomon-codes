/**
 * Comprehensive TODO, FIXME, HACK, and NOTE scanner for production readiness
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createContextLogger } from "../logging/factory";
import { type TodoItem, todoTracker } from "./todo-tracker";

const logger = createContextLogger("todo-audit-scanner");

interface CodeIssue {
	type: "TODO" | "FIXME" | "HACK" | "NOTE" | "CONSOLE" | "TEMP" | "DEPRECATED";
	file: string;
	line: number;
	content: string;
	context: string[];
	priority: "low" | "medium" | "high" | "critical";
	description: string;
	tags: string[];
}

interface AuditResults {
	issues: CodeIssue[];
	statistics: {
		total: number;
		byType: Record<string, number>;
		byPriority: Record<string, number>;
		filesCovered: number;
		criticalBlocking: number;
	};
	productionReadiness: {
		blockers: CodeIssue[];
		highPriority: CodeIssue[];
		recommendations: string[];
	};
}

/**
 * Patterns to search for in the codebase
 */
const ISSUE_PATTERNS = [
	// TODO/FIXME/HACK/NOTE comments
	{
		pattern:
			/(?:\/\/|\/\*|\*|#)\s*(TODO|FIXME|HACK|XXX|TEMP|TEMPORARY|BUG|WARN)[\s:]*(.+?)(?:\*\/|$)/gi,
		types: ["TODO", "FIXME", "HACK", "NOTE", "TEMP", "DEPRECATED"],
	},
	// Console statements (potential debug code)
	{
		pattern: /console\.(log|warn|error|info|debug|trace)\s*\(/g,
		types: ["CONSOLE"],
	},
	// TypeScript ignore comments (potential code smells)
	{
		pattern: /@ts-(ignore|nocheck|expect-error)(?:\s+(.+?))?$/gm,
		types: ["NOTE"],
	},
	// ESLint disable comments
	{
		pattern: /eslint-disable(-next-line)?\s+(.+)/g,
		types: ["NOTE"],
	},
	// Development/temporary markers
	{
		pattern:
			/(dev-only|development-only|remove-before-prod|temporary|deprecated|legacy)/gi,
		types: ["TEMP", "DEPRECATED"],
	},
];

/**
 * File extensions to scan
 */
const SCANNABLE_EXTENSIONS = [
	".js",
	".jsx",
	".ts",
	".tsx",
	".json",
	".md",
	".yml",
	".yaml",
	".env",
];

/**
 * Directories to exclude from scanning
 */
const EXCLUDED_DIRS = [
	"node_modules",
	"dist",
	"build",
	".next",
	".git",
	".vscode",
	"coverage",
];

/**
 * Determine priority based on issue type and context
 */
function determinePriority(
	type: string,
	content: string,
	filePath: string,
): "low" | "medium" | "high" | "critical" {
	const lowerContent = content.toLowerCase();
	const isProductionFile =
		filePath.includes("production") || filePath.includes("deploy");

	// Critical issues that block production
	if (
		lowerContent.includes("critical") ||
		lowerContent.includes("security") ||
		lowerContent.includes("auth") ||
		lowerContent.includes("break") ||
		(type === "FIXME" && isProductionFile) ||
		lowerContent.includes("remove before prod")
	) {
		return "critical";
	}

	// High priority issues
	if (
		type === "FIXME" ||
		lowerContent.includes("important") ||
		lowerContent.includes("urgent") ||
		lowerContent.includes("asap") ||
		lowerContent.includes("must") ||
		(type === "CONSOLE" && isProductionFile) ||
		lowerContent.includes("performance") ||
		lowerContent.includes("memory")
	) {
		return "high";
	}

	// Medium priority issues
	if (
		type === "HACK" ||
		type === "TEMP" ||
		type === "DEPRECATED" ||
		lowerContent.includes("improve") ||
		lowerContent.includes("optimize") ||
		lowerContent.includes("refactor")
	) {
		return "medium";
	}

	// Low priority by default
	return "low";
}

/**
 * Extract tags from issue content
 */
function extractTags(content: string, filePath: string): string[] {
	const tags: string[] = [];

	// File-based tags
	if (filePath.includes("/auth/")) tags.push("auth");
	if (filePath.includes("/api/")) tags.push("api");
	if (filePath.includes("/database/")) tags.push("database");
	if (filePath.includes("/config/")) tags.push("config");
	if (filePath.includes("/telemetry/")) tags.push("telemetry");
	if (filePath.includes("/logging/")) tags.push("logging");
	if (filePath.includes("/mock/")) tags.push("mock", "development");
	if (filePath.includes(".test.")) tags.push("test");

	// Content-based tags
	const lowerContent = content.toLowerCase();
	if (lowerContent.includes("security")) tags.push("security");
	if (lowerContent.includes("performance")) tags.push("performance");
	if (lowerContent.includes("memory")) tags.push("memory");
	if (lowerContent.includes("async")) tags.push("async");
	if (lowerContent.includes("error")) tags.push("error-handling");
	if (lowerContent.includes("config")) tags.push("configuration");
	if (lowerContent.includes("deploy")) tags.push("deployment");
	if (lowerContent.includes("production")) tags.push("production");

	return tags;
}

/**
 * Scan a single file for issues
 */
async function scanFile(
	filePath: string,
	rootPath: string,
): Promise<CodeIssue[]> {
	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");
		const relativePath = relative(rootPath, filePath);
		const issues: CodeIssue[] = [];

		for (const patternConfig of ISSUE_PATTERNS) {
			const { pattern, types } = patternConfig;
			let match = pattern.exec(content);
			while (match !== null) {
				const matchIndex = match.index;
				const lineNumber = content.substring(0, matchIndex).split("\n").length;
				const matchedType = match[1]?.toUpperCase() || types[0];
				const description = match[2]?.trim() || match[0];

				// Get context lines
				const contextStart = Math.max(0, lineNumber - 2);
				const contextEnd = Math.min(lines.length, lineNumber + 2);
				const context = lines.slice(contextStart, contextEnd);

				const priority = determinePriority(
					matchedType,
					description,
					relativePath,
				);
				const tags = extractTags(description, relativePath);

				issues.push({
					type: matchedType as CodeIssue["type"],
					file: relativePath,
					line: lineNumber,
					content: match[0],
					context,
					priority,
					description: description || match[0],
					tags,
				});

				match = pattern.exec(content);
			}
		}

		return issues;
	} catch (error) {
		logger.warn("Failed to scan file", {
			filePath,
			error: error instanceof Error ? error : String(error),
		});
		return [];
	}
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(
	dirPath: string,
	rootPath: string,
): Promise<string[]> {
	const files: string[] = [];

	try {
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);

			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRS.includes(entry.name)) {
					const subFiles = await scanDirectory(fullPath, rootPath);
					files.push(...subFiles);
				}
			} else if (entry.isFile()) {
				const ext = entry.name.substring(entry.name.lastIndexOf("."));
				if (SCANNABLE_EXTENSIONS.includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	} catch (error) {
		logger.warn("Failed to scan directory", {
			dirPath,
			error: error instanceof Error ? error : String(error),
		});
	}

	return files;
}

/**
 * Run comprehensive audit of the codebase
 */
export async function runTodoAudit(
	rootPath: string = process.cwd(),
): Promise<AuditResults> {
	logger.info("Starting comprehensive TODO audit", { rootPath });

	// Scan all files
	const files = await scanDirectory(rootPath, rootPath);
	logger.info("Found files to scan", { count: files.length });

	const allIssues: CodeIssue[] = [];

	// Scan each file
	for (const file of files) {
		const issues = await scanFile(file, rootPath);
		allIssues.push(...issues);
	}

	// Calculate statistics
	const statistics = {
		total: allIssues.length,
		byType: {} as Record<string, number>,
		byPriority: {} as Record<string, number>,
		filesCovered: files.length,
		criticalBlocking: allIssues.filter((i) => i.priority === "critical").length,
	};

	for (const issue of allIssues) {
		statistics.byType[issue.type] = (statistics.byType[issue.type] || 0) + 1;
		statistics.byPriority[issue.priority] =
			(statistics.byPriority[issue.priority] || 0) + 1;
	}

	// Identify production readiness issues
	const blockers = allIssues.filter((i) => i.priority === "critical");
	const highPriority = allIssues.filter((i) => i.priority === "high");

	const recommendations: string[] = [];

	if (blockers.length > 0) {
		recommendations.push(
			`Resolve ${blockers.length} critical issues that block production deployment`,
		);
	}

	if (highPriority.length > 0) {
		recommendations.push(
			`Address ${highPriority.length} high priority issues before production`,
		);
	}

	const consoleIssues = allIssues.filter((i) => i.type === "CONSOLE");
	if (consoleIssues.length > 0) {
		recommendations.push(
			`Remove or replace ${consoleIssues.length} console statements with proper logging`,
		);
	}

	const hackIssues = allIssues.filter((i) => i.type === "HACK");
	if (hackIssues.length > 0) {
		recommendations.push(
			`Replace ${hackIssues.length} temporary hacks with permanent solutions`,
		);
	}

	const tempIssues = allIssues.filter((i) => i.type === "TEMP");
	if (tempIssues.length > 0) {
		recommendations.push(
			`Implement ${tempIssues.length} temporary solutions permanently`,
		);
	}

	if (allIssues.length === 0) {
		recommendations.push(
			"✅ No TODO/FIXME issues found - codebase appears production ready",
		);
	}

	const results: AuditResults = {
		issues: allIssues,
		statistics,
		productionReadiness: {
			blockers,
			highPriority,
			recommendations,
		},
	};

	logger.info("TODO audit completed", {
		totalIssues: allIssues.length,
		criticalBlockers: blockers.length,
		highPriority: highPriority.length,
	});

	return results;
}

/**
 * Register audit results with TodoTracker
 */
export function registerAuditResults(results: AuditResults): void {
	logger.info("Registering audit results with TodoTracker");

	for (const issue of results.issues) {
		// Skip console statements in specific allowed files
		if (
			issue.type === "CONSOLE" &&
			isAllowedConsoleUsage(issue.file, issue.description)
		) {
			continue;
		}

		try {
			todoTracker.registerTodo({
				type:
					issue.type === "CONSOLE" ? "NOTE" : (issue.type as TodoItem["type"]),
				description: issue.description,
				file: issue.file,
				line: issue.line,
				priority: issue.priority,
				tags: issue.tags,
			});
		} catch (error) {
			logger.warn("Failed to register TODO item", {
				issue,
				error: error instanceof Error ? error : String(error),
			});
		}
	}

	logger.info("Audit results registered with TodoTracker", {
		registered: results.issues.length,
	});
}

/**
 * Check if console usage is allowed in specific contexts
 */
function isAllowedConsoleUsage(filePath: string, content: string): boolean {
	// Allow console in specific contexts
	const allowedPatterns = [
		// Configuration and startup logging (critical for debugging deployment issues)
		filePath.includes("/config/") && content.includes("Configuration"),
		filePath.includes("/startup") && content.includes("startup"),
		// Error handling where console is used as fallback
		content.includes("fallback") || content.includes("critical"),
		// Development-only logging utilities
		filePath.includes("/mock/") || filePath.includes("/features/environment"),
		// Test files
		filePath.includes(".test.") || filePath.includes("/test/"),
	];

	return allowedPatterns.some((pattern) => pattern);
}

/**
 * Generate production readiness report
 */
export function generateProductionReadinessReport(
	results: AuditResults,
): string {
	const { statistics, productionReadiness } = results;

	let report = "# Production Readiness Assessment\n\n";
	report += `Generated: ${new Date().toISOString()}\n\n`;

	// Executive Summary
	report += "## Executive Summary\n\n";

	if (productionReadiness.blockers.length === 0) {
		report += "✅ **PRODUCTION READY** - No critical blockers found\n\n";
	} else {
		report += `❌ **NOT PRODUCTION READY** - ${productionReadiness.blockers.length} critical blockers must be resolved\n\n`;
	}

	// Statistics
	report += "## Audit Statistics\n\n";
	report += `- **Total Issues Found:** ${statistics.total}\n`;
	report += `- **Files Scanned:** ${statistics.filesCovered}\n`;
	report += `- **Critical Blockers:** ${statistics.criticalBlocking}\n\n`;

	report += "### Issues by Type\n";
	for (const [type, count] of Object.entries(statistics.byType)) {
		report += `- **${type}:** ${count}\n`;
	}
	report += "\n";

	report += "### Issues by Priority\n";
	for (const [priority, count] of Object.entries(statistics.byPriority)) {
		const emoji =
			priority === "critical"
				? "🔴"
				: priority === "high"
					? "🟡"
					: priority === "medium"
						? "🟠"
						: "🟢";
		report += `- ${emoji} **${priority.toUpperCase()}:** ${count}\n`;
	}
	report += "\n";

	// Critical Blockers
	if (productionReadiness.blockers.length > 0) {
		report += "## 🔴 Critical Blockers (Must Fix Before Production)\n\n";
		for (const blocker of productionReadiness.blockers) {
			report += `### ${blocker.type}: ${blocker.description}\n`;
			report += `- **File:** \`${blocker.file}:${blocker.line}\`\n`;
			report += `- **Tags:** ${blocker.tags.join(", ")}\n`;
			report += `- **Content:** \`${blocker.content}\`\n\n`;
		}
	}

	// High Priority Issues
	if (productionReadiness.highPriority.length > 0) {
		report += "## 🟡 High Priority Issues (Should Fix Before Production)\n\n";
		for (const issue of productionReadiness.highPriority.slice(0, 10)) {
			// Limit to first 10
			report += `### ${issue.type}: ${issue.description}\n`;
			report += `- **File:** \`${issue.file}:${issue.line}\`\n`;
			report += `- **Tags:** ${issue.tags.join(", ")}\n\n`;
		}

		if (productionReadiness.highPriority.length > 10) {
			report += `... and ${productionReadiness.highPriority.length - 10} more high priority issues.\n\n`;
		}
	}

	// Recommendations
	report += "## Recommendations\n\n";
	for (const recommendation of productionReadiness.recommendations) {
		report += `- ${recommendation}\n`;
	}

	// Action Plan
	report += "\n## Action Plan\n\n";

	if (productionReadiness.blockers.length > 0) {
		report += "### Immediate Actions (Critical)\n";
		report += "1. Fix all critical blockers listed above\n";
		report += "2. Review security-related TODOs and FIXMEs\n";
		report += "3. Remove or implement temporary hacks in production code\n";
		report += "4. Replace console statements with proper logging\n\n";
	}

	if (productionReadiness.highPriority.length > 0) {
		report += "### Short-term Actions (High Priority)\n";
		report += "1. Address high priority FIXMEs and performance issues\n";
		report += "2. Complete incomplete features marked with TODOs\n";
		report += "3. Review and clean up development-only code\n\n";
	}

	report += "### Long-term Actions\n";
	report += "1. Implement automated TODO tracking in CI/CD pipeline\n";
	report += "2. Set up pre-commit hooks to prevent new critical TODOs\n";
	report +=
		"3. Regular code review process to address medium/low priority items\n";
	report += "4. Documentation for any remaining temporary solutions\n\n";

	return report;
}
