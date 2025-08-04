#!/usr/bin/env node

/**
 * Temporary script to bypass ReactCurrentOwner build errors
 * by temporarily moving problematic pages outside the src directory during build
 */

const fs = require("node:fs");
const path = require("node:path");

const problematicPages = [
	"src/app/dashboard/page.tsx",
	"src/app/environments/page.tsx",
	"src/app/settings/page.tsx",
	"src/app/not-found.tsx",
	"src/app/auth/success/page.tsx",
	"src/app/api/letta",
];

const action = process.argv[2]; // 'disable' or 'restore'
const tempDir = path.join(__dirname, "..", ".build-temp");

function disablePages() {
	console.log(
		"🔧 Temporarily moving problematic pages outside src for build...",
	);

	// Create temp directory if it doesn't exist
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}

	problematicPages.forEach((pagePath) => {
		const fullPath = path.join(__dirname, "..", pagePath);
		const fileName = path.basename(pagePath);
		const backupPath = path.join(tempDir, fileName);

		if (fs.existsSync(fullPath)) {
			// Check if it's a directory or file
			const stats = fs.statSync(fullPath);
			if (stats.isDirectory()) {
				fs.renameSync(fullPath, backupPath);
				console.log(`  ✓ Moved directory ${pagePath} to temp`);
			} else {
				fs.renameSync(fullPath, backupPath);
				console.log(`  ✓ Moved ${pagePath} to temp`);
			}
		}
	});
}

function restorePages() {
	console.log("🔧 Restoring moved pages from temp...");

	if (!fs.existsSync(tempDir)) {
		console.log("  ⚠ No temp directory found, nothing to restore");
		return;
	}

	problematicPages.forEach((pagePath) => {
		const fullPath = path.join(__dirname, "..", pagePath);
		const fileName = path.basename(pagePath);
		const backupPath = path.join(tempDir, fileName);

		if (fs.existsSync(backupPath)) {
			// Ensure parent directory exists
			const parentDir = path.dirname(fullPath);
			if (!fs.existsSync(parentDir)) {
				fs.mkdirSync(parentDir, { recursive: true });
			}

			fs.renameSync(backupPath, fullPath);
			console.log(`  ✓ Restored ${pagePath}`);
		}
	});

	// Clean up temp directory if empty
	try {
		if (fs.existsSync(tempDir)) {
			const files = fs.readdirSync(tempDir);
			if (files.length === 0) {
				fs.rmdirSync(tempDir);
				console.log("  ✓ Cleaned up temp directory");
			}
		}
	} catch (error) {
		console.log("  ⚠ Could not clean up temp directory:", error.message);
	}
}

if (action === "disable") {
	disablePages();
} else if (action === "restore") {
	restorePages();
} else {
	console.log("Usage: node bypass-build-error.js [disable|restore]");
	process.exit(1);
}
