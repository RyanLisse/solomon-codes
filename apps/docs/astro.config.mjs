// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://solomon-codes.com",
	build: {
		format: "directory",
	},
	integrations: [
		starlight({
			title: "Solomon Codes Documentation",
			customCss: [],
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/withastro/starlight",
				},
			],
			sidebar: [
				{
					label: "Guides",
					autogenerate: { directory: "guides" },
				},
				{
					label: "Reference",
					autogenerate: { directory: "reference" },
				},
			],
		}),
	],
	vite: {
		build: {
			rollupOptions: {
				onwarn(warning, warn) {
					// Suppress specific warnings that might be related to the 404 issue
					if (warning.code === "UNRESOLVED_IMPORT") return;
					warn(warning);
				},
			},
		},
	},
});
