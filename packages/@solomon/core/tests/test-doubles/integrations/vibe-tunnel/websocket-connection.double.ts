/**
 * WebSocket Connection Test Double
 * TDD London School approach for VibeTunnel WebSocket connections
 */

import { expect, vi } from "vitest";

export interface WebSocketConnectionState {
	id: string;
	url: string;
	status: "connecting" | "connected" | "disconnected" | "error";
	lastHeartbeat?: string;
	latency?: number;
	reconnectAttempts: number;
	maxReconnectAttempts: number;
}

export interface WebSocketMessage {
	id: string;
	type: "command" | "response" | "heartbeat" | "error";
	payload: any;
	timestamp: string;
	priority?: "low" | "medium" | "high" | "critical";
}

export interface WebSocketConnectionCapabilities {
	connect(url: string): Promise<void>;
	disconnect(): Promise<void>;
	send(message: WebSocketMessage): Promise<void>;
	onMessage(callback: (message: WebSocketMessage) => void): void;
	onStateChange(callback: (state: WebSocketConnectionState) => void): void;
	getState(): WebSocketConnectionState;
	isConnected(): boolean;
	startHeartbeat(intervalMs: number): void;
	stopHeartbeat(): void;
	reconnect(): Promise<void>;
}

export class WebSocketConnectionDouble
	implements WebSocketConnectionCapabilities
{
	private state: WebSocketConnectionState;
	private messageCallbacks: ((message: WebSocketMessage) => void)[] = [];
	private stateCallbacks: ((state: WebSocketConnectionState) => void)[] = [];
	private heartbeatInterval?: NodeJS.Timeout;

	// Test helpers for controlling behavior
	public shouldFailConnection = false;
	public shouldFailSend = false;
	public simulateLatency = 0;
	public messageLog: WebSocketMessage[] = [];
	public connectionLog: string[] = [];

	constructor(id = "ws-test-connection") {
		this.state = {
			id,
			url: "",
			status: "disconnected",
			reconnectAttempts: 0,
			maxReconnectAttempts: 3,
		};
	}

	async connect(url: string): Promise<void> {
		this.connectionLog.push(`connect:${url}`);
		this.state.url = url;
		this.state.status = "connecting";
		this.notifyStateChange();

		if (this.shouldFailConnection) {
			this.state.status = "error";
			this.notifyStateChange();
			throw new Error("Simulated connection failure");
		}

		// Simulate connection delay
		if (this.simulateLatency > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateLatency));
		}

		this.state.status = "connected";
		this.state.lastHeartbeat = new Date().toISOString();
		this.notifyStateChange();
	}

	async disconnect(): Promise<void> {
		this.connectionLog.push("disconnect");
		this.stopHeartbeat();
		this.state.status = "disconnected";
		this.state.lastHeartbeat = undefined;
		this.notifyStateChange();
	}

	async send(message: WebSocketMessage): Promise<void> {
		this.messageLog.push({ ...message });

		if (this.state.status !== "connected") {
			throw new Error("WebSocket not connected");
		}

		if (this.shouldFailSend) {
			throw new Error("Simulated send failure");
		}

		// Simulate latency
		if (this.simulateLatency > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.simulateLatency));
		}
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
		return this.state.status === "connected";
	}

	startHeartbeat(intervalMs: number): void {
		this.stopHeartbeat(); // Clear any existing heartbeat

		this.heartbeatInterval = setInterval(() => {
			if (this.state.status === "connected") {
				this.state.lastHeartbeat = new Date().toISOString();
				this.notifyStateChange();

				// Send heartbeat message
				const heartbeat: WebSocketMessage = {
					id: `heartbeat-${Date.now()}`,
					type: "heartbeat",
					payload: { timestamp: this.state.lastHeartbeat },
					timestamp: this.state.lastHeartbeat,
				};
				this.notifyMessage(heartbeat);
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
		this.connectionLog.push("reconnect");
		this.state.reconnectAttempts++;

		if (this.state.reconnectAttempts > this.state.maxReconnectAttempts) {
			this.state.status = "error";
			this.notifyStateChange();
			throw new Error("Maximum reconnect attempts exceeded");
		}

		await this.connect(this.state.url);
	}

	// Test helper methods
	simulateIncomingMessage(message: WebSocketMessage): void {
		this.notifyMessage(message);
	}

	simulateConnectionLoss(): void {
		this.state.status = "disconnected";
		this.stopHeartbeat();
		this.notifyStateChange();
	}

	simulateNetworkError(): void {
		this.state.status = "error";
		this.stopHeartbeat();
		this.notifyStateChange();
	}

	getMessageLog(): WebSocketMessage[] {
		return [...this.messageLog];
	}

	getConnectionLog(): string[] {
		return [...this.connectionLog];
	}

	clearLogs(): void {
		this.messageLog = [];
		this.connectionLog = [];
	}

	resetState(): void {
		this.clearLogs();
		this.stopHeartbeat();
		this.state = {
			id: this.state.id,
			url: "",
			status: "disconnected",
			reconnectAttempts: 0,
			maxReconnectAttempts: 3,
		};
		this.shouldFailConnection = false;
		this.shouldFailSend = false;
		this.simulateLatency = 0;
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
}

// Helper functions for test setup
export function createWebSocketConnectionDouble(
	id?: string,
	options: Partial<{
		shouldFailConnection: boolean;
		shouldFailSend: boolean;
		simulateLatency: number;
	}> = {},
): WebSocketConnectionDouble {
	const double = new WebSocketConnectionDouble(id);

	if (options.shouldFailConnection) {
		double.shouldFailConnection = true;
	}
	if (options.shouldFailSend) {
		double.shouldFailSend = true;
	}
	if (options.simulateLatency) {
		double.simulateLatency = options.simulateLatency;
	}

	return double;
}

export function expectWebSocketConnection(
	connection: WebSocketConnectionDouble,
) {
	return {
		toHaveConnectedTo: (url: string) => {
			expect(connection.getConnectionLog()).toContain(`connect:${url}`);
		},

		toHaveDisconnected: () => {
			expect(connection.getConnectionLog()).toContain("disconnect");
		},

		toHaveSentMessage: (message: Partial<WebSocketMessage>) => {
			const sentMessages = connection.getMessageLog();
			const matchingMessage = sentMessages.find((msg) =>
				Object.entries(message).every(
					([key, value]) => msg[key as keyof WebSocketMessage] === value,
				),
			);
			expect(matchingMessage).toBeDefined();
		},

		toHaveState: (expectedState: Partial<WebSocketConnectionState>) => {
			const currentState = connection.getState();
			Object.entries(expectedState).forEach(([key, value]) => {
				expect(currentState[key as keyof WebSocketConnectionState]).toBe(value);
			});
		},

		toBeConnected: () => {
			expect(connection.isConnected()).toBe(true);
		},

		toBeDisconnected: () => {
			expect(connection.isConnected()).toBe(false);
		},
	};
}
