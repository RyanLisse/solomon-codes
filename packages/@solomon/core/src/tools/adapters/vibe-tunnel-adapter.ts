/**
 * VibeTunnel Adapter - Real-time WebSocket communication for remote terminals
 * Integrates with LangGraph for distributed development environments
 */

import { z } from "zod";
import type { ToolIntegrationState } from "../../state/unified-state";
import { type AdapterConfig, BaseAdapter } from "../adapter-framework";

// VibeTunnel-specific configuration
export const VibeTunnelConfigSchema = z.object({
	...z.object({
		retryAttempts: z.number().min(0).default(3),
		retryDelayMs: z.number().min(100).default(1000),
		healthCheckIntervalMs: z.number().min(1000).default(30000),
		timeoutMs: z.number().min(1000).default(10000),
		circuitBreakerThreshold: z.number().min(1).default(5),
		enabled: z.boolean().default(true),
	}).shape,
	// VibeTunnel specific settings
	tunnelUrls: z.array(z.string().url()).default([]),
	maxConnections: z.number().min(1).default(10),
	heartbeatIntervalMs: z.number().min(1000).default(5000),
	reconnectDelayMs: z.number().min(1000).default(2000),
	maxReconnectAttempts: z.number().min(1).default(5),
});

export type VibeTunnelConfig = z.infer<typeof VibeTunnelConfigSchema>;

// Connection status and management
interface TunnelConnection {
	id: string;
	url: string;
	websocket: WebSocket | null;
	status: "connecting" | "connected" | "disconnected" | "error";
	lastHeartbeat?: string;
	latency?: number;
	reconnectAttempts: number;
}

// Input/Output types for VibeTunnel operations
export interface VibeTunnelInput {
	action: "connect" | "disconnect" | "send" | "broadcast" | "list_connections";
	connectionId?: string;
	url?: string;
	message?: {
		type: "command" | "data" | "heartbeat";
		payload: unknown;
		targetId?: string;
	};
}

export interface VibeTunnelResult {
	success: boolean;
	connections?: Array<{
		id: string;
		url: string;
		status: string;
		lastHeartbeat?: string;
		latency?: number;
	}>;
	message?: {
		from: string;
		type: string;
		payload: unknown;
		timestamp: string;
	};
	error?: string;
}

export class VibeTunnelAdapter extends BaseAdapter<
	VibeTunnelConfig,
	VibeTunnelResult
> {
	private connections = new Map<string, TunnelConnection>();
	private heartbeatTimer?: NodeJS.Timeout;
	private messageHandlers = new Set<
		(message: VibeTunnelResult["message"]) => void
	>();

	constructor() {
		super("vibeTunnel", "1.0.0");
	}

	protected async onInitialize(): Promise<void> {
		// Initialize connections from configuration
		for (const url of this.config.tunnelUrls) {
			await this.connectToTunnel(url);
		}

		// Start heartbeat monitoring
		this.startHeartbeatMonitoring();
	}

	protected async onHealthCheck(): Promise<boolean> {
		const activeConnections = Array.from(this.connections.values()).filter(
			(conn) => conn.status === "connected",
		).length;

		// Consider healthy if at least one connection is active
		return activeConnections > 0 || this.connections.size === 0;
	}

	protected async onExecute(input: unknown): Promise<VibeTunnelResult> {
		const vibeTunnelInput = input as VibeTunnelInput;

		switch (vibeTunnelInput.action) {
			case "connect":
				if (!vibeTunnelInput.url) {
					throw new Error("URL required for connect action");
				}
				return await this.handleConnect(vibeTunnelInput.url);

			case "disconnect":
				if (!vibeTunnelInput.connectionId) {
					throw new Error("Connection ID required for disconnect action");
				}
				return await this.handleDisconnect(vibeTunnelInput.connectionId);

			case "send":
				if (!vibeTunnelInput.connectionId || !vibeTunnelInput.message) {
					throw new Error("Connection ID and message required for send action");
				}
				return await this.handleSend(
					vibeTunnelInput.connectionId,
					vibeTunnelInput.message,
				);

			case "broadcast":
				if (!vibeTunnelInput.message) {
					throw new Error("Message required for broadcast action");
				}
				return await this.handleBroadcast(vibeTunnelInput.message);

			case "list_connections":
				return this.handleListConnections();

			default:
				throw new Error(`Unknown VibeTunnel action: ${vibeTunnelInput.action}`);
		}
	}

	protected async onShutdown(): Promise<void> {
		// Stop heartbeat monitoring
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = undefined;
		}

		// Close all connections
		const disconnectPromises = Array.from(this.connections.keys()).map((id) =>
			this.disconnectTunnel(id),
		);

		await Promise.allSettled(disconnectPromises);
		this.connections.clear();
	}

	// Public methods for state integration
	public onMessage(
		handler: (message: VibeTunnelResult["message"]) => void,
	): void {
		this.messageHandlers.add(handler);
	}

	public offMessage(
		handler: (message: VibeTunnelResult["message"]) => void,
	): void {
		this.messageHandlers.delete(handler);
	}

	public getConnectionState(): NonNullable<ToolIntegrationState["vibeTunnel"]> {
		return {
			connections: Array.from(this.connections.values()).map((conn) => ({
				id: conn.id,
				url: conn.url,
				status: this.mapConnectionStatus(conn.status),
				lastHeartbeat: conn.lastHeartbeat,
				latency: conn.latency,
			})),
			isEnabled: this.isEnabled,
			lastError: this.status.lastError,
		};
	}

	// Private implementation methods
	private async connectToTunnel(url: string): Promise<void> {
		const connectionId = this.generateConnectionId(url);
		const connection: TunnelConnection = {
			id: connectionId,
			url,
			websocket: null,
			status: "connecting",
			reconnectAttempts: 0,
		};

		this.connections.set(connectionId, connection);

		try {
			await this.establishWebSocketConnection(connection);
		} catch (error) {
			connection.status = "error";
			throw error;
		}
	}

	private async establishWebSocketConnection(
		connection: TunnelConnection,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Note: In a real implementation, this would use the actual WebSocket API
				// For now, we'll simulate the connection process
				const mockWebSocket = {
					readyState: 1, // WebSocket.OPEN
					send: (data: string) => {
						// Mock sending logic
						console.log(`[VibeTunnel] Sending to ${connection.url}:`, data);
					},
					close: () => {
						connection.status = "disconnected";
					},
					addEventListener: (event: string, handler: Function) => {
						// Mock event handling
						if (event === "open") {
							setTimeout(() => handler(), 100);
						}
					},
				} as unknown as WebSocket;

				connection.websocket = mockWebSocket;

				mockWebSocket.addEventListener("open", () => {
					connection.status = "connected";
					connection.reconnectAttempts = 0;
					connection.lastHeartbeat = new Date().toISOString();
					resolve();
				});

				mockWebSocket.addEventListener("close", () => {
					connection.status = "disconnected";
					this.handleConnectionLoss(connection);
				});

				mockWebSocket.addEventListener("error", (error) => {
					connection.status = "error";
					reject(error);
				});

				mockWebSocket.addEventListener("message", (event: MessageEvent) => {
					this.handleIncomingMessage(connection, event);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	private async disconnectTunnel(connectionId: string): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		if (
			connection.websocket &&
			connection.websocket.readyState === WebSocket.OPEN
		) {
			connection.websocket.close();
		}

		connection.status = "disconnected";
	}

	private async handleConnect(url: string): Promise<VibeTunnelResult> {
		try {
			await this.connectToTunnel(url);
			return {
				success: true,
				connections: [this.getConnectionInfo(this.generateConnectionId(url))],
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async handleDisconnect(
		connectionId: string,
	): Promise<VibeTunnelResult> {
		try {
			await this.disconnectTunnel(connectionId);
			this.connections.delete(connectionId);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async handleSend(
		connectionId: string,
		message: VibeTunnelInput["message"],
	): Promise<VibeTunnelResult> {
		const connection = this.connections.get(connectionId);
		if (!connection || connection.status !== "connected") {
			return {
				success: false,
				error: `Connection ${connectionId} not available`,
			};
		}

		try {
			const payload = JSON.stringify({
				type: message!.type,
				payload: message!.payload,
				timestamp: new Date().toISOString(),
			});

			connection.websocket!.send(payload);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async handleBroadcast(
		message: VibeTunnelInput["message"],
	): Promise<VibeTunnelResult> {
		const activeConnections = Array.from(this.connections.values()).filter(
			(conn) => conn.status === "connected",
		);

		if (activeConnections.length === 0) {
			return {
				success: false,
				error: "No active connections for broadcast",
			};
		}

		const results = await Promise.allSettled(
			activeConnections.map((conn) => this.handleSend(conn.id, message)),
		);

		const successCount = results.filter((r) => r.status === "fulfilled").length;

		return {
			success: successCount > 0,
			connections: activeConnections.map((conn) =>
				this.getConnectionInfo(conn.id),
			),
		};
	}

	private handleListConnections(): VibeTunnelResult {
		return {
			success: true,
			connections: Array.from(this.connections.keys()).map((id) =>
				this.getConnectionInfo(id),
			),
		};
	}

	private getConnectionInfo(connectionId: string) {
		const connection = this.connections.get(connectionId);
		if (!connection) {
			throw new Error(`Connection ${connectionId} not found`);
		}

		return {
			id: connection.id,
			url: connection.url,
			status: connection.status,
			lastHeartbeat: connection.lastHeartbeat,
			latency: connection.latency,
		};
	}

	private startHeartbeatMonitoring(): void {
		this.heartbeatTimer = setInterval(async () => {
			for (const connection of this.connections.values()) {
				if (connection.status === "connected") {
					await this.sendHeartbeat(connection);
				}
			}
		}, this.config.heartbeatIntervalMs);
	}

	private async sendHeartbeat(connection: TunnelConnection): Promise<void> {
		const startTime = Date.now();

		try {
			const heartbeatMessage = JSON.stringify({
				type: "heartbeat",
				timestamp: new Date().toISOString(),
			});

			connection.websocket!.send(heartbeatMessage);

			// Calculate latency (in a real implementation, this would wait for response)
			connection.latency = Date.now() - startTime;
			connection.lastHeartbeat = new Date().toISOString();
		} catch (error) {
			console.error(`Heartbeat failed for connection ${connection.id}:`, error);
			connection.status = "error";
		}
	}

	private handleConnectionLoss(connection: TunnelConnection): void {
		if (connection.reconnectAttempts < this.config.maxReconnectAttempts) {
			connection.reconnectAttempts++;

			setTimeout(async () => {
				try {
					await this.establishWebSocketConnection(connection);
				} catch (error) {
					console.error(`Reconnection failed for ${connection.id}:`, error);
				}
			}, this.config.reconnectDelayMs * connection.reconnectAttempts);
		} else {
			connection.status = "error";
		}
	}

	private handleIncomingMessage(
		connection: TunnelConnection,
		event: MessageEvent,
	): void {
		try {
			const data = JSON.parse(event.data);
			const message: VibeTunnelResult["message"] = {
				from: connection.id,
				type: data.type,
				payload: data.payload,
				timestamp: data.timestamp || new Date().toISOString(),
			};

			// Notify all message handlers
			this.messageHandlers.forEach((handler) => {
				try {
					handler(message);
				} catch (error) {
					console.error("Error in VibeTunnel message handler:", error);
				}
			});
		} catch (error) {
			console.error("Error parsing VibeTunnel message:", error);
		}
	}

	private generateConnectionId(url: string): string {
		return `vibe-tunnel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	private mapConnectionStatus(
		status: TunnelConnection["status"],
	): "connected" | "disconnected" | "reconnecting" | "error" {
		switch (status) {
			case "connecting":
				return "reconnecting";
			case "connected":
				return "connected";
			case "disconnected":
				return "disconnected";
			case "error":
				return "error";
			default:
				return "error";
		}
	}
}
