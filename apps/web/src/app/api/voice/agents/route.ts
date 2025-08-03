/**
 * Voice Agents API Route
 * Handles communication with Letta voice agents through the orchestration system
 */

import { type NextRequest, NextResponse } from "next/server";
import {
	AgentType,
	agentOrchestrationService,
} from "@/lib/voice/agent-orchestration";
import { AgentFactory } from "@/lib/voice/specialized-agents";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			message,
			sessionId,
			userId,
			agentType: _agentType,
			context: _context,
		} = body;

		if (!message || !sessionId || !userId) {
			return NextResponse.json(
				{ error: "Missing required parameters: message, sessionId, userId" },
				{ status: 400 },
			);
		}

		// Ensure agents are registered with the orchestration service
		await ensureAgentsRegistered();

		// Process message through orchestration system
		const response = await agentOrchestrationService.processVoiceMessage(
			message,
			sessionId,
			userId,
		);

		// Get conversation context
		const conversationContext = agentOrchestrationService.getContext(sessionId);

		return NextResponse.json({
			success: true,
			response: {
				messageId: response.messageId,
				agentId: response.agentId,
				content: response.content,
				metadata: response.metadata,
			},
			context: {
				currentAgent: conversationContext?.currentAgentId,
				intent: conversationContext?.currentIntent,
				messageCount: conversationContext?.metadata.messageCount,
			},
		});
	} catch (error) {
		console.error("Agent communication error:", error);
		return NextResponse.json(
			{
				error: "Agent communication failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get("sessionId");

		if (sessionId) {
			// Get specific session context
			const context = agentOrchestrationService.getContext(sessionId);

			return NextResponse.json({
				sessionId,
				context: context
					? {
							currentAgent: context.currentAgentId,
							intent: context.currentIntent,
							messageCount: context.metadata.messageCount,
							lastActivity: context.metadata.lastActivity,
						}
					: null,
			});
		}

		// Return general agent information
		const router = agentOrchestrationService.getRouter();
		const availableAgents = router.getAvailableAgents();

		return NextResponse.json({
			message: "Voice agents endpoint",
			availableAgents,
			methods: ["GET", "POST"],
			endpoints: {
				"POST /": "Send message to agent orchestration system",
				"GET /?sessionId=<id>": "Get session context",
				"DELETE /?sessionId=<id>": "Clear session context",
			},
		});
	} catch (error) {
		console.error("Agent info error:", error);
		return NextResponse.json(
			{
				error: "Failed to get agent information",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get("sessionId");

		if (!sessionId) {
			return NextResponse.json(
				{ error: "Missing sessionId parameter" },
				{ status: 400 },
			);
		}

		// Clear session context
		agentOrchestrationService.clearContext(sessionId);

		return NextResponse.json({
			success: true,
			message: `Session ${sessionId} context cleared`,
		});
	} catch (error) {
		console.error("Session clear error:", error);
		return NextResponse.json(
			{
				error: "Failed to clear session",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

/**
 * Ensure all specialized agents are registered with the orchestration service
 */
async function ensureAgentsRegistered(): Promise<void> {
	try {
		const router = agentOrchestrationService.getRouter();
		const availableAgents = router.getAvailableAgents();

		// Register Voice Agent if not already registered
		if (!availableAgents.includes(AgentType.VOICE)) {
			const _voiceAgent = await AgentFactory.createVoiceAgent(
				"voice-agent-default",
			);
			// Note: We need to adapt the VoiceAgent to implement LettaVoiceAgent interface
			// For now, we'll register a placeholder
			console.log("Voice agent created but needs interface adaptation");
		}

		// Register Code Agent if not already registered
		if (!availableAgents.includes(AgentType.CODE)) {
			const _codeAgent =
				await AgentFactory.createCodeAgent("code-agent-default");
			console.log("Code agent created but needs interface adaptation");
		}

		// Register Task Agent if not already registered
		if (!availableAgents.includes(AgentType.TASK)) {
			const _taskAgent =
				await AgentFactory.createTaskAgent("task-agent-default");
			console.log("Task agent created but needs interface adaptation");
		}
	} catch (error) {
		console.error("Failed to register agents:", error);
		// Don't throw here - let the system work with available agents
	}
}
