/**
 * VibeTunnel WebSocket Connection Tests
 * TDD London School approach with comprehensive test coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	WebSocketConnectionState,
	WebSocketMessage,
} from "../../tests/test-doubles/integrations/vibe-tunnel/websocket-connection.double";
import {
	createVibeTunnelConnection,
	VibeTunnelConnectionManager,
	VibeTunnelWebSocketConnection,
} from "./websocket-connection";

// Mock WebSocket for testing
class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	public readyState = MockWebSocket.CONNECTING;
	public onopen: ((event: Event) => void) | null = null;
	public onclose: ((event: CloseEvent) => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public onerror: ((event: Event) => void) | null = null;

	constructor(public url: string) {}

	send(data: string) {
		if (this.readyState !== MockWebSocket.OPEN) {
			throw new Error("WebSocket is not open");
		}
	}

	close(code?: number, reason?: string) {
		this.readyState = MockWebSocket.CLOSING;
		setTimeout(() => {
			this.readyState = MockWebSocket.CLOSED;
			const event = new CloseEvent("close", {
				code: code || 1000,
				reason: reason || "",
				wasClean: true,
			});
			this.onclose?.(event);
		}, 10);
	}

	// Test helpers
	simulateOpen() {
		this.readyState = MockWebSocket.OPEN;
		const event = new Event("open");
		this.onopen?.(event);
	}

	simulateMessage(data: any) {
		const event = new MessageEvent("message", { data: JSON.stringify(data) });
		this.onmessage?.(event);
	}

	simulateError() {
		const event = new Event("error");
		event.type = "connection_failed";
		this.onerror?.(event);
	}
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe("VibeTunnelWebSocketConnection", () => {
	let connection: VibeTunnelWebSocketConnection;
	let mockWebSocket: MockWebSocket;

	beforeEach(() => {
		connection = new VibeTunnelWebSocketConnection("test-connection");
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (connection.isConnected()) {
			connection.disconnect();
		}
	});

	describe("Connection Management", () => {
		it("should initialize with disconnected state", () => {
			const state = connection.getState();

			expect(state.id).toBe("test-connection");
			expect(state.status).toBe("disconnected");
			expect(state.url).toBe("");
			expect(state.reconnectAttempts).toBe(0);
			expect(state.maxReconnectAttempts).toBe(3);
		});

		it("should connect to WebSocket successfully", async () => {
			const connectPromise = connection.connect("ws://localhost:8080");

			// Get the mock WebSocket instance
			mockWebSocket = (global.WebSocket as any).mock.instances[0];

			// Simulate successful connection
			setTimeout(() => mockWebSocket.simulateOpen(), 10);

			await connectPromise;

			const state = connection.getState();
			expect(state.status).toBe("connected");
			expect(state.url).toBe("ws://localhost:8080");
			expect(connection.isConnected()).toBe(true);
		});

		it("should handle connection timeout", async () => {
			const connection = new VibeTunnelWebSocketConnection("test", {
				connectionTimeout: 100,
			});

			await expect(connection.connect("ws://localhost:8080")).rejects.toThrow(
				"Connection timeout",
			);

			const state = connection.getState();
			expect(state.status).toBe("error");
		});

		it("should handle connection errors", async () => {
			const connectPromise = connection.connect("ws://localhost:8080");

			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			setTimeout(() => mockWebSocket.simulateError(), 10);

			await expect(connectPromise).rejects.toThrow("WebSocket error");

			const state = connection.getState();
			expect(state.status).toBe("error");
		});

		it("should disconnect gracefully", async () => {
			await connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			mockWebSocket.simulateOpen();

			await connection.disconnect();

			const state = connection.getState();
			expect(state.status).toBe("disconnected");
			expect(connection.isConnected()).toBe(false);
		});
	});

	describe("Message Handling", () => {
		beforeEach(async () => {
			const connectPromise = connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			setTimeout(() => mockWebSocket.simulateOpen(), 10);
			await connectPromise;
		});

		it("should send messages successfully", async () => {
			const message: WebSocketMessage = {
				id: "test-msg-1",
				type: "command",
				payload: { command: "ls -la" },
				timestamp: new Date().toISOString(),
			};

			const sendSpy = vi.spyOn(mockWebSocket, "send");

			await connection.send(message);

			expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
		});

		it("should reject messages when not connected", async () => {
			await connection.disconnect();

			const message: WebSocketMessage = {
				id: "test-msg-1",
				type: "command",
				payload: {},
				timestamp: new Date().toISOString(),
			};

			await expect(connection.send(message)).rejects.toThrow(
				"WebSocket not connected",
			);
		});

		it("should handle message timeout", async () => {
			const connection = new VibeTunnelWebSocketConnection("test", {
				messageTimeout: 100,
			});

			await connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			mockWebSocket.simulateOpen();

			// Mock send to throw error
			vi.spyOn(mockWebSocket, "send").mockImplementation(() => {
				throw new Error("Network error");
			});

			const message: WebSocketMessage = {
				id: "test-msg-1",
				type: "command",
				payload: {},
				timestamp: new Date().toISOString(),
			};

			await expect(connection.send(message)).rejects.toThrow("Network error");
		});

		it("should receive and process messages", async () => {
			const messages: WebSocketMessage[] = [];
			connection.onMessage((msg) => messages.push(msg));

			const testMessage: WebSocketMessage = {
				id: "incoming-1",
				type: "response",
				payload: { result: "success" },
				timestamp: new Date().toISOString(),
			};

			mockWebSocket.simulateMessage(testMessage);

			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual(testMessage);
		});
	});

	describe("Heartbeat Functionality", () => {
		beforeEach(async () => {
			const connectPromise = connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			setTimeout(() => mockWebSocket.simulateOpen(), 10);
			await connectPromise;
		});

		it("should start heartbeat on connection", () => {
			connection.startHeartbeat(1000);

			// Verify heartbeat is running by checking state updates
			const initialState = connection.getState();
			expect(initialState.lastHeartbeat).toBeDefined();
		});

		it("should stop heartbeat on disconnect", async () => {
			connection.startHeartbeat(1000);
			await connection.disconnect();

			// Should not crash or continue sending heartbeats
			expect(connection.isConnected()).toBe(false);
		});

		it("should calculate latency from heartbeat responses", async () => {
			connection.startHeartbeat(100);

			const heartbeatResponse: WebSocketMessage = {
				id: "heartbeat-response",
				type: "heartbeat",
				payload: { timestamp: new Date().toISOString() },
				timestamp: new Date().toISOString(),
			};

			mockWebSocket.simulateMessage(heartbeatResponse);

			const state = connection.getState();
			expect(state.latency).toBeDefined();
			expect(typeof state.latency).toBe("number");
		});
	});

	describe("Reconnection Logic", () => {
		it("should reconnect after connection loss", async () => {
			await connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			mockWebSocket.simulateOpen();

			const initialState = connection.getState();
			expect(initialState.reconnectAttempts).toBe(0);

			// Test reconnection logic
			await connection.reconnect();

			const newState = connection.getState();
			expect(newState.reconnectAttempts).toBe(1);
		});

		it("should fail after max reconnect attempts", async () => {
			const connection = new VibeTunnelWebSocketConnection("test", {
				reconnectAttempts: 2,
			});

			await connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			mockWebSocket.simulateOpen();

			// Simulate multiple failed reconnects
			connection.getState().reconnectAttempts = 2;

			await expect(connection.reconnect()).rejects.toThrow(
				"Maximum reconnect attempts exceeded",
			);
		});
	});

	describe("State Management", () => {
		it("should notify state change listeners", async () => {
			const stateChanges: WebSocketConnectionState[] = [];
			connection.onStateChange((state) => stateChanges.push(state));

			await connection.connect("ws://localhost:8080");
			mockWebSocket = (global.WebSocket as any).mock.instances[0];
			mockWebSocket.simulateOpen();

			expect(stateChanges.length).toBeGreaterThan(0);
			expect(stateChanges[0].status).toBe("connecting");
			expect(stateChanges[stateChanges.length - 1].status).toBe("connected");
		});

		it("should provide immutable state snapshots", () => {
			const state1 = connection.getState();
			const state2 = connection.getState();

			expect(state1).not.toBe(state2);
			expect(state1).toEqual(state2);
		});
	});
});

describe("VibeTunnelConnectionManager", () => {
	let manager: VibeTunnelConnectionManager;

	beforeEach(() => {
		manager = new VibeTunnelConnectionManager();
	});

	afterEach(async () => {
		await manager.closeAllConnections();
	});

	describe("Connection Management", () => {
		it("should create and manage multiple connections", async () => {
			const connection1Promise = manager.createConnection(
				"conn-1",
				"ws://localhost:8080",
			);

			const connection2Promise = manager.createConnection(
				"conn-2",
				"ws://localhost:8081",
			);

			// Mock WebSocket connections
			setTimeout(() => {
				const instances = (global.WebSocket as any).mock.instances;
				instances.forEach((ws: MockWebSocket) => ws.simulateOpen());
			}, 10);

			const [conn1, conn2] = await Promise.all([
				connection1Promise,
				connection2Promise,
			]);

			expect(conn1.getState().id).toBe("conn-1");
			expect(conn2.getState().id).toBe("conn-2");
			expect(manager.getConnection("conn-1")).toBe(conn1);
			expect(manager.getConnection("conn-2")).toBe(conn2);
		});

		it("should prevent duplicate connection IDs", async () => {
			const connection1Promise = manager.createConnection(
				"conn-1",
				"ws://localhost:8080",
			);

			setTimeout(() => {
				const instances = (global.WebSocket as any).mock.instances;
				instances[0].simulateOpen();
			}, 10);

			await connection1Promise;

			await expect(
				manager.createConnection("conn-1", "ws://localhost:8081"),
			).rejects.toThrow("Connection with ID conn-1 already exists");
		});

		it("should close specific connections", async () => {
			const connectionPromise = manager.createConnection(
				"conn-1",
				"ws://localhost:8080",
			);

			setTimeout(() => {
				const instances = (global.WebSocket as any).mock.instances;
				instances[0].simulateOpen();
			}, 10);

			const connection = await connectionPromise;
			expect(connection.isConnected()).toBe(true);

			await manager.closeConnection("conn-1");
			expect(manager.getConnection("conn-1")).toBeUndefined();
		});

		it("should get active connections list", async () => {
			const connection1Promise = manager.createConnection(
				"conn-1",
				"ws://localhost:8080",
			);
			const connection2Promise = manager.createConnection(
				"conn-2",
				"ws://localhost:8081",
			);

			setTimeout(() => {
				const instances = (global.WebSocket as any).mock.instances;
				instances.forEach((ws: MockWebSocket) => ws.simulateOpen());
			}, 10);

			await Promise.all([connection1Promise, connection2Promise]);

			const activeConnections = manager.getActiveConnections();
			expect(activeConnections).toHaveLength(2);
			expect(activeConnections).toContain("conn-1");
			expect(activeConnections).toContain("conn-2");
		});

		it("should get connection states", async () => {
			const connectionPromise = manager.createConnection(
				"conn-1",
				"ws://localhost:8080",
			);

			setTimeout(() => {
				const instances = (global.WebSocket as any).mock.instances;
				instances[0].simulateOpen();
			}, 10);

			await connectionPromise;

			const states = manager.getConnectionStates();
			expect(states["conn-1"]).toBeDefined();
			expect(states["conn-1"].status).toBe("connected");
		});
	});
});

describe("createVibeTunnelConnection Factory", () => {
	it("should create connection with default config", () => {
		const connection = createVibeTunnelConnection("test-conn");

		expect(connection).toBeInstanceOf(VibeTunnelWebSocketConnection);
		expect(connection.getState().id).toBe("test-conn");
	});

	it("should create connection with custom config", () => {
		const connection = createVibeTunnelConnection("test-conn", {
			reconnectAttempts: 5,
			heartbeatInterval: 10000,
		});

		expect(connection).toBeInstanceOf(VibeTunnelWebSocketConnection);
		expect(connection.getState().maxReconnectAttempts).toBe(5);
	});
});
