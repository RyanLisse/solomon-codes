#!/usr/bin/env node
/**
 * Production readiness audit script for identifying code issues
 * Runs without dependencies on the application configuration system
 */

const fs = require("node:fs").promises;
const path = require("node:path");

// Patterns to search for in the codebase
// eslint-disable-next-line radarlint-js:javascript:S1135 -- Intentional pattern for audit script
const ISSUE_PATTERNS = [
	{
		// This regex pattern intentionally contains keywords for audit purposes
		pattern:
			/(?:\/\/|\/\*|\*|#)\s*(TODO|FIXME|HACK|XXX|TEMP|TEMPORARY|BUG|WARN)[\s:]*(.+?)(?:\*\/|$)/gi,
		types: ["TODO", "FIXME", "HACK", "NOTE", "TEMP", "DEPRECATED"],
	},
	{
		pattern: /console\.(log|warn|error|info|debug|trace)\s*\(/g,
		types: ["CONSOLE"],
	},
	{
		pattern: /@ts-(ignore|nocheck|expect-error)(?:\s+(.+?))?$/gm,
		types: ["NOTE"],
	},
	{
		pattern: /eslint-disable(-next-line)?\s+(.+)/g,
		types: ["NOTE"],
	},
	{
		pattern:
			/(dev-only|development-only|remove-before-prod|temporary|deprecated|legacy)/gi,
		types: ["TEMP", "DEPRECATED"],
	},
];

const SCANNABLE_EXTENSIONS = [
	".js",
	".jsx",
	".ts",
	".tsx",
	".json",
	".md",
	".yml",
	".yaml",
];

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
 * Checks if content contains critical security keywords
 */
function hasCriticalSecurityKeywords(lowerContent) {
	return (
		lowerContent.includes("critical") ||
		lowerContent.includes("security") ||
		lowerContent.includes("auth")
	);
}

/**
 * Checks if content contains critical blocking keywords
 */
function hasCriticalBlockingKeywords(lowerContent) {
	return (
		lowerContent.includes("break") ||
		lowerContent.includes("remove before prod")
	);
}

/**
 * Checks if content contains critical security or blocking keywords
 */
function isCriticalIssue(lowerContent, type, isProductionFile) {
	return (
		hasCriticalSecurityKeywords(lowerContent) ||
		hasCriticalBlockingKeywords(lowerContent) ||
		(type === "FIXME" && isProductionFile)
	);
}

/**
 * Checks if content contains high priority urgency keywords
 */
function hasUrgencyKeywords(lowerContent) {
	return (
		lowerContent.includes("important") ||
		lowerContent.includes("urgent") ||
		lowerContent.includes("asap") ||
		lowerContent.includes("must")
	);
}

/**
 * Checks if content contains performance-related keywords
 */
function hasPerformanceKeywords(lowerContent) {
	return (
		lowerContent.includes("performance") || lowerContent.includes("memory")
	);
}

/**
 * Checks if content contains high priority keywords
 */
function isHighPriorityIssue(lowerContent, type, isProductionFile) {
	return (
		type === "FIXME" ||
		hasUrgencyKeywords(lowerContent) ||
		(type === "CONSOLE" && isProductionFile) ||
		hasPerformanceKeywords(lowerContent)
	);
}

/**
 * Checks if type indicates temporary or legacy code
 */
function isTemporaryOrLegacyType(type) {
	return type === "HACK" || type === "TEMP" || type === "DEPRECATED";
}

/**
 * Checks if content contains improvement-related keywords
 */
function hasImprovementKeywords(lowerContent) {
	return (
		lowerContent.includes("improve") ||
		lowerContent.includes("optimize") ||
		lowerContent.includes("refactor")
	);
}

/**
 * Checks if content contains medium priority keywords
 */
function isMediumPriorityIssue(lowerContent, type) {
	return isTemporaryOrLegacyType(type) || hasImprovementKeywords(lowerContent);
}

function determinePriority(type, content, filePath) {
	const lowerContent = content.toLowerCase();
	const isProductionFile =
		filePath.includes("production") || filePath.includes("deploy");

	// Critical issues that block production
	if (isCriticalIssue(lowerContent, type, isProductionFile)) {
		return "critical";
	}

	// High priority issues
	if (isHighPriorityIssue(lowerContent, type, isProductionFile)) {
		return "high";
	}

	// Medium priority issues
	if (isMediumPriorityIssue(lowerContent, type)) {
		return "medium";
	}

	return "low";
}

function extractTags(content, filePath) {
	const tags = [];

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
 * Checks if console usage is in configuration or startup context
 */
function isConfigurationOrStartupLogging(filePath, content) {
	return (
		(filePath.includes("/config/") && content.includes("Configuration")) ||
		(filePath.includes("/startup") && content.includes("startup"))
	);
}

/**
 * Checks if console usage is for error handling fallback
 */
function isErrorHandlingFallback(content) {
	return content.includes("fallback") || content.includes("critical");
}

/**
 * Checks if file is development or test related
 */
function isDevelopmentOrTestFile(filePath) {
	return (
		filePath.includes("/mock/") ||
		filePath.includes("/features/environment") ||
		filePath.includes(".test.") ||
		filePath.includes("/test/")
	);
}

function isAllowedConsoleUsage(filePath, content) {
	// Allow console in specific contexts
	return (
		// Configuration and startup logging (critical for debugging deployment issues)
		isConfigurationOrStartupLogging(filePath, content) ||
		// Error handling where console is used as fallback
		isErrorHandlingFallback(content) ||
		// Development-only logging utilities
		isDevelopmentOrTestFile(filePath)
	);
}

async function scanFile(filePath, rootPath) {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		const lines = content.split("\n");
		const relativePath = path.relative(rootPath, filePath);
		const issues = [];

		for (const patternConfig of ISSUE_PATTERNS) {
			const { pattern, types } = patternConfig;
			pattern.lastIndex = 0; // Reset regex
			let match;

			match = pattern.exec(content);
			while (match !== null) {
				const matchIndex = match.index;
				const lineNumber = content.substring(0, matchIndex).split("\n").length;
				const matchedType = match[1]?.toUpperCase() || types[0];
				const description = match[2]?.trim() || match[0];

				// Skip allowed console usage
				if (
					matchedType === "CONSOLE" &&
					isAllowedConsoleUsage(relativePath, content)
				) {
					continue;
				}

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
					type: matchedType,
					file: relativePath,
					line: lineNumber,
					content: match[0],
					context,
					priority,
					description: description || match[0],
					tags,
				});

				// Get next match
				match = pattern.exec(content);
			}
		}

		return issues;
	} catch (error) {
		console.warn(`Failed to scan file ${filePath}:`, error.message);
		return [];
	}
}

async function scanDirectory(dirPath, rootPath) {
	const files = [];

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);

			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRS.includes(entry.name)) {
					const subFiles = await scanDirectory(fullPath, rootPath);
					files.push(...subFiles);
				}
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name);
				if (SCANNABLE_EXTENSIONS.includes(ext)) {
					files.push(fullPath);
				}
			}
		}
	} catch (error) {
		console.warn(`Failed to scan directory ${dirPath}:`, error.message);
	}

	return files;
}

async function runTodoAudit(rootPath) {
	console.log("🔍 Starting comprehensive TODO audit for production readiness");
	console.log(`📁 Scanning: ${rootPath}`);

	// Scan all files
	const files = await scanDirectory(rootPath, rootPath);
	console.log(`📊 Found ${files.length} files to scan`);

	const allIssues = [];

	// Scan each file
	for (const file of files) {
		const issues = await scanFile(file, rootPath);
		allIssues.push(...issues);
	}

	// Calculate statistics
	const statistics = {
		total: allIssues.length,
		byType: {},
		byPriority: {},
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

	const recommendations = [];

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

	return {
		issues: allIssues,
		statistics,
		productionReadiness: {
			blockers,
			highPriority,
			recommendations,
		},
	};
}

/**
 * Generates the report header with title and timestamp
 */
function generateReportHeader() {
	let report = "# Production Readiness Assessment\n\n";
	report += `Generated: ${new Date().toISOString()}\n\n`;
	return report;
}

/**
 * Generates the executive summary section
 */
function generateExecutiveSummary(productionReadiness) {
	let section = "## Executive Summary\n\n";

	if (productionReadiness.blockers.length === 0) {
		section += "✅ **PRODUCTION READY** - No critical blockers found\n\n";
	} else {
		section += `❌ **NOT PRODUCTION READY** - ${productionReadiness.blockers.length} critical blockers must be resolved\n\n`;
	}

	return section;
}

/**
 * Generates the audit statistics section
 */
function generateAuditStatistics(statistics) {
	let section = "## Audit Statistics\n\n";
	section += `- **Total Issues Found:** ${statistics.total}\n`;
	section += `- **Files Scanned:** ${statistics.filesCovered}\n`;
	section += `- **Critical Blockers:** ${statistics.criticalBlocking}\n\n`;

	section += "### Issues by Type\n";
	for (const [type, count] of Object.entries(statistics.byType)) {
		section += `- **${type}:** ${count}\n`;
	}
	section += "\n";

	section += "### Issues by Priority\n";
	for (const [priority, count] of Object.entries(statistics.byPriority)) {
		const emoji = getPriorityEmoji(priority);
		section += `- ${emoji} **${priority.toUpperCase()}:** ${count}\n`;
	}
	section += "\n";

	return section;
}

/**
 * Gets the appropriate emoji for a priority level
 */
function getPriorityEmoji(priority) {
	const emojiMap = {
		critical: "🔴",
		high: "🟡",
		medium: "🟠",
		low: "🟢",
	};
	return emojiMap[priority] || "🟢";
}

/**
 * Generates the critical blockers section
 */
function generateCriticalBlockersSection(blockers) {
	if (blockers.length === 0) {
		return "";
	}

	let section = "## 🔴 Critical Blockers (Must Fix Before Production)\n\n";
	for (const blocker of blockers) {
		section += `### ${blocker.type}: ${blocker.description}\n`;
		section += `- **File:** \`${blocker.file}:${blocker.line}\`\n`;
		section += `- **Tags:** ${blocker.tags.join(", ")}\n`;
		section += `- **Content:** \`${blocker.content}\`\n\n`;
	}
	return section;
}

/**
 * Generates the high priority issues section
 */
function generateHighPrioritySection(highPriority) {
	if (highPriority.length === 0) {
		return "";
	}

	let section = "## 🟡 High Priority Issues (Should Fix Before Production)\n\n";
	for (const issue of highPriority.slice(0, 10)) {
		section += `### ${issue.type}: ${issue.description}\n`;
		section += `- **File:** \`${issue.file}:${issue.line}\`\n`;
		section += `- **Tags:** ${issue.tags.join(", ")}\n\n`;
	}

	if (highPriority.length > 10) {
		section += `... and ${highPriority.length - 10} more high priority issues.\n\n`;
	}

	return section;
}

/**
 * Generates the recommendations section
 */
function generateRecommendationsSection(recommendations) {
	let section = "## Recommendations\n\n";
	for (const recommendation of recommendations) {
		section += `- ${recommendation}\n`;
	}
	return section;
}

/**
 * Generates the action plan section
 */
function generateActionPlanSection(productionReadiness) {
	let section = "\n## Action Plan\n\n";

	if (productionReadiness.blockers.length > 0) {
		section += "### Immediate Actions (Critical)\n";
		section += "1. Fix all critical blockers listed above\n";
		section += "2. Review security-related TODOs and FIXMEs\n";
		section += "3. Remove or implement temporary hacks in production code\n";
		section += "4. Replace console statements with proper logging\n\n";
	}

	if (productionReadiness.highPriority.length > 0) {
		section += "### Short-term Actions (High Priority)\n";
		section += "1. Address high priority FIXMEs and performance issues\n";
		section += "2. Complete incomplete features marked with TODOs\n";
		section += "3. Review and clean up development-only code\n\n";
	}

	section += "### Long-term Actions\n";
	section += "1. Implement automated TODO tracking in CI/CD pipeline\n";
	section += "2. Set up pre-commit hooks to prevent new critical TODOs\n";
	section +=
		"3. Regular code review process to address medium/low priority items\n";
	section += "4. Documentation for any remaining temporary solutions\n\n";

	return section;
}

function generateProductionReadinessReport(results) {
	const { statistics, productionReadiness } = results;

	let report = "";
	report += generateReportHeader();
	report += generateExecutiveSummary(productionReadiness);
	report += generateAuditStatistics(statistics);
	report += generateCriticalBlockersSection(productionReadiness.blockers);
	report += generateHighPrioritySection(productionReadiness.highPriority);
	report += generateRecommendationsSection(productionReadiness.recommendations);
	report += generateActionPlanSection(productionReadiness);

	return report;
}

/**
 * Prints production readiness status to console
 */
function printProductionStatus(productionReadiness) {
	console.log(`\n${"=".repeat(80)}`);
	console.log("🎯 PRODUCTION READINESS ASSESSMENT COMPLETE");
	console.log("=".repeat(80));

	if (productionReadiness.blockers.length === 0) {
		console.log("✅ STATUS: PRODUCTION READY");
		console.log("   No critical blockers found!");
	} else {
		console.log("❌ STATUS: NOT PRODUCTION READY");
		console.log(
			`   ${productionReadiness.blockers.length} critical blockers must be resolved`,
		);
	}
}

/**
 * Prints audit statistics to console
 */
function printAuditStatistics(statistics) {
	console.log("\n📊 AUDIT RESULTS:");
	console.log(`   Total Issues: ${statistics.total}`);
	console.log(`   Critical: ${statistics.byPriority.critical || 0}`);
	console.log(`   High: ${statistics.byPriority.high || 0}`);
	console.log(`   Medium: ${statistics.byPriority.medium || 0}`);
	console.log(`   Low: ${statistics.byPriority.low || 0}`);

	console.log("\n📝 ISSUE BREAKDOWN:");
	for (const [type, count] of Object.entries(statistics.byType)) {
		console.log(`   ${type}: ${count}`);
	}
}

/**
 * Prints critical blockers to console
 */
function printCriticalBlockers(blockers) {
	if (blockers.length === 0) return;

	console.log("\n🚨 CRITICAL BLOCKERS:");
	for (const blocker of blockers.slice(0, 5)) {
		console.log(
			`   • ${blocker.type}: ${blocker.description} (${blocker.file}:${blocker.line})`,
		);
	}
	if (blockers.length > 5) {
		console.log(`   ... and ${blockers.length - 5} more critical issues`);
	}
}

/**
 * Prints high priority issues to console
 */
function printHighPriorityIssues(highPriority) {
	if (highPriority.length === 0) return;

	console.log("\n⚠️  HIGH PRIORITY ISSUES:");
	for (const issue of highPriority.slice(0, 3)) {
		console.log(
			`   • ${issue.type}: ${issue.description} (${issue.file}:${issue.line})`,
		);
	}
	if (highPriority.length > 3) {
		console.log(
			`   ... and ${highPriority.length - 3} more high priority issues`,
		);
	}
}

/**
 * Prints recommendations to console
 */
function printRecommendations(recommendations) {
	console.log("\n💡 RECOMMENDATIONS:");
	for (const recommendation of recommendations) {
		console.log(`   • ${recommendation}`);
	}
}

/**
 * Prints final assessment and exits with appropriate code
 */
function printFinalAssessmentAndExit(productionReadiness) {
	console.log(`\n${"=".repeat(80)}`);

	const exitCode = productionReadiness.blockers.length > 0 ? 1 : 0;

	if (exitCode === 0) {
		console.log("✅ Assessment complete - Ready for production!");
	} else {
		console.log(
			"❌ Assessment complete - Critical issues must be resolved before production",
		);
	}

	process.exit(exitCode);
}

/**
 * Saves the production readiness report to a file
 */
async function saveReport(auditResults) {
	const productionReport = generateProductionReadinessReport(auditResults);
	const reportPath = path.join(
		process.cwd(),
		"production-readiness-assessment.md",
	);
	await fs.writeFile(reportPath, productionReport, "utf-8");
	console.log(`\n📄 Full report saved to: ${reportPath}`);
	return reportPath;
}

async function main() {
	try {
		const rootPath = path.join(process.cwd(), "src");

		// Run the comprehensive audit
		const auditResults = await runTodoAudit(rootPath);
		const { statistics, productionReadiness } = auditResults;

		// Save report to file
		await saveReport(auditResults);

		// Print comprehensive console summary
		printProductionStatus(productionReadiness);
		printAuditStatistics(statistics);
		printCriticalBlockers(productionReadiness.blockers);
		printHighPriorityIssues(productionReadiness.highPriority);
		printRecommendations(productionReadiness.recommendations);
		printFinalAssessmentAndExit(productionReadiness);
	} catch (error) {
		console.error("❌ Failed to run TODO audit:", error);
		process.exit(1);
	}
}

// Run the audit
main();
