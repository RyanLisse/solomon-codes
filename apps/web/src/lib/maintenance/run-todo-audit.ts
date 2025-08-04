#!/usr/bin/env tsx

/**
 * Comprehensive TODO audit runner for production readiness assessment
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createContextLogger } from "../logging/factory";
import {
	generateProductionReadinessReport,
	registerAuditResults,
	runTodoAudit,
} from "./todo-audit-scanner";
import { generateProductionReadinessReport as generateTrackerReport } from "./todo-tracker";

const logger = createContextLogger("todo-audit-runner");

/**
 * Main audit execution function
 */
async function main() {
	try {
		logger.info(
			"🔍 Starting comprehensive TODO audit for production readiness",
		);

		// Set the root path to the web app directory
		const rootPath = join(process.cwd(), "apps/web");

		// Run the comprehensive audit
		logger.info(
			"📊 Scanning codebase for TODO, FIXME, HACK, and NOTE comments...",
		);
		const auditResults = await runTodoAudit(rootPath);

		// Register results with TodoTracker
		logger.info("📝 Registering findings with TodoTracker...");
		registerAuditResults(auditResults);

		// Generate comprehensive production readiness report
		logger.info("📋 Generating production readiness report...");
		const productionReport = generateProductionReadinessReport(auditResults);

		// Generate TodoTracker report
		const trackerReport = generateTrackerReport();

		// Combine reports
		const combinedReport = `${productionReport}\n\n---\n\n${trackerReport}`;

		// Save report to file
		const reportPath = join(
			process.cwd(),
			"production-readiness-assessment.md",
		);
		await writeFile(reportPath, combinedReport, "utf-8");

		// Print summary to console
		console.log(`\n${"=".repeat(80)}`);
		console.log("🎯 PRODUCTION READINESS ASSESSMENT COMPLETE");
		console.log("=".repeat(80));

		const { statistics, productionReadiness } = auditResults;

		if (productionReadiness.blockers.length === 0) {
			console.log("✅ STATUS: PRODUCTION READY");
			console.log("   No critical blockers found!");
		} else {
			console.log("❌ STATUS: NOT PRODUCTION READY");
			console.log(
				`   ${productionReadiness.blockers.length} critical blockers must be resolved`,
			);
		}

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

		console.log(`\n📄 Full report saved to: ${reportPath}`);

		if (productionReadiness.blockers.length > 0) {
			console.log("\n🚨 CRITICAL BLOCKERS:");
			for (const blocker of productionReadiness.blockers.slice(0, 5)) {
				console.log(
					`   • ${blocker.type}: ${blocker.description} (${blocker.file}:${blocker.line})`,
				);
			}
			if (productionReadiness.blockers.length > 5) {
				console.log(
					`   ... and ${productionReadiness.blockers.length - 5} more critical issues`,
				);
			}
		}

		if (productionReadiness.highPriority.length > 0) {
			console.log("\n⚠️  HIGH PRIORITY ISSUES:");
			for (const issue of productionReadiness.highPriority.slice(0, 3)) {
				console.log(
					`   • ${issue.type}: ${issue.description} (${issue.file}:${issue.line})`,
				);
			}
			if (productionReadiness.highPriority.length > 3) {
				console.log(
					`   ... and ${productionReadiness.highPriority.length - 3} more high priority issues`,
				);
			}
		}

		console.log("\n💡 RECOMMENDATIONS:");
		for (const recommendation of productionReadiness.recommendations) {
			console.log(`   • ${recommendation}`);
		}

		console.log(`\n${"=".repeat(80)}`);

		// Exit with appropriate code
		const exitCode = productionReadiness.blockers.length > 0 ? 1 : 0;

		if (exitCode === 0) {
			logger.info("✅ Production readiness assessment completed successfully");
			console.log("✅ Assessment complete - Ready for production!");
		} else {
			logger.warn("❌ Production readiness assessment found critical issues");
			console.log(
				"❌ Assessment complete - Critical issues must be resolved before production",
			);
		}

		process.exit(exitCode);
	} catch (error) {
		logger.error("Failed to run TODO audit", {
			error: error instanceof Error ? error : String(error),
		});
		console.error("❌ Failed to run TODO audit:", error);
		process.exit(1);
	}
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
	logger.error("Unhandled rejection in TODO audit", { reason, promise });
	console.error("❌ Unhandled rejection:", reason);
	process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception in TODO audit", { error });
	console.error("❌ Uncaught exception:", error);
	process.exit(1);
});

// Run the audit if this file is executed directly
if (require.main === module) {
	main();
}

export { main as runTodoAuditMain };
