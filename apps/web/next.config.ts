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

	// External packages for server components
	serverExternalPackages: [],
};

export default nextConfig;
