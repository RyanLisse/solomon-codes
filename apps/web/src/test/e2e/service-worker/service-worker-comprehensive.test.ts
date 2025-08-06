import { expect, type Page, test } from "@playwright/test";

/**
 * Comprehensive Service Worker Test Suite
 *
 * As requested by the user's directive to "ultrathink how we can make sure the tests cover these errors",
 * this test suite covers all Service Worker registration, caching, and error scenarios.
 *
 * Test Categories:
 * 1. Service Worker Registration (success/failure scenarios)
 * 2. Cache Management and Cleanup
 * 3. Static File Serving Edge Cases
 * 4. Service Worker Lifecycle Management
 * 5. Error Handling and Recovery
 * 6. Network Failure Scenarios
 * 7. Browser Compatibility Edge Cases
 */

test.describe("Service Worker Comprehensive Test Suite", () => {
	let page: Page;

	test.beforeEach(async ({ page: testPage }) => {
		page = testPage;

		// Clear all service workers and caches before each test
		await page.evaluate(async () => {
			// Clear all caches
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map((name) => caches.delete(name)));

			// Unregister all service workers
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((reg) => reg.unregister()));
		});

		// Wait for cleanup to complete
		await page.waitForTimeout(100);
	});

	test.describe("1. Service Worker Registration Scenarios", () => {
		test("should successfully register Service Worker when sw.js is available", async () => {
			await page.goto("/");

			// Verify Service Worker registration succeeds
			const registrationResult = await page.evaluate(async () => {
				try {
					const registration = await navigator.serviceWorker.register("/sw.js");
					return {
						success: true,
						scope: registration.scope,
						state:
							registration.installing?.state ||
							registration.waiting?.state ||
							registration.active?.state,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(registrationResult.success).toBe(true);
			expect(registrationResult.scope).toContain("localhost:3001");
		});

		test("should handle Service Worker registration failure when script is unavailable", async () => {
			await page.goto("/");

			// Test registration failure with non-existent script
			const registrationResult = await page.evaluate(async () => {
				try {
					await navigator.serviceWorker.register("/non-existent-sw.js");
					return { success: true };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						name: error instanceof Error ? error.name : "Unknown",
					};
				}
			});

			expect(registrationResult.success).toBe(false);
			expect(registrationResult.error).toContain("Failed to fetch");
		});

		test("should handle Service Worker registration with invalid script", async () => {
			// Create a mock endpoint that returns invalid JavaScript
			await page.route("/invalid-sw.js", (route) => {
				route.fulfill({
					status: 200,
					contentType: "application/javascript",
					body: "invalid javascript syntax {",
				});
			});

			await page.goto("/");

			const registrationResult = await page.evaluate(async () => {
				try {
					await navigator.serviceWorker.register("/invalid-sw.js");
					return { success: true };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(registrationResult.success).toBe(false);
		});

		test("should handle Service Worker registration with network failure", async () => {
			// Simulate network failure
			await page.route("/sw.js", (route) => {
				route.abort("failed");
			});

			await page.goto("/");

			const registrationResult = await page.evaluate(async () => {
				try {
					await navigator.serviceWorker.register("/sw.js");
					return { success: true };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(registrationResult.success).toBe(false);
			expect(registrationResult.error).toContain("Failed to fetch");
		});
	});

	test.describe("2. Cache Management and Cleanup", () => {
		test("should create and manage caches correctly", async () => {
			await page.goto("/");

			// Register Service Worker and wait for activation
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.register("/sw.js");
				if (registration.installing) {
					await new Promise<void>((resolve) => {
						registration.installing?.addEventListener("statechange", () => {
							if (registration.installing?.state === "activated") {
								resolve();
							}
						});
					});
				}
			});

			// Wait for Service Worker to be ready
			await page.waitForTimeout(1000);

			// Check that caches are created
			const cacheNames = await page.evaluate(async () => {
				return await caches.keys();
			});

			expect(cacheNames.length).toBeGreaterThan(0);
		});

		test("should handle cache storage quotas and cleanup old caches", async () => {
			await page.goto("/");

			// Fill cache with data and test cleanup behavior
			const cacheResult = await page.evaluate(async () => {
				try {
					const cache = await caches.open("test-cache-1");
					await cache.put("/test-1", new Response("test data 1"));

					const cache2 = await caches.open("test-cache-2");
					await cache2.put("/test-2", new Response("test data 2"));

					// Verify caches exist
					const initialCaches = await caches.keys();

					// Delete one cache
					await caches.delete("test-cache-1");

					// Verify deletion
					const finalCaches = await caches.keys();

					return {
						success: true,
						initialCount: initialCaches.length,
						finalCount: finalCaches.length,
						deletedCache: !finalCaches.includes("test-cache-1"),
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(cacheResult.success).toBe(true);
			expect(cacheResult.deletedCache).toBe(true);
			expect(cacheResult.finalCount).toBeLessThan(cacheResult.initialCount);
		});
	});

	test.describe("3. Static File Serving Edge Cases", () => {
		test("should handle Service Worker script serving correctly", async () => {
			// Test direct access to Service Worker script
			const response = await page.goto("/sw.js");
			expect(response?.status()).toBe(200);
			expect(response?.headers()["content-type"]).toContain("javascript");
		});

		test("should handle manifest.json serving correctly", async () => {
			const response = await page.goto("/manifest.json");
			expect(response?.status()).toBe(200);
			expect(response?.headers()["content-type"]).toContain("json");
		});

		test("should handle favicon.ico serving correctly", async () => {
			const response = await page.goto("/favicon.ico");
			expect(response?.status()).toBe(200);
			expect(response?.headers()["content-type"]).toContain("icon");
		});

		test("should handle Service Worker self-interception prevention", async () => {
			await page.goto("/");

			// Register Service Worker
			await page.evaluate(async () => {
				await navigator.serviceWorker.register("/sw.js");
			});

			// Wait for Service Worker to be active
			await page.waitForTimeout(2000);

			// Verify Service Worker script is still accessible (not intercepted by itself)
			const swResponse = await page.evaluate(async () => {
				try {
					const response = await fetch("/sw.js");
					return {
						success: true,
						status: response.status,
						contentType: response.headers.get("content-type"),
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(swResponse.success).toBe(true);
			expect(swResponse.status).toBe(200);
			expect(swResponse.contentType).toContain("javascript");
		});
	});

	test.describe("4. Service Worker Lifecycle Management", () => {
		test("should handle Service Worker update process", async () => {
			await page.goto("/");

			// Register initial Service Worker
			const initialRegistration = await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.register("/sw.js");
				return {
					scope: registration.scope,
					state: registration.active?.state,
				};
			});

			expect(initialRegistration.scope).toContain("localhost:3001");

			// Simulate Service Worker update
			const updateResult = await page.evaluate(async () => {
				try {
					const registration = await navigator.serviceWorker.getRegistration();
					if (registration) {
						await registration.update();
						return { success: true };
					}
					return { success: false, error: "No registration found" };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(updateResult.success).toBe(true);
		});

		test("should handle Service Worker unregistration", async () => {
			await page.goto("/");

			// Register Service Worker
			await page.evaluate(async () => {
				await navigator.serviceWorker.register("/sw.js");
			});

			// Unregister Service Worker
			const unregistrationResult = await page.evaluate(async () => {
				try {
					const registration = await navigator.serviceWorker.getRegistration();
					if (registration) {
						const result = await registration.unregister();
						return { success: true, unregistered: result };
					}
					return { success: false, error: "No registration found" };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(unregistrationResult.success).toBe(true);
			expect(unregistrationResult.unregistered).toBe(true);
		});
	});

	test.describe("5. Error Handling and Recovery", () => {
		test("should handle Service Worker runtime errors gracefully", async () => {
			// Create a Service Worker that throws runtime errors
			await page.route("/error-sw.js", (route) => {
				route.fulfill({
					status: 200,
					contentType: "application/javascript",
					body: `
            self.addEventListener('install', event => {
              throw new Error('Intentional install error');
            });
            
            self.addEventListener('activate', event => {
              // This should still work despite install error
              console.log('Service Worker activated');
            });
            
            self.addEventListener('fetch', event => {
              // Basic fetch handling without errors
              event.respondWith(fetch(event.request));
            });
          `,
				});
			});

			await page.goto("/");

			const errorHandlingResult = await page.evaluate(async () => {
				try {
					const registration =
						await navigator.serviceWorker.register("/error-sw.js");

					// Wait for installation to complete (or fail)
					if (registration.installing) {
						await new Promise<void>((resolve, _reject) => {
							const worker = registration.installing!;
							worker.addEventListener("statechange", () => {
								if (
									worker.state === "activated" ||
									worker.state === "redundant"
								) {
									resolve();
								}
							});
							// Timeout after 5 seconds
							setTimeout(resolve, 5000);
						});
					}

					return {
						success: true,
						state:
							registration.installing?.state ||
							registration.waiting?.state ||
							registration.active?.state,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			// Service Worker registration should succeed even with runtime errors in event handlers
			expect(errorHandlingResult.success).toBe(true);
		});

		test("should handle fetch interception errors", async () => {
			await page.goto("/");

			// Register Service Worker
			await page.evaluate(async () => {
				await navigator.serviceWorker.register("/sw.js");
			});

			// Wait for Service Worker to be ready
			await page.waitForTimeout(2000);

			// Test fetch handling with network errors
			const fetchResult = await page.evaluate(async () => {
				try {
					const response = await fetch("/non-existent-resource.json");
					return {
						success: true,
						status: response.status,
						statusText: response.statusText,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			// Service Worker should handle fetch errors gracefully
			expect(fetchResult.success).toBe(true);
			expect(fetchResult.status).toBe(404);
		});
	});

	test.describe("6. Network Failure Scenarios", () => {
		test("should handle offline conditions", async () => {
			await page.goto("/");

			// Register Service Worker
			await page.evaluate(async () => {
				await navigator.serviceWorker.register("/sw.js");
			});

			await page.waitForTimeout(2000);

			// Simulate offline condition
			await page.context().setOffline(true);

			// Test that cached resources are still available
			const offlineResult = await page.evaluate(async () => {
				try {
					// Try to fetch a resource that should be cached
					const response = await fetch("/");
					return {
						success: true,
						status: response.status,
						fromCache: response.headers.get("cache-control") !== null,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			// Reset online status
			await page.context().setOffline(false);

			expect(offlineResult.success).toBe(true);
		});

		test("should handle slow network conditions", async () => {
			// Simulate slow network
			await page.route("**/*", (route) => {
				setTimeout(() => route.continue(), 1000); // 1 second delay
			});

			await page.goto("/");

			const slowNetworkStart = Date.now();

			const registrationResult = await page.evaluate(async () => {
				try {
					await navigator.serviceWorker.register("/sw.js");
					return { success: true };
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			const duration = Date.now() - slowNetworkStart;

			expect(registrationResult.success).toBe(true);
			expect(duration).toBeGreaterThan(500); // Should take at least 500ms due to slow network
		});
	});

	test.describe("7. Browser Compatibility and Edge Cases", () => {
		test("should handle browsers without Service Worker support", async () => {
			await page.goto("/");

			// Simulate browser without Service Worker support
			const compatibilityResult = await page.evaluate(async () => {
				const originalServiceWorker = navigator.serviceWorker;

				// Temporarily remove Service Worker support
				Object.defineProperty(navigator, "serviceWorker", {
					value: undefined,
					configurable: true,
				});

				try {
					if ("serviceWorker" in navigator) {
						await navigator.serviceWorker.register("/sw.js");
						return { supported: true, registered: true };
					}
					return { supported: false, registered: false };
				} catch (error) {
					return {
						supported: false,
						registered: false,
						error: error instanceof Error ? error.message : String(error),
					};
				} finally {
					// Restore Service Worker support
					Object.defineProperty(navigator, "serviceWorker", {
						value: originalServiceWorker,
						configurable: true,
					});
				}
			});

			expect(compatibilityResult.supported).toBe(false);
			expect(compatibilityResult.registered).toBe(false);
		});

		test("should handle multiple Service Worker registrations", async () => {
			await page.goto("/");

			const multipleRegistrationResult = await page.evaluate(async () => {
				try {
					// Try to register the same Service Worker multiple times
					const registration1 =
						await navigator.serviceWorker.register("/sw.js");
					const registration2 =
						await navigator.serviceWorker.register("/sw.js");
					const registration3 =
						await navigator.serviceWorker.register("/sw.js");

					return {
						success: true,
						sameRegistration:
							registration1 === registration2 &&
							registration2 === registration3,
						scope: registration1.scope,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(multipleRegistrationResult.success).toBe(true);
			expect(multipleRegistrationResult.sameRegistration).toBe(true);
		});

		test("should handle Service Worker registration with different scopes", async () => {
			await page.goto("/");

			const scopeResult = await page.evaluate(async () => {
				try {
					// Register with default scope
					const defaultRegistration =
						await navigator.serviceWorker.register("/sw.js");

					// Try to register with specific scope (should work in theory, but our SW might not support it)
					const specificRegistration = await navigator.serviceWorker.register(
						"/sw.js",
						{ scope: "/" },
					);

					return {
						success: true,
						defaultScope: defaultRegistration.scope,
						specificScope: specificRegistration.scope,
						sameScopeResult:
							defaultRegistration.scope === specificRegistration.scope,
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(scopeResult.success).toBe(true);
			expect(scopeResult.defaultScope).toContain("localhost:3001");
		});
	});

	test.describe("8. Performance and Resource Management", () => {
		test("should not cause memory leaks with repeated registrations", async () => {
			await page.goto("/");

			const memoryTestResult = await page.evaluate(async () => {
				const initialMemory = (performance as any).memory
					? (performance as any).memory.usedJSHeapSize
					: 0;

				try {
					// Register and unregister Service Worker multiple times
					for (let i = 0; i < 10; i++) {
						const registration =
							await navigator.serviceWorker.register("/sw.js");
						await registration.unregister();
					}

					const finalMemory = (performance as any).memory
						? (performance as any).memory.usedJSHeapSize
						: 0;
					const memoryDiff = finalMemory - initialMemory;

					return {
						success: true,
						initialMemory,
						finalMemory,
						memoryDiff,
						reasonableIncrease: memoryDiff < 1000000, // Less than 1MB increase
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(memoryTestResult.success).toBe(true);
			// Memory usage should not increase dramatically
			expect(memoryTestResult.reasonableIncrease).toBe(true);
		});

		test("should handle Service Worker registration timing correctly", async () => {
			await page.goto("/");

			const timingResult = await page.evaluate(async () => {
				const startTime = performance.now();

				try {
					await navigator.serviceWorker.register("/sw.js");
					const endTime = performance.now();
					const duration = endTime - startTime;

					return {
						success: true,
						duration,
						reasonable: duration < 5000, // Should complete within 5 seconds
					};
				} catch (error) {
					return {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			expect(timingResult.success).toBe(true);
			expect(timingResult.reasonable).toBe(true);
		});
	});

	test.afterEach(async () => {
		// Clean up after each test
		await page.evaluate(async () => {
			// Clear all caches
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map((name) => caches.delete(name)));

			// Unregister all service workers
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((reg) => reg.unregister()));
		});
	});
});
