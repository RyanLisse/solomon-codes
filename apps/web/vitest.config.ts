import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()].flat(),
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["node_modules", "dist", ".next"],
		globals: true,
		css: true,
		environmentOptions: {
			jsdom: {
				pretendToBeVisual: true,
				resources: "usable",
			},
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
