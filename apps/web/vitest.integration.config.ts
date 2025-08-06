import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()].flat(),
	test: {
		name: "integration",
		environment: "node",
		setupFiles: ["./test-setup/integration-setup.ts"],
		include: [
			"src/app/api/**/*.{test,spec}.{js,ts}",
			"src/lib/inngest*.{test,spec}.{js,ts}",
			"src/app/actions/inngest.{test,spec}.{js,ts}",
			"**/*.integration.test.{js,ts,jsx,tsx}",
			"src/test/integration/**/*.{test,spec}.{js,ts}",
		],
		exclude: [
			"node_modules",
			"dist",
			".next",
			"src/test/e2e/**",
			"src/components/**",
			"src/hooks/**",
			"scripts/**",
			"stores/**",
			// Note: Removed conflicting src/lib/**/*.test.{js,ts} pattern to allow integration tests
		],
		globals: true,
		testTimeout: 30000,
		hookTimeout: 30000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "coverage/integration",
			include: ["src/app/api/**", "src/app/actions/**", "src/lib/inngest*"],
			exclude: ["**/*.test.*", "**/*.spec.*"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	esbuild: {
		jsx: "automatic",
	},
});
