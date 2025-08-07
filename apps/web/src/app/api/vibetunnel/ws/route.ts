import type { NextRequest } from "next/server";
import {
	loadVibeTunnelConfig,
	VibeTunnelManager,
} from "@/../../packages/@solomon/core/src/vibetunnel/vibetunnel-manager";

// Global VibeTunnel manager instance
let vibeTunnelManager: VibeTunnelManager | null = null;

function getVibeTunnelManager() {
	if (!vibeTunnelManager) {
		const config = loadVibeTunnelConfig();
		vibeTunnelManager = new VibeTunnelManager(config);

		// Auto-start if enabled
		if (config.enabled) {
			vibeTunnelManager
				.start()
				.then((results) => {
					console.log("VibeTunnel started:", results);
				})
				.catch((error) => {
					console.error("Failed to start VibeTunnel:", error);
				});
		}
	}
	return vibeTunnelManager;
}

export async function GET(request: NextRequest) {
	const upgradeHeader = request.headers.get("upgrade");

	if (upgradeHeader !== "websocket") {
		return new Response("Expected WebSocket connection", { status: 400 });
	}

	const manager = getVibeTunnelManager();

	// Create WebSocket response
	const { socket, response } = upgradeWebSocket(request);

	// Send initial status
	socket.send(
		JSON.stringify({
			type: "status:update",
			tunnels: manager.getStatus(),
		}),
	);

	// Setup event listeners
	interface TunnelResult {
		service: string;
		url?: string;
		error?: string;
	}

	const tunnelStartedHandler = (result: TunnelResult) => {
		socket.send(
			JSON.stringify({
				type: "tunnel:connected",
				service: result.service,
				url: result.url,
			}),
		);

		socket.send(
			JSON.stringify({
				type: "status:update",
				tunnels: manager.getStatus(),
			}),
		);
	};

	const tunnelFailedHandler = (result: TunnelResult) => {
		socket.send(
			JSON.stringify({
				type: "tunnel:error",
				service: result.service,
				error: result.error,
			}),
		);

		socket.send(
			JSON.stringify({
				type: "status:update",
				tunnels: manager.getStatus(),
			}),
		);
	};

	const tunnelStoppedHandler = (tunnelId: string) => {
		socket.send(
			JSON.stringify({
				type: "tunnel:disconnected",
				tunnelId,
			}),
		);

		socket.send(
			JSON.stringify({
				type: "status:update",
				tunnels: manager.getStatus(),
			}),
		);
	};

	manager.on("tunnel:started", tunnelStartedHandler);
	manager.on("tunnel:failed", tunnelFailedHandler);
	manager.on("tunnel:stopped", tunnelStoppedHandler);

	// Send periodic status updates
	const statusInterval = setInterval(() => {
		socket.send(
			JSON.stringify({
				type: "status:update",
				tunnels: manager.getStatus(),
			}),
		);
	}, 5000);

	// Cleanup on disconnect
	socket.addEventListener("close", () => {
		clearInterval(statusInterval);
		manager.off("tunnel:started", tunnelStartedHandler);
		manager.off("tunnel:failed", tunnelFailedHandler);
		manager.off("tunnel:stopped", tunnelStoppedHandler);
	});

	return response;
}

// Helper function to upgrade to WebSocket
function upgradeWebSocket(_request: NextRequest) {
	// This is a simplified version - in production, you'd use a proper WebSocket library
	const socket = new WebSocket("ws://localhost");
	const response = new Response(null, {
		status: 101,
		headers: {
			Upgrade: "websocket",
			Connection: "Upgrade",
		},
	});

	return { socket, response };
}

export async function POST(request: NextRequest) {
	const manager = getVibeTunnelManager();
	const path = request.nextUrl.pathname;

	if (path.endsWith("/execute")) {
		const { command } = await request.json();

		// Simulate command execution
		try {
			if (command === "vt status") {
				const status = manager.getStatus();
				return Response.json({
					success: true,
					output: JSON.stringify(status, null, 2),
				});
			}

			if (command === "vt start") {
				const results = await manager.start();
				return Response.json({
					success: true,
					output: `Started ${results.length} tunnels`,
				});
			}

			if (command === "vt stop") {
				await manager.stop();
				return Response.json({
					success: true,
					output: "All tunnels stopped",
				});
			}

			return Response.json({
				success: false,
				error: `Unknown command: ${command}`,
			});
		} catch (error) {
			return Response.json({
				success: false,
				error: error instanceof Error ? error.message : "Command failed",
			});
		}
	}

	return Response.json({ error: "Invalid endpoint" }, { status: 404 });
}
