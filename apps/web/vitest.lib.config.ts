import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "unit-lib",
		environment: "node",
		setupFiles: ["./test-setup/vitest-lib-setup.ts"],
		include: ["src/lib/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
		exclude: [
			"node_modules",
			"dist",
			".next",
			"src/test/e2e/**",
			"**/*.integration.test.*",
			"src/lib/**/*.tsx", // Exclude React components (covered by unit config)
		],
		globals: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "coverage/unit-lib",
			include: ["src/lib/**"],
			exclude: [
				"**/*.test.*",
				"**/*.spec.*",
				"**/*.tsx", // React components
				"**/index.ts", // Re-exports
				"**/*.d.ts", // Type definitions
			],
			thresholds: {
				functions: 80,
				lines: 80,
				branches: 70,
				statements: 80,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	esbuild: {
		target: "node18",
	},
});
