// PWA Service Worker - Solomon Codes
// Version: 1.0.0

const STATIC_CACHE = "solomon-codes-static-v1";
const DYNAMIC_CACHE = "solomon-codes-dynamic-v1";

// Assets to cache on install
const STATIC_ASSETS = [
	"/",
	"/manifest.json",
	"/favicon/favicon.svg",
	"/favicon/apple-touch-icon.png",
	"/favicon/web-app-manifest-192x192.png",
	"/favicon/web-app-manifest-512x512.png",
];

// Cache strategies
const CACHE_STRATEGIES = {
	CACHE_FIRST: "cache-first",
	NETWORK_FIRST: "network-first",
	STALE_WHILE_REVALIDATE: "stale-while-revalidate",
	NETWORK_ONLY: "network-only",
	CACHE_ONLY: "cache-only",
};

// Route patterns and their strategies
const ROUTE_STRATEGIES = [
	{ pattern: /\/_next\/static\//, strategy: CACHE_STRATEGIES.CACHE_FIRST },
	{ pattern: /\/favicon\//, strategy: CACHE_STRATEGIES.CACHE_FIRST },
	{ pattern: /\/api\//, strategy: CACHE_STRATEGIES.NETWORK_FIRST },
	{
		pattern: /\.(js|css|woff2?|png|jpg|jpeg|svg|gif|webp)$/,
		strategy: CACHE_STRATEGIES.CACHE_FIRST,
	},
	{
		pattern: /^https:\/\/fonts\.googleapis\.com\//,
		strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
	},
	{
		pattern: /^https:\/\/fonts\.gstatic\.com\//,
		strategy: CACHE_STRATEGIES.CACHE_FIRST,
	},
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
	console.log("[SW] Installing service worker...");

	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((cache) => {
				console.log("[SW] Caching static assets");
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => {
				console.log("[SW] Installation complete");
				return self.skipWaiting();
			})
			.catch((error) => {
				console.error("[SW] Installation failed:", error);
			}),
	);
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
	console.log("[SW] Activating service worker...");

	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
							console.log("[SW] Deleting old cache:", cacheName);
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => {
				console.log("[SW] Activation complete");
				return self.clients.claim();
			})
			.catch((error) => {
				console.error("[SW] Activation failed:", error);
			}),
	);
});

// Fetch event - handle requests with caching strategies
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== "GET") {
		return;
	}

	// Skip service worker script itself to prevent self-interception
	if (url.pathname === "/sw.js") {
		return;
	}

	// Skip cross-origin requests except for known CDNs
	if (url.origin !== self.location.origin && !isAllowedCrossOrigin(url)) {
		return;
	}

	// Find matching strategy
	const strategy = getStrategyForRequest(request);

	event.respondWith(
		executeStrategy(request, strategy).catch((error) => {
			console.error("[SW] Fetch failed:", error);
			return getFallbackResponse(request);
		}),
	);
});

// Strategy implementations
async function executeStrategy(request, strategy) {
	const strategyMap = {
		[CACHE_STRATEGIES.CACHE_FIRST]: () => cacheFirst(request),
		[CACHE_STRATEGIES.NETWORK_FIRST]: () => networkFirst(request),
		[CACHE_STRATEGIES.STALE_WHILE_REVALIDATE]: () =>
			staleWhileRevalidate(request),
		[CACHE_STRATEGIES.NETWORK_ONLY]: () => fetch(request),
		[CACHE_STRATEGIES.CACHE_ONLY]: () => cacheOnly(request),
	};

	const strategyFunction =
		strategyMap[strategy] || strategyMap[CACHE_STRATEGIES.NETWORK_FIRST];
	return strategyFunction();
}

async function cacheFirst(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	const response = await fetch(request);
	if (response.status === 200) {
		const cache = await caches.open(DYNAMIC_CACHE);
		cache.put(request, response.clone());
	}
	return response;
}

async function networkFirst(request) {
	try {
		const response = await fetch(request);
		if (response.status === 200) {
			const cache = await caches.open(DYNAMIC_CACHE);
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cachedResponse = await caches.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

async function staleWhileRevalidate(request) {
	const cachedResponse = await caches.match(request);

	const fetchPromise = fetch(request).then((response) => {
		if (response.status === 200) {
			const cache = caches.open(DYNAMIC_CACHE);
			cache.then((c) => c.put(request, response.clone()));
		}
		return response;
	});

	return cachedResponse || fetchPromise;
}

async function cacheOnly(request) {
	const cachedResponse = await caches.match(request);
	if (!cachedResponse) {
		throw new Error("No cached response available");
	}
	return cachedResponse;
}

// Helper functions
function getStrategyForRequest(request) {
	const url = new URL(request.url);

	for (const route of ROUTE_STRATEGIES) {
		if (route.pattern.test(url.pathname) || route.pattern.test(url.href)) {
			return route.strategy;
		}
	}

	return CACHE_STRATEGIES.NETWORK_FIRST;
}

function isAllowedCrossOrigin(url) {
	const allowedOrigins = [
		"https://fonts.googleapis.com",
		"https://fonts.gstatic.com",
		"https://api.claude.ai",
		"https://api.openai.com",
	];

	return allowedOrigins.some((origin) => url.href.startsWith(origin));
}

async function getFallbackResponse(request) {
	// Return offline page for navigation requests
	if (request.mode === "navigate") {
		return new Response(
			`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Solomon Codes</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
            .offline { max-width: 400px; margin: 0 auto; }
            h1 { color: #333; }
            p { color: #666; margin: 1rem 0; }
            button { background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline">
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>
    `,
			{
				status: 200,
				headers: { "Content-Type": "text/html" },
			},
		);
	}

	// Return simple error for other requests
	return new Response("Offline", { status: 503 });
}

// Handle messages from main thread
self.addEventListener("message", (event) => {
	// Verify the origin of the message for security
	if (event.origin !== self.location.origin) {
		return;
	}

	const { type, payload } = event.data;

	switch (type) {
		case "SKIP_WAITING":
			self.skipWaiting();
			break;
		case "CLAIM_CLIENTS":
			self.clients.claim();
			break;
		case "CACHE_INVALIDATE":
			invalidateCache(payload.pattern);
			break;
		case "GET_CACHE_STATUS":
			getCacheStatus().then((status) => {
				event.ports[0]?.postMessage(status);
			});
			break;
	}
});

async function invalidateCache(pattern) {
	const cacheNames = await caches.keys();
	for (const cacheName of cacheNames) {
		const cache = await caches.open(cacheName);
		const requests = await cache.keys();
		for (const request of requests) {
			if (pattern && new RegExp(pattern).test(request.url)) {
				await cache.delete(request);
			}
		}
	}
}

async function getCacheStatus() {
	const cacheNames = await caches.keys();
	const status = {};

	for (const cacheName of cacheNames) {
		const cache = await caches.open(cacheName);
		const requests = await cache.keys();
		status[cacheName] = requests.length;
	}

	return status;
}

console.log("[SW] Service Worker loaded");
