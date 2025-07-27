import { Stagehand } from "@browserbasehq/stagehand";
import { getConfigurationService } from "../config/service";
import { createServiceLogger } from "../logging/factory";
import { getMockOrRealData } from "../mock/manager";
import { mockApiResponses } from "../mock/providers";
import type {
	AutomationResult,
	AutomationTask,
	SessionConfig,
	ExtractedData,
	ObservationData,
} from "../../types/stagehand";

/**
 * Stagehand client configuration
 */
export interface StagehandClientConfig {
	apiKey: string;
	projectId: string;
	timeout?: number;
	retries?: number;
	enableLogging?: boolean;
}

/**
 * Stagehand session information
 */
export interface StagehandSession {
	id: string;
	stagehand: Stagehand;
	createdAt: Date;
	lastUsed: Date;
	isActive: boolean;
}

/**
 * Enhanced Stagehand client with proper error handling and health checking
 */
export class StagehandClient {
	private logger = createServiceLogger("stagehand-client");
	private config: StagehandClientConfig;
	private sessions = new Map<string, StagehandSession>();
	private healthStatus: "healthy" | "unhealthy" | "unknown" = "unknown";
	private lastHealthCheck?: Date;

	constructor(config?: Partial<StagehandClientConfig>) {
		const configService = getConfigurationService();
		const apiConfig = configService.getApiConfig();

		this.config = {
			apiKey: config?.apiKey || apiConfig.browserbase.apiKey || "",
			projectId: config?.projectId || apiConfig.browserbase.projectId || "",
			timeout: config?.timeout || 30000,
			retries: config?.retries || 3,
			enableLogging: config?.enableLogging || configService.isDevelopment(),
		};

		this.logger.info("Stagehand client initialized", {
			hasApiKey: Boolean(this.config.apiKey),
			hasProjectId: Boolean(this.config.projectId),
			timeout: this.config.timeout,
			retries: this.config.retries,
		});
	}

	/**
	 * Check if Stagehand is properly configured
	 */
	isConfigured(): boolean {
		return Boolean(this.config.apiKey && this.config.projectId);
	}

	/**
	 * Perform health check on Stagehand service
	 */
	async healthCheck(): Promise<{
		healthy: boolean;
		message: string;
		details?: Record<string, unknown>;
	}> {
		this.logger.debug("Performing Stagehand health check");

		if (!this.isConfigured()) {
			this.healthStatus = "unhealthy";
			return {
				healthy: false,
				message: "Stagehand not configured - missing API key or project ID",
				details: {
					hasApiKey: Boolean(this.config.apiKey),
					hasProjectId: Boolean(this.config.projectId),
				},
			};
		}

		try {
			// Create a test session to verify connectivity
			const testSession = await this.createSession({
				headless: true,
				viewport: { width: 1280, height: 720 },
			});

			// Clean up test session
			await this.closeSession(testSession.sessionId);

			this.healthStatus = "healthy";
			this.lastHealthCheck = new Date();

			this.logger.info("Stagehand health check passed");

			return {
				healthy: true,
				message: "Stagehand service is healthy",
				details: {
					lastCheck: this.lastHealthCheck.toISOString(),
					activeSessions: this.sessions.size,
				},
			};
		} catch (error) {
			this.healthStatus = "unhealthy";
			this.lastHealthCheck = new Date();

			this.logger.error("Stagehand health check failed", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});

			return {
				healthy: false,
				message: "Stagehand service is unhealthy",
				details: {
					error: error instanceof Error ? error.message : String(error),
					lastCheck: this.lastHealthCheck.toISOString(),
				},
			};
		}
	}

	/**
	 * Get current health status
	 */
	getHealthStatus(): {
		status: "healthy" | "unhealthy" | "unknown";
		lastCheck?: Date;
		activeSessions: number;
	} {
		return {
			status: this.healthStatus,
			lastCheck: this.lastHealthCheck,
			activeSessions: this.sessions.size,
		};
	}

	/**
	 * Create a new Stagehand session
	 */
	async createSession(config: SessionConfig = {}): Promise<{
		sessionId: string;
		success: boolean;
		error?: string;
	}> {
		return getMockOrRealData(
			// Mock implementation
			async () => {
				this.logger.info("Creating mock Stagehand session");
				const mockSessionId = `mock-session-${Date.now()}`;
				return {
					sessionId: mockSessionId,
					success: true,
				};
			},
			// Real implementation
			async () => {
				if (!this.isConfigured()) {
					throw new Error(
						"Stagehand not configured - missing API key or project ID",
					);
				}

				this.logger.info("Creating Stagehand session", { config });

				const stagehand = new Stagehand({
					env: "BROWSERBASE",
					apiKey: this.config.apiKey,
					projectId: this.config.projectId,
					headless: config.headless ?? true,
					logger: this.config.enableLogging,
				});

				await stagehand.init();

				const sessionId =
					stagehand.browserbaseSessionID || `session-${Date.now()}`;

				// Store session for management
				this.sessions.set(sessionId, {
					id: sessionId,
					stagehand,
					createdAt: new Date(),
					lastUsed: new Date(),
					isActive: true,
				});

				this.logger.info("Stagehand session created", { sessionId });

				return {
					sessionId,
					success: true,
				};
			},
			"stagehand-session-creation",
		);
	}

	/**
	 * Get an existing session
	 */
	private getSession(sessionId: string): StagehandSession | null {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.lastUsed = new Date();
		}
		return session || null;
	}

	/**
	 * Run automation task
	 */
	async runAutomationTask(
		task: AutomationTask,
		sessionId?: string,
	): Promise<AutomationResult> {
		return getMockOrRealData(
			// Mock implementation
			async () => {
				this.logger.info("Running mock automation task", { task });
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay

				return {
					success: true,
					data:
						mockApiResponses?.stagehand?.automation?.result ||
						"Mock automation completed",
					sessionId: sessionId || "mock-session",
					logs: mockApiResponses?.stagehand?.automation?.logs || [
						"Mock automation started",
						"Mock automation completed",
					],
				};
			},
			// Real implementation
			async () => {
				const logs: string[] = [];
				let session: StagehandSession | null = null;
				let shouldCloseSession = false;

				try {
					// Get or create session
					if (sessionId) {
						session = this.getSession(sessionId);
						if (!session) {
							throw new Error(`Session ${sessionId} not found`);
						}
					} else {
						const sessionResult = await this.createSession();
						if (!sessionResult.success) {
							throw new Error(
								sessionResult.error || "Failed to create session",
							);
						}
						session = this.getSession(sessionResult.sessionId);
						shouldCloseSession = true;
					}

					if (!session) {
						throw new Error("Failed to get session");
					}

					logs.push(`Using session: ${session.id}`);
					logs.push(`Navigating to: ${task.url}`);

					// Navigate to URL
					await session.stagehand.page.goto(task.url, {
						waitUntil: "networkidle",
						timeout: this.config.timeout,
					});

					logs.push("Page loaded successfully");

					// Perform automation using the latest Stagehand API
					logs.push("Executing automation instructions");
					await session.stagehand.act({
						action: task.instructions,
					});

					logs.push("Automation instructions completed");

					// Extract data if schema provided
					let extractedData: ExtractedData = null;
					if (task.extractSchema) {
						logs.push("Extracting data with provided schema");
						extractedData = await session.stagehand.extract({
							instruction: "Extract data according to the provided schema",
							schema: task.extractSchema,
						});
						logs.push("Data extraction completed");
					}

					logs.push("Automation task completed successfully");

					return {
						success: true,
						data: extractedData,
						sessionId: session.id,
						logs,
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					logs.push(`Error: ${errorMessage}`);

					this.logger.error("Automation task failed", {
						error: errorMessage,
						stack: error instanceof Error ? error.stack : undefined,
						task,
						sessionId,
					});

					return {
						success: false,
						error: errorMessage,
						sessionId: session?.id,
						logs,
					};
				} finally {
					// Clean up session if we created it
					if (shouldCloseSession && session) {
						try {
							await this.closeSession(session.id);
							logs.push("Session closed");
						} catch (closeError) {
							logs.push(`Warning: Failed to close session: ${closeError}`);
						}
					}
				}
			},
			"stagehand-automation-task",
		);
	}

	/**
	 * Observe page elements
	 */
	async observePageElements(
		url: string,
		instruction: string,
		sessionId?: string,
	): Promise<AutomationResult> {
		return getMockOrRealData(
			// Mock implementation
			async () => {
				this.logger.info("Running mock page observation", { url, instruction });
				await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay

				return {
					success: true,
					data: {
						elements: [
							{
								tag: "button",
								text: "Mock Button",
								attributes: { class: "btn btn-primary" },
								selector: ".btn-primary",
							},
						],
						links: [{ href: "/mock-link", text: "Mock Link" }],
					},
					sessionId: sessionId || "mock-session",
					logs: ["Mock observation completed"],
				};
			},
			// Real implementation
			async () => {
				const logs: string[] = [];
				let session: StagehandSession | null = null;
				let shouldCloseSession = false;

				try {
					// Get or create session
					if (sessionId) {
						session = this.getSession(sessionId);
						if (!session) {
							throw new Error(`Session ${sessionId} not found`);
						}
					} else {
						const sessionResult = await this.createSession();
						if (!sessionResult.success) {
							throw new Error(
								sessionResult.error || "Failed to create session",
							);
						}
						session = this.getSession(sessionResult.sessionId);
						shouldCloseSession = true;
					}

					if (!session) {
						throw new Error("Failed to get session");
					}

					logs.push(`Using session: ${session.id}`);
					logs.push(`Navigating to: ${url}`);

					// Navigate to URL
					await session.stagehand.page.goto(url, {
						waitUntil: "networkidle",
						timeout: this.config.timeout,
					});

					logs.push("Page loaded successfully");

					// Observe page elements using the latest Stagehand API
					logs.push("Observing page elements");
					const observations = await session.stagehand.observe({
						instruction,
					});

					logs.push("Page observation completed");

					return {
						success: true,
						data: observations as ObservationData,
						sessionId: session.id,
						logs,
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					logs.push(`Error: ${errorMessage}`);

					this.logger.error("Page observation failed", {
						error: errorMessage,
						stack: error instanceof Error ? error.stack : undefined,
						url,
						instruction,
						sessionId,
					});

					return {
						success: false,
						error: errorMessage,
						sessionId: session?.id,
						logs,
					};
				} finally {
					// Clean up session if we created it
					if (shouldCloseSession && session) {
						try {
							await this.closeSession(session.id);
							logs.push("Session closed");
						} catch (closeError) {
							logs.push(`Warning: Failed to close session: ${closeError}`);
						}
					}
				}
			},
			"stagehand-page-observation",
		);
	}

	/**
	 * Close a session
	 */
	async closeSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			this.logger.warn("Attempted to close non-existent session", {
				sessionId,
			});
			return;
		}

		try {
			await session.stagehand.close();
			session.isActive = false;
			this.sessions.delete(sessionId);

			this.logger.info("Session closed successfully", { sessionId });
		} catch (error) {
			this.logger.error("Failed to close session", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Close all active sessions
	 */
	async closeAllSessions(): Promise<void> {
		const sessionIds = Array.from(this.sessions.keys());

		this.logger.info("Closing all sessions", { count: sessionIds.length });

		const closePromises = sessionIds.map((sessionId) =>
			this.closeSession(sessionId).catch((error) => {
				this.logger.error("Failed to close session during cleanup", {
					sessionId,
					error: error instanceof Error ? error.message : String(error),
				});
			}),
		);

		await Promise.allSettled(closePromises);
	}

	/**
	 * Get session information
	 */
	getSessionInfo(sessionId: string): {
		id: string;
		createdAt: Date;
		lastUsed: Date;
		isActive: boolean;
	} | null {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return null;
		}

		return {
			id: session.id,
			createdAt: session.createdAt,
			lastUsed: session.lastUsed,
			isActive: session.isActive,
		};
	}

	/**
	 * Get all active sessions
	 */
	getActiveSessions(): Array<{
		id: string;
		createdAt: Date;
		lastUsed: Date;
		isActive: boolean;
	}> {
		return Array.from(this.sessions.values()).map((session) => ({
			id: session.id,
			createdAt: session.createdAt,
			lastUsed: session.lastUsed,
			isActive: session.isActive,
		}));
	}

	/**
	 * Clean up inactive sessions
	 */
	async cleanupInactiveSessions(
		maxAge: number = 30 * 60 * 1000,
	): Promise<void> {
		const now = new Date();
		const inactiveSessions: string[] = [];

		for (const [sessionId, session] of this.sessions) {
			const age = now.getTime() - session.lastUsed.getTime();
			if (age > maxAge) {
				inactiveSessions.push(sessionId);
			}
		}

		if (inactiveSessions.length > 0) {
			this.logger.info("Cleaning up inactive sessions", {
				count: inactiveSessions.length,
				maxAge,
			});

			for (const sessionId of inactiveSessions) {
				try {
					await this.closeSession(sessionId);
				} catch (error) {
					this.logger.error("Failed to cleanup inactive session", {
						sessionId,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}
	}
}

/**
 * Global Stagehand client instance
 */
let _stagehandClient: StagehandClient | null = null;

/**
 * Get the global Stagehand client instance
 */
export function getStagehandClient(): StagehandClient {
	if (!_stagehandClient) {
		_stagehandClient = new StagehandClient();
	}
	return _stagehandClient;
}

/**
 * Reset Stagehand client (for testing)
 */
export function resetStagehandClient(): void {
	if (_stagehandClient) {
		_stagehandClient.closeAllSessions().catch(() => {
			// Ignore cleanup errors during reset
		});
	}
	_stagehandClient = null;
}
