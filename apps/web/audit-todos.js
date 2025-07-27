#!/usr/bin/env node
/**
 * Simple TODO audit script for production readiness assessment
 * Runs without dependencies on the application configuration system
 */

const fs = require('fs').promises;
const path = require('path');

// Patterns to search for in the codebase
const ISSUE_PATTERNS = [
  {
    pattern: /(?:\/\/|\/\*|\*|#)\s*(TODO|FIXME|HACK|XXX|TEMP|TEMPORARY|BUG|WARN)[\s:]*(.+?)(?:\*\/|$)/gi,
    types: ["TODO", "FIXME", "HACK", "NOTE", "TEMP", "DEPRECATED"]
  },
  {
    pattern: /console\.(log|warn|error|info|debug|trace)\s*\(/g,
    types: ["CONSOLE"]
  },
  {
    pattern: /@ts-(ignore|nocheck|expect-error)(?:\s+(.+?))?$/gm,
    types: ["NOTE"]
  },
  {
    pattern: /eslint-disable(-next-line)?\s+(.+)/g,
    types: ["NOTE"]
  },
  {
    pattern: /(dev-only|development-only|remove-before-prod|temporary|deprecated|legacy)/gi,
    types: ["TEMP", "DEPRECATED"]
  }
];

const SCANNABLE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml"
];

const EXCLUDED_DIRS = [
  "node_modules", "dist", "build", ".next", ".git", ".vscode", "coverage"
];

function determinePriority(type, content, filePath) {
  const lowerContent = content.toLowerCase();
  const isProductionFile = filePath.includes("production") || filePath.includes("deploy");
  
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

function isAllowedConsoleUsage(filePath, content) {
  // Allow console in specific contexts
  return (
    // Configuration and startup logging (critical for debugging deployment issues)
    (filePath.includes("/config/") && content.includes("Configuration")) ||
    (filePath.includes("/startup") && content.includes("startup")) ||
    // Error handling where console is used as fallback
    content.includes("fallback") || content.includes("critical") ||
    // Development-only logging utilities
    filePath.includes("/mock/") || filePath.includes("/features/environment") ||
    // Test files
    filePath.includes(".test.") || filePath.includes("/test/")
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
      
      while ((match = pattern.exec(content)) !== null) {
        const matchIndex = match.index;
        const lineNumber = content.substring(0, matchIndex).split("\n").length;
        const matchedType = match[1]?.toUpperCase() || types[0];
        const description = match[2]?.trim() || match[0];
        
        // Skip allowed console usage
        if (matchedType === "CONSOLE" && isAllowedConsoleUsage(relativePath, content)) {
          continue;
        }
        
        // Get context lines
        const contextStart = Math.max(0, lineNumber - 2);
        const contextEnd = Math.min(lines.length, lineNumber + 2);
        const context = lines.slice(contextStart, contextEnd);
        
        const priority = determinePriority(matchedType, description, relativePath);
        const tags = extractTags(description, relativePath);
        
        issues.push({
          type: matchedType,
          file: relativePath,
          line: lineNumber,
          content: match[0],
          context,
          priority,
          description: description || match[0],
          tags
        });
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
    criticalBlocking: allIssues.filter(i => i.priority === "critical").length
  };
  
  for (const issue of allIssues) {
    statistics.byType[issue.type] = (statistics.byType[issue.type] || 0) + 1;
    statistics.byPriority[issue.priority] = (statistics.byPriority[issue.priority] || 0) + 1;
  }
  
  // Identify production readiness issues
  const blockers = allIssues.filter(i => i.priority === "critical");
  const highPriority = allIssues.filter(i => i.priority === "high");
  
  const recommendations = [];
  
  if (blockers.length > 0) {
    recommendations.push(`Resolve ${blockers.length} critical issues that block production deployment`);
  }
  
  if (highPriority.length > 0) {
    recommendations.push(`Address ${highPriority.length} high priority issues before production`);
  }
  
  const consoleIssues = allIssues.filter(i => i.type === "CONSOLE");
  if (consoleIssues.length > 0) {
    recommendations.push(`Remove or replace ${consoleIssues.length} console statements with proper logging`);
  }
  
  const hackIssues = allIssues.filter(i => i.type === "HACK");
  if (hackIssues.length > 0) {
    recommendations.push(`Replace ${hackIssues.length} temporary hacks with permanent solutions`);
  }
  
  const tempIssues = allIssues.filter(i => i.type === "TEMP");
  if (tempIssues.length > 0) {
    recommendations.push(`Implement ${tempIssues.length} temporary solutions permanently`);
  }
  
  if (allIssues.length === 0) {
    recommendations.push("✅ No TODO/FIXME issues found - codebase appears production ready");
  }
  
  return {
    issues: allIssues,
    statistics,
    productionReadiness: {
      blockers,
      highPriority,
      recommendations
    }
  };
}

function generateProductionReadinessReport(results) {
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
    const emoji = priority === "critical" ? "🔴" : 
                  priority === "high" ? "🟡" : 
                  priority === "medium" ? "🟠" : "🟢";
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
  report += "3. Regular code review process to address medium/low priority items\n";
  report += "4. Documentation for any remaining temporary solutions\n\n";
  
  return report;
}

async function main() {
  try {
    const rootPath = path.join(process.cwd(), "src");
    
    // Run the comprehensive audit
    const auditResults = await runTodoAudit(rootPath);
    
    // Generate comprehensive production readiness report
    const productionReport = generateProductionReadinessReport(auditResults);
    
    // Save report to file
    const reportPath = path.join(process.cwd(), "production-readiness-assessment.md");
    await fs.writeFile(reportPath, productionReport, "utf-8");
    
    // Print summary to console
    console.log("\n" + "=".repeat(80));
    console.log("🎯 PRODUCTION READINESS ASSESSMENT COMPLETE");
    console.log("=".repeat(80));
    
    const { statistics, productionReadiness } = auditResults;
    
    if (productionReadiness.blockers.length === 0) {
      console.log("✅ STATUS: PRODUCTION READY");
      console.log("   No critical blockers found!");
    } else {
      console.log("❌ STATUS: NOT PRODUCTION READY");
      console.log(`   ${productionReadiness.blockers.length} critical blockers must be resolved`);
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
        console.log(`   • ${blocker.type}: ${blocker.description} (${blocker.file}:${blocker.line})`);
      }
      if (productionReadiness.blockers.length > 5) {
        console.log(`   ... and ${productionReadiness.blockers.length - 5} more critical issues`);
      }
    }
    
    if (productionReadiness.highPriority.length > 0) {
      console.log("\n⚠️  HIGH PRIORITY ISSUES:");
      for (const issue of productionReadiness.highPriority.slice(0, 3)) {
        console.log(`   • ${issue.type}: ${issue.description} (${issue.file}:${issue.line})`);
      }
      if (productionReadiness.highPriority.length > 3) {
        console.log(`   ... and ${productionReadiness.highPriority.length - 3} more high priority issues`);
      }
    }
    
    console.log("\n💡 RECOMMENDATIONS:");
    for (const recommendation of productionReadiness.recommendations) {
      console.log(`   • ${recommendation}`);
    }
    
    console.log("\n" + "=".repeat(80));
    
    // Exit with appropriate code
    const exitCode = productionReadiness.blockers.length > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log("✅ Assessment complete - Ready for production!");
    } else {
      console.log("❌ Assessment complete - Critical issues must be resolved before production");
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error("❌ Failed to run TODO audit:", error);
    process.exit(1);
  }
}

// Run the audit
main();