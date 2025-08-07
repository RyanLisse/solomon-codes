/**
 * VibeTunnel WebSocket Connection Implementation
 * Real-time browser-based terminal access with secure command execution
 */

import type {
	WebSocketConnectionCapabilities,
	WebSocketConnectionState,
	WebSocketMessage,
} from "../../tests/test-doubles/integrations/vibe-tunnel/websocket-connection.double";

export interface WebSocketConnectionConfig {
	reconnectAttempts?: number;
	heartbeatInterval?: number;
	connectionTimeout?: number;
	messageTimeout?: number;
}

export class VibeTunnelWebSocketConnection
	implements WebSocketConnectionCapabilities
{
	private readonly state: WebSocketConnectionState;
	private websocket?: WebSocket;
	private readonly messageCallbacks: ((message: WebSocketMessage) => void)[] =
		[];
	private readonly stateCallbacks: ((
		state: WebSocketConnectionState,
	) => void)[] = [];
	private heartbeatInterval?: NodeJS.Timeout;
	private readonly config: Required<WebSocketConnectionConfig>;

	constructor(id: string, config: WebSocketConnectionConfig = {}) {
		this.config = {
			reconnectAttempts: config.reconnectAttempts || 3,
			heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
			connectionTimeout: config.connectionTimeout || 10000, // 10 seconds
			messageTimeout: config.messageTimeout || 5000, // 5 seconds
		};

		this.state = {
			id,
			url: "",
			status: "disconnected",
			reconnectAttempts: 0,
			maxReconnectAttempts: this.config.reconnectAttempts,
		};
	}

	async connect(url: string): Promise<void> {
		this.state.url = url;
		this.state.status = "connecting";
		this.notifyStateChange();

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.state.status = "error";
				this.notifyStateChange();
				reject(new Error("Connection timeout"));
			}, this.config.connectionTimeout);

			try {
				this.websocket = new WebSocket(url);

				this.websocket.onopen = () => {
					clearTimeout(timeout);
					this.state.status = "connected";
					this.state.lastHeartbeat = new Date().toISOString();
					this.state.reconnectAttempts = 0; // Reset on successful connection
					this.notifyStateChange();
					this.startHeartbeat(this.config.heartbeatInterval);
					resolve();
				};

				this.websocket.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.notifyMessage(message);

						// Update latency if this is a heartbeat response
						if (message.type === "heartbeat" && message.payload?.timestamp) {
							const sentTime = new Date(message.payload.timestamp).getTime();
							const currentTime = Date.now();
							this.state.latency = currentTime - sentTime;
							this.state.lastHeartbeat = new Date().toISOString();
							this.notifyStateChange();
						}
					} catch (error) {
						console.error("Failed to parse WebSocket message:", error);
					}
				};

				this.websocket.onclose = (event) => {
					clearTimeout(timeout);
					this.stopHeartbeat();

					if (event.wasClean) {
						this.state.status = "disconnected";
					} else {
						this.state.status = "error";
					}

					this.notifyStateChange();
				};

				this.websocket.onerror = (error) => {
					clearTimeout(timeout);
					this.state.status = "error";
					this.notifyStateChange();
					reject(
						new Error(`WebSocket error: ${error.type || "Unknown error"}`),
					);
				};
			} catch (error) {
				clearTimeout(timeout);
				this.state.status = "error";
				this.notifyStateChange();
				reject(error);
			}
		});
	}

	async disconnect(): Promise<void> {
		this.stopHeartbeat();

		if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
			this.websocket.close(1000, "Normal closure");
		}

		this.state.status = "disconnected";
		this.state.lastHeartbeat = undefined;
		this.notifyStateChange();
	}

	async send(message: WebSocketMessage): Promise<void> {
		if (this.state.status !== "connected" || !this.websocket) {
			throw new Error("WebSocket not connected");
		}

		if (this.websocket.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket connection not ready");
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Message send timeout"));
			}, this.config.messageTimeout);

			try {
				this.websocket.send(JSON.stringify(message));
				clearTimeout(timeout);
				resolve();
			} catch (error) {
				clearTimeout(timeout);
				reject(error);
			}
		});
	}

	onMessage(callback: (message: WebSocketMessage) => void): void {
		this.messageCallbacks.push(callback);
	}

	onStateChange(callback: (state: WebSocketConnectionState) => void): void {
		this.stateCallbacks.push(callback);
	}

	getState(): WebSocketConnectionState {
		return { ...this.state };
	}

	isConnected(): boolean {
		return (
			this.state.status === "connected" &&
			this.websocket?.readyState === WebSocket.OPEN
		);
	}

	startHeartbeat(intervalMs: number): void {
		this.stopHeartbeat();

		this.heartbeatInterval = setInterval(async () => {
			if (this.isConnected()) {
				const heartbeat: WebSocketMessage = {
					id: `heartbeat-${Date.now()}`,
					type: "heartbeat",
					payload: { timestamp: new Date().toISOString() },
					timestamp: new Date().toISOString(),
				};

				try {
					await this.send(heartbeat);
				} catch (error) {
					console.error("Failed to send heartbeat:", error);
					// Connection might be lost, trigger reconnect
					this.handleConnectionLoss();
				}
			}
		}, intervalMs);
	}

	stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = undefined;
		}
	}

	async reconnect(): Promise<void> {
		this.state.reconnectAttempts++;

		if (this.state.reconnectAttempts > this.state.maxReconnectAttempts) {
			this.state.status = "error";
			this.notifyStateChange();
			throw new Error("Maximum reconnect attempts exceeded");
		}

		// Wait before reconnecting (exponential backoff)
		const delay = Math.min(
			1000 * 2 ** (this.state.reconnectAttempts - 1),
			30000,
		);
		await new Promise((resolve) => setTimeout(resolve, delay));

		await this.connect(this.state.url);
	}

	private notifyMessage(message: WebSocketMessage): void {
		this.messageCallbacks.forEach((callback) => {
			try {
				callback(message);
			} catch (error) {
				console.error("Error in message callback:", error);
			}
		});
	}

	private notifyStateChange(): void {
		this.stateCallbacks.forEach((callback) => {
			try {
				callback(this.getState());
			} catch (error) {
				console.error("Error in state change callback:", error);
			}
		});
	}

	private handleConnectionLoss(): void {
		if (this.state.status === "connected") {
			this.state.status = "disconnected";
			this.stopHeartbeat();
			this.notifyStateChange();

			// Attempt automatic reconnection
			this.reconnect().catch((error) => {
				console.error("Auto-reconnect failed:", error);
			});
		}
	}
}

// Factory function for creating VibeTunnel WebSocket connections
export function createVibeTunnelConnection(
	id: string,
	config?: WebSocketConnectionConfig,
): VibeTunnelWebSocketConnection {
	return new VibeTunnelWebSocketConnection(id, config);
}

// Connection manager for multiple WebSocket connections
export class VibeTunnelConnectionManager {
	private readonly connections: Map<string, VibeTunnelWebSocketConnection> =
		new Map();

	async createConnection(
		id: string,
		url: string,
		config?: WebSocketConnectionConfig,
	): Promise<VibeTunnelWebSocketConnection> {
		if (this.connections.has(id)) {
			throw new Error(`Connection with ID ${id} already exists`);
		}

		const connection = new VibeTunnelWebSocketConnection(id, config);
		await connection.connect(url);
		this.connections.set(id, connection);

		return connection;
	}

	getConnection(id: string): VibeTunnelWebSocketConnection | undefined {
		return this.connections.get(id);
	}

	async closeConnection(id: string): Promise<void> {
		const connection = this.connections.get(id);
		if (connection) {
			await connection.disconnect();
			this.connections.delete(id);
		}
	}

	async closeAllConnections(): Promise<void> {
		const promises = Array.from(this.connections.entries()).map(
			([id, connection]) => this.closeConnection(id),
		);
		await Promise.all(promises);
	}

	getActiveConnections(): string[] {
		return Array.from(this.connections.keys()).filter((id) => {
			const connection = this.connections.get(id);
			return connection?.isConnected();
		});
	}

	getConnectionStates(): Record<string, WebSocketConnectionState> {
		const states: Record<string, WebSocketConnectionState> = {};
		this.connections.forEach((connection, id) => {
			states[id] = connection.getState();
		});
		return states;
	}
}
