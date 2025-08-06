import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()].flat(),
	test: {
		name: "unit-components",
		environment: "jsdom",
		setupFiles: ["./test-setup/vitest-setup.js"],
		include: [
			"src/components/**/*.{test,spec}.{jsx,tsx}",
			"src/app/**/*.{test,spec}.{jsx,tsx}",
			"src/hooks/**/*.{test,spec}.{jsx,tsx}",
		],
		exclude: [
			"node_modules",
			"dist",
			".next",
			"src/test/e2e/**",
			"**/*.integration.test.*",
			"src/hooks/useZodForm/**",
			"src/lib/**",
			"scripts/**",
			"stores/**",
		],
		globals: true,
		css: true,
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		environmentOptions: {
			jsdom: {
				pretendToBeVisual: true,
				resources: "usable",
			},
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "coverage/unit-components",
			include: ["src/components/**", "src/app/**", "src/hooks/**"],
			exclude: ["**/*.test.*", "**/*.spec.*", "src/hooks/useZodForm/**"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	esbuild: false, // Disable esbuild to avoid service issues
});
