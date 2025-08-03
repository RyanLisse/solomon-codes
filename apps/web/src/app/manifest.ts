import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Solomon Codes - Advanced Automation Platform",
		short_name: "Solomon Codes",
		description:
			"Modern, intelligent automation platform for streamlined task management, AI-powered workflows, and seamless execution.",
		start_url: "/",
		display: "standalone",
		orientation: "portrait-primary",
		background_color: "#ffffff",
		theme_color: "#000000",
		categories: ["productivity", "utilities", "developer", "automation"],
		lang: "en-US",
		scope: "/",
		icons: [
			{
				src: "/favicon/web-app-manifest-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/favicon/web-app-manifest-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/favicon/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
			{
				src: "/favicon/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
				purpose: "any",
			},
		],
		shortcuts: [
			{
				name: "New Task",
				short_name: "New Task",
				description: "Create a new automation task",
				url: "/task/new",
				icons: [
					{
						src: "/favicon/web-app-manifest-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
				],
			},
			{
				name: "Dashboard",
				short_name: "Dashboard",
				description: "View task dashboard and analytics",
				url: "/dashboard",
				icons: [
					{
						src: "/favicon/web-app-manifest-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
				],
			},
		],
		screenshots: [
			{
				src: "/screenshots/desktop-wide.png",
				sizes: "1280x720",
				type: "image/png",
				form_factor: "wide",
				label:
					"Solomon Codes desktop application showcasing the main dashboard",
			},
			{
				src: "/screenshots/mobile-narrow.png",
				sizes: "640x1136",
				type: "image/png",
				form_factor: "narrow",
				label: "Solomon Codes mobile application with responsive design",
			},
		],
		related_applications: [],
		prefer_related_applications: false,
	};
}
