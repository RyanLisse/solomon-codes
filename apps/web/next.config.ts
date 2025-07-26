import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Image optimization settings for Cloudflare
	images: {
		// Cloudflare supports image optimization
		remotePatterns: [
			{
				protocol: "https",
				hostname: "localhost",
			},
		],
		// Use optimized images by default
		unoptimized: false,
	},

	// Configure for better performance on Cloudflare Pages
	experimental: {
		// Disable CSS optimization to avoid critters dependency issue
		optimizeCss: false,
	},

	// Webpack configuration for better compatibility
	webpack: (config) => {
		// Handle potential module resolution issues
		config.resolve.fallback = {
			...config.resolve.fallback,
			fs: false,
			net: false,
			tls: false,
		};
		return config;
	},
};

export default nextConfig;
