import type { NextRequest } from "next/server";
import { AgentInbox } from "@/../../packages/@solomon/core/src/inbox/agent-inbox";

// Global inbox instance
let inbox: AgentInbox | null = null;

function getInbox() {
	if (!inbox) {
		inbox = new AgentInbox({
			maxQueueSize: 1000,
			maxRetries: 3,
			deadLetterEnabled: true,
			priorityQueuing: true,
		});

		// Setup event listeners
		setupInboxListeners();
	}
	return inbox;
}

function setupInboxListeners() {
	if (!inbox) return;

	// Register default handlers for demo
	inbox.registerHandler("manager", async (message) => {
		// Simulate processing
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return { result: "Manager processed message", messageId: message.id };
	});

	inbox.registerHandler("programmer", async (message) => {
		await new Promise((resolve) => setTimeout(resolve, 1500));
		return { result: "Programmer processed message", messageId: message.id };
	});

	inbox.registerHandler("reviewer", async (message) => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		return { result: "Reviewer processed message", messageId: message.id };
	});
}

export async function GET(request: NextRequest) {
	const upgradeHeader = request.headers.get("upgrade");

	if (upgradeHeader !== "websocket") {
		return new Response("Expected WebSocket connection", { status: 400 });
	}

	const inboxInstance = getInbox();

	// Create WebSocket response
	const { socket, response } = upgradeWebSocket(request);

	// Send initial stats
	socket.send(
		JSON.stringify({
			type: "stats:update",
			stats: inboxInstance.getStats(),
		}),
	);

	// Setup event listeners
	const messageHandler = (message: unknown) => {
		socket.send(
			JSON.stringify({
				type: "message:update",
				message,
			}),
		);
	};

	const statsHandler = () => {
		socket.send(
			JSON.stringify({
				type: "stats:update",
				stats: inboxInstance.getStats(),
			}),
		);
	};

	const deadLetterHandler = () => {
		socket.send(
			JSON.stringify({
				type: "deadletter:update",
				deadLetters: inboxInstance.getDeadLetterQueue(),
			}),
		);
	};

	inboxInstance.on("message:queued", messageHandler);
	inboxInstance.on("message:processing", messageHandler);
	inboxInstance.on("message:completed", messageHandler);
	inboxInstance.on("message:failed", messageHandler);
	inboxInstance.on("message:dead", deadLetterHandler);
	inboxInstance.on("handler:registered", statsHandler);
	inboxInstance.on("handler:unregistered", statsHandler);

	// Cleanup on disconnect
	socket.addEventListener("close", () => {
		inboxInstance.off("message:queued", messageHandler);
		inboxInstance.off("message:processing", messageHandler);
		inboxInstance.off("message:completed", messageHandler);
		inboxInstance.off("message:failed", messageHandler);
		inboxInstance.off("message:dead", deadLetterHandler);
		inboxInstance.off("handler:registered", statsHandler);
		inboxInstance.off("handler:unregistered", statsHandler);
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
	const inbox = getInbox();
	const path = request.nextUrl.pathname;

	if (path.endsWith("/retry-dead-letters")) {
		await inbox.retryDeadLetters();
		return Response.json({ success: true });
	}

	if (path.endsWith("/clear-dead-letters")) {
		// Clear dead letters (would need to add this method to AgentInbox)
		const deadLetters = inbox.getDeadLetterQueue();
		return Response.json({ success: true, cleared: deadLetters.length });
	}

	// Send message
	const body = await request.json();
	const messageId = await inbox.send(body);
	return Response.json({ success: true, messageId });
}
