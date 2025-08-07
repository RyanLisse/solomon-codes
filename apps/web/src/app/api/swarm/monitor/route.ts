import type { NextRequest } from "next/server";

// Mock swarm metrics for demonstration
let mockMetrics = {
	activeAgents: 4,
	totalTasks: 127,
	completedTasks: 89,
	avgResponseTime: 234,
	consensusRate: 0.92,
	cacheHitRate: 0.78,
};

let mockAgents = [
	{
		id: "agent_001",
		type: "Queen",
		status: "busy",
		currentTask: "Orchestrating swarm",
		performance: 95,
	},
	{
		id: "agent_002",
		type: "Programmer",
		status: "busy",
		currentTask: "Implementing feature",
		performance: 87,
	},
	{ id: "agent_003", type: "Reviewer", status: "idle", performance: 92 },
	{
		id: "agent_004",
		type: "Planner",
		status: "busy",
		currentTask: "Designing architecture",
		performance: 88,
	},
];

export async function GET(request: NextRequest) {
	const upgradeHeader = request.headers.get("upgrade");

	if (upgradeHeader !== "websocket") {
		return new Response("Expected WebSocket connection", { status: 400 });
	}

	// Create WebSocket response
	const { socket, response } = upgradeWebSocket(request);

	// Send initial data
	socket.send(
		JSON.stringify({
			type: "metrics:update",
			metrics: mockMetrics,
		}),
	);

	socket.send(
		JSON.stringify({
			type: "agents:update",
			agents: mockAgents,
		}),
	);

	socket.send(
		JSON.stringify({
			type: "topology:change",
			topology: "hierarchical",
		}),
	);

	// Simulate periodic updates
	const metricsInterval = setInterval(() => {
		// Update mock metrics
		mockMetrics = {
			...mockMetrics,
			activeAgents: Math.floor(Math.random() * 8) + 1,
			totalTasks: mockMetrics.totalTasks + Math.floor(Math.random() * 5),
			completedTasks: Math.min(
				mockMetrics.completedTasks + Math.floor(Math.random() * 3),
				mockMetrics.totalTasks,
			),
			avgResponseTime: Math.floor(Math.random() * 500) + 100,
			consensusRate: Math.random() * 0.3 + 0.7,
			cacheHitRate: Math.random() * 0.4 + 0.6,
		};

		socket.send(
			JSON.stringify({
				type: "metrics:update",
				metrics: mockMetrics,
			}),
		);
	}, 3000);

	const agentsInterval = setInterval(() => {
		// Update agent statuses
		mockAgents = mockAgents.map((agent) => ({
			...agent,
			status: Math.random() > 0.3 ? "busy" : "idle",
			currentTask:
				Math.random() > 0.3
					? `Task_${Math.floor(Math.random() * 1000)}`
					: undefined,
			performance: Math.floor(Math.random() * 30) + 70,
		}));

		socket.send(
			JSON.stringify({
				type: "agents:update",
				agents: mockAgents,
			}),
		);
	}, 5000);

	// Cleanup on disconnect
	socket.addEventListener("close", () => {
		clearInterval(metricsInterval);
		clearInterval(agentsInterval);
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
