import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

// Bundle analyzer setup for performance monitoring
const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
});

// Production build optimizations
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Production-specific bundle size limits (in bytes)
const BUNDLE_SIZE_LIMITS = {
	maxAssetSize: 512 * 1024, // 512kb
	maxEntrypointSize: 512 * 1024, // 512kb
	maxPageSize: 256 * 1024, // 256kb
};

const nextConfig: NextConfig = {
	// Performance optimizations
	experimental: {
		optimizeCss: true,
		optimizePackageImports: ["lucide-react", "@radix-ui/react-*", "date-fns"],
		staleTimes: {
			dynamic: isProduction ? 60 : 30,
			static: isProduction ? 300 : 180,
		},

		// Production-specific optimizations
		...(isProduction && {
			webpackBuildWorker: true,
			optimizeServerReact: true,
			gzipSize: true,
			// Enable advanced tree shaking
			modularizeImports: {
				"@radix-ui/react-icons": {
					transform: "@radix-ui/react-icons/dist/{{member}}.js",
				},
				"lucide-react": {
					transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
				},
			},
		}),
	},

	// Compiler optimizations
	compiler: {
		removeConsole: isProduction ? { exclude: ["error", "warn"] } : false,
		reactRemoveProperties: isProduction,
		// Production-specific optimizations
		...(isProduction && {
			styledComponents: true,
			relay: undefined,
		}),
	},

	// Enhanced image optimization
	images: {
		formats: ["image/avif", "image/webp"],
		minimumCacheTTL: isProduction ? 31536000 : 60, // 1 year in prod, 1 min in dev
		remotePatterns: [
			{
				protocol: "https",
				hostname: "localhost",
			},
		],
		unoptimized: false,
		// Production-specific image optimizations
		...(isProduction && {
			deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
			imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
			dangerouslyAllowSVG: false,
			contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
		}),
	},

	// Enhanced webpack optimizations
	webpack: (config, { isServer, dev, webpack }) => {
		// Exclude problematic packages from bundling
		config.externals = config.externals || [];
		if (isServer) {
			config.externals.push("@vibe-kit/dagger", "@dagger.io/dagger");
		}

		// Production-specific optimizations
		if (!dev && !isServer) {
			// Enhanced bundle splitting for production
			config.optimization.splitChunks = {
				chunks: "all",
				minSize: 20000,
				maxSize: isProduction ? 250000 : 500000,
				minChunks: 1,
				maxAsyncRequests: 30,
				maxInitialRequests: 30,
				enforceSizeThreshold: 50000,
				cacheGroups: {
					default: {
						minChunks: 2,
						priority: -20,
						reuseExistingChunk: true,
					},
					defaultVendors: false,
					vendor: {
						test: /[\\/]node_modules[\\/]/,
						name: "vendors",
						priority: 10,
						chunks: "all",
						enforce: true,
					},
					react: {
						test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
						name: "react-vendor",
						priority: 20,
						chunks: "all",
						enforce: true,
					},
					ui: {
						test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
						name: "ui-vendor",
						priority: 15,
						chunks: "all",
						enforce: true,
					},
					common: {
						name: "common",
						minChunks: 2,
						chunks: "all",
						priority: 5,
						reuseExistingChunk: true,
					},
				},
			};

			// Production bundle size monitoring
			if (isProduction) {
				config.performance = {
					hints: "warning",
					maxAssetSize: BUNDLE_SIZE_LIMITS.maxAssetSize,
					maxEntrypointSize: BUNDLE_SIZE_LIMITS.maxEntrypointSize,
					assetFilter: (assetFilename: string) => {
						return (
							assetFilename.endsWith(".js") || assetFilename.endsWith(".css")
						);
					},
				};
			}

			// Production-specific plugins
			if (isProduction) {
				config.plugins.push(
					new webpack.DefinePlugin({
						"process.env.BUNDLE_ANALYZE": JSON.stringify(
							process.env.ANALYZE === "true",
						),
						"process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
					}),
				);

				// Add bundle size analyzer for production builds
				if (process.env.ANALYZE === "true") {
					const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
					config.plugins.push(
						new BundleAnalyzerPlugin({
							analyzerMode: "static",
							reportFilename: "../bundle-analyzer-report.html",
							openAnalyzer: false,
							generateStatsFile: true,
							statsFilename: "../bundle-stats.json",
							statsOptions: {
								source: false,
								reasons: true,
								optimizationBailout: true,
								chunkModules: true,
								children: false,
							},
						}),
					);
				}
			}
		}

		// Development-specific optimizations
		if (dev) {
			config.devtool = "eval-cheap-module-source-map";
		}

		// Module resolution optimizations
		config.resolve.alias = {
			...config.resolve.alias,
			// Reduce bundle size by aliasing to smaller alternatives
			...(isProduction && {
				"react/jsx-runtime": require.resolve("react/jsx-runtime"),
				"react/jsx-dev-runtime": require.resolve("react/jsx-dev-runtime"),
			}),
		};

		// Tree shaking optimizations
		config.optimization.usedExports = true;
		config.optimization.sideEffects = false;

		return config;
	},

	// Production optimizations
	compress: true,
	poweredByHeader: false,
	generateEtags: isProduction,

	// Enhanced caching for production
	...(isProduction && {
		onDemandEntries: {
			maxInactiveAge: 60 * 1000, // 1 minute
			pagesBufferLength: 5,
		},
	}),

	// Output configuration for production builds
	output: isProduction ? "standalone" : undefined,

	// Enhanced security headers for production
	...(isProduction && {
		headers: async () => [
			{
				source: "/(.*)",
				headers: [
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				],
			},
		],
	}),

	// External packages for server components
	serverExternalPackages: [
		"@electric-sql/pglite",
		"@neondatabase/serverless",
		"postgres",
		// Dagger.io packages (server-only)
		"@dagger.io/dagger",
		"winston",
	],

	// Environment-specific redirects
	redirects: async () => {
		const redirects = [];

		// Production-specific redirects
		if (isProduction) {
			redirects.push({
				source: "/health",
				destination: "/api/health",
				permanent: false,
			});
		}

		return redirects;
	},

	// Turbopack configuration for development
	turbopack: {
		rules: {
			"*.svg": {
				loaders: ["@svgr/webpack"],
				as: "*.js",
			},
		},
		resolveAlias: {
			"@": "./src",
		},
	},
};

export default withBundleAnalyzer(nextConfig);
