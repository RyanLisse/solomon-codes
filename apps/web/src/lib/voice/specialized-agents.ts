/**
 * Specialized Letta Agents
 * Voice Agent, Code Agent, and Task Agent with specific memory blocks and tools
 */

import type {
	LettaMemoryBlock,
	VoiceAgentResponse,
} from "@/components/voice/types";
import { createLettaClient, type LettaClient } from "@/lib/letta";

export interface AgentConfig {
	name: string;
	type: string;
	memoryBlocks: LettaMemoryBlock[];
	tools: string[];
	model: string;
	embedding: string;
	systemPrompt?: string;
	temperature?: number;
}

export interface CodingContext {
	projectType: string;
	technologies: string[];
	currentFile?: string;
	repository?: string;
}

export interface TaskContext {
	projectId?: string;
	repository?: string;
	currentSprint?: string;
	assignedTasks: string[];
}

export interface ImageAnalysis {
	description: string;
	extractedText: string;
	uiElements: UIElement[];
	designPatterns: string[];
}

export interface UIElement {
	type: string;
	bounds: { x: number; y: number; width: number; height: number };
	text?: string;
	styles?: Record<string, string>;
}

/**
 * Voice Agent - Handles speech processing and natural conversation
 */
export class VoiceAgent {
	private lettaClient: LettaClient;
	private agentId: string;
	private config: AgentConfig;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.lettaClient = createLettaClient();
		this.config = {
			name: "VoiceAssistant",
			type: "voice",
			memoryBlocks: [
				{
					label: "persona",
					value:
						"I am a helpful voice assistant that specializes in natural conversation and helping users navigate the solomon_codes platform through speech and visual content analysis. I maintain context across conversations and can route users to specialized agents when needed.",
					description: "Core personality and role definition",
				},
				{
					label: "human",
					value:
						"User preferences and conversation context will be stored here as I learn about the user through our interactions.",
					description: "User-specific context and preferences",
				},
				{
					label: "voice_preferences",
					value:
						"User voice interaction preferences, language settings, and accessibility needs will be tracked here.",
					description:
						"Voice-specific user preferences and accessibility requirements",
				},
				{
					label: "visual_memory",
					value:
						"Descriptions and analysis of images and screenshots shared by the user will be stored here for reference.",
					description: "Visual content context and analysis history",
				},
				{
					label: "conversation_context",
					value:
						"Current conversation flow, topics discussed, and context for maintaining coherent dialogue.",
					description: "Active conversation state and context",
				},
			],
			tools: [
				"speech_to_text",
				"text_to_speech",
				"route_to_agent",
				"update_voice_preferences",
				"analyze_image",
				"extract_text_from_image",
				"manage_conversation_context",
			],
			model: "gpt-4o",
			embedding: "text-embedding-3-small",
		};
	}

	async initialize(): Promise<void> {
		try {
			const agent = await this.lettaClient.agents.create({
				name: this.config.name,
				memoryBlocks: this.config.memoryBlocks,
				tools: this.config.tools,
				model: this.config.model,
				embedding: this.config.embedding,
			});
			this.agentId = agent.id;
		} catch (error) {
			console.error("Failed to initialize Voice Agent:", error);
			throw error;
		}
	}

	async processVoiceInput(transcript: string): Promise<VoiceAgentResponse> {
		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: transcript }] },
		);

		const firstMessage = response.messages[0];
		return {
			messageId: `voice-${Date.now()}`,
			agentId: this.agentId,
			content: firstMessage?.content || "No response generated",
			memoryUpdates: [],
			toolCalls: [],
			metadata: {
				processingTime: 100,
				confidence: 0.95,
				voiceGenerated: false,
			},
		};
	}

	async processImageUpload(_imageData: ArrayBuffer): Promise<ImageAnalysis> {
		// Placeholder for image analysis
		return {
			description: "Image analysis not yet implemented",
			extractedText: "",
			uiElements: [],
			designPatterns: [],
		};
	}

	async combineVoiceAndVisual(
		voiceInput: string,
		imageAnalysis: ImageAnalysis,
	): Promise<VoiceAgentResponse> {
		const combinedPrompt = `
    Voice input: ${voiceInput}
    
    Visual context: ${imageAnalysis.description}
    Extracted text: ${imageAnalysis.extractedText}
    UI elements found: ${imageAnalysis.uiElements.length}
    
    Please provide a response that takes both the voice input and visual context into account.
    `;

		return this.processVoiceInput(combinedPrompt);
	}
}

/**
 * Code Agent - Handles code generation and review with VibeKit integration
 */
export class CodeAgent {
	private lettaClient: LettaClient;
	private agentId: string;
	private config: AgentConfig;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.lettaClient = createLettaClient();
		this.config = {
			name: "CodeAssistant",
			type: "code",
			memoryBlocks: [
				{
					label: "persona",
					value:
						"I am an expert coding assistant that helps users generate, review, and manage code using VibeKit integration while maintaining conversation context. I can analyze screenshots of UIs, code, and design mockups to provide specific implementation guidance. I specialize in React, TypeScript, Next.js, and modern web development.",
					description: "Coding expertise and capabilities",
				},
				{
					label: "human",
					value:
						"User coding preferences, skill level, and project context will be learned and stored here.",
					description: "User-specific coding context and preferences",
				},
				{
					label: "coding_context",
					value:
						"Current project details, repository information, coding session context, and active development tasks.",
					description: "Active coding project and session context",
				},
				{
					label: "visual_code_context",
					value:
						"Screenshots and visual references of UIs, designs, and code that inform implementation decisions.",
					description:
						"Visual context for code generation and UI implementation",
				},
				{
					label: "vibekit_integration",
					value:
						"VibeKit usage patterns, successful code generations, and integration context.",
					description: "VibeKit-specific context and usage history",
				},
			],
			tools: [
				"vibekit_generate",
				"github_operations",
				"code_review",
				"project_analysis",
				"analyze_ui_screenshot",
				"extract_code_from_image",
				"generate_from_mockup",
			],
			model: "gpt-4o",
			embedding: "text-embedding-3-small",
		};
	}

	async initialize(): Promise<void> {
		try {
			const agent = await this.lettaClient.agents.create({
				name: this.config.name,
				memoryBlocks: this.config.memoryBlocks,
				tools: this.config.tools,
				model: this.config.model,
				embedding: this.config.embedding,
			});
			this.agentId = agent.id;
		} catch (error) {
			console.error("Failed to initialize Code Agent:", error);
			throw error;
		}
	}

	async generateCode(
		prompt: string,
		context: CodingContext,
	): Promise<{ code: string; explanation: string; tests?: string }> {
		const enhancedPrompt = `
    Coding request: ${prompt}
    
    Project context:
    - Type: ${context.projectType}
    - Technologies: ${context.technologies.join(", ")}
    - Current file: ${context.currentFile || "N/A"}
    - Repository: ${context.repository || "N/A"}
    
    Please generate code that follows best practices and includes explanations.
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: enhancedPrompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			code: firstMessage?.content || "",
			explanation: "Code generated by Letta Code Agent",
			tests: undefined,
		};
	}

	async reviewCode(code: string): Promise<{
		issues: string[];
		suggestions: string[];
		rating: number;
	}> {
		const reviewPrompt = `
    Please review the following code and provide:
    1. Any issues or problems you find
    2. Suggestions for improvement
    3. A rating from 1-10
    
    Code to review:
    \`\`\`
    ${code}
    \`\`\`
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: reviewPrompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			issues: [],
			suggestions: [firstMessage?.content || "No suggestions"],
			rating: 8,
		};
	}

	async analyzeUIScreenshot(_imageData: ArrayBuffer): Promise<{
		components: string[];
		layout: string;
		suggestions: string[];
	}> {
		// Placeholder for UI analysis
		return {
			components: ["Button", "Input", "Card"],
			layout: "Flexbox layout detected",
			suggestions: [
				"Consider using semantic HTML",
				"Add accessibility attributes",
			],
		};
	}

	async generateFromMockup(
		mockupAnalysis: ImageAnalysis,
		requirements: string,
	): Promise<{ code: string; explanation: string }> {
		const prompt = `
    Generate code based on this UI mockup analysis:
    
    Description: ${mockupAnalysis.description}
    UI Elements: ${mockupAnalysis.uiElements.map((el) => `${el.type}: ${el.text || "no text"}`).join(", ")}
    Design Patterns: ${mockupAnalysis.designPatterns.join(", ")}
    
    Requirements: ${requirements}
    
    Please generate React/TypeScript code that implements this design.
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: prompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			code: firstMessage?.content || "",
			explanation: "Code generated from mockup analysis",
		};
	}
}

/**
 * Task Agent - Handles project and task management with GitHub integration
 */
export class TaskAgent {
	private lettaClient: LettaClient;
	private agentId: string;
	private config: AgentConfig;

	constructor(agentId: string) {
		this.agentId = agentId;
		this.lettaClient = createLettaClient();
		this.config = {
			name: "TaskManager",
			type: "task",
			memoryBlocks: [
				{
					label: "persona",
					value:
						"I am a task management specialist that helps users organize projects, track progress, and coordinate with GitHub repositories. I maintain awareness of project timelines, priorities, and team coordination needs.",
					description: "Task management expertise and role",
				},
				{
					label: "human",
					value:
						"User project management style, priorities, workflow preferences, and team context.",
					description: "User-specific project management preferences",
				},
				{
					label: "project_context",
					value:
						"Current projects, repositories, tasks, organizational context, and active work streams.",
					description: "Active project and task management context",
				},
				{
					label: "github_integration",
					value:
						"GitHub repository connections, issue tracking, pull request management, and workflow automation.",
					description: "GitHub integration context and history",
				},
				{
					label: "team_coordination",
					value:
						"Team member context, collaboration patterns, and coordination requirements.",
					description: "Team and collaboration context",
				},
			],
			tools: [
				"github_integration",
				"task_management",
				"project_organization",
				"progress_tracking",
				"team_coordination",
				"deadline_management",
			],
			model: "gpt-4o",
			embedding: "text-embedding-3-small",
		};
	}

	async initialize(): Promise<void> {
		try {
			const agent = await this.lettaClient.agents.create({
				name: this.config.name,
				memoryBlocks: this.config.memoryBlocks,
				tools: this.config.tools,
				model: this.config.model,
				embedding: this.config.embedding,
			});
			this.agentId = agent.id;
		} catch (error) {
			console.error("Failed to initialize Task Agent:", error);
			throw error;
		}
	}

	async createTask(description: string): Promise<{
		id: string;
		title: string;
		description: string;
		priority: string;
		estimatedTime: string;
	}> {
		const taskPrompt = `
    Create a task based on this description: ${description}
    
    Please provide:
    1. A clear title
    2. Detailed description
    3. Priority level (high/medium/low)
    4. Estimated time to complete
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: taskPrompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			id: `task-${Date.now()}`,
			title: "Generated Task",
			description: firstMessage?.content || description,
			priority: "medium",
			estimatedTime: "2 hours",
		};
	}

	async manageProject(projectId: string): Promise<{
		status: string;
		tasks: unknown[];
		nextActions: string[];
	}> {
		const projectPrompt = `
    Analyze project status for project ID: ${projectId}
    
    Please provide:
    1. Current project status
    2. Active tasks
    3. Recommended next actions
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: projectPrompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			status: "active",
			tasks: [],
			nextActions: [firstMessage?.content || "Continue with current tasks"],
		};
	}

	async syncWithGitHub(repository: string): Promise<{
		issues: unknown[];
		pullRequests: unknown[];
		syncStatus: string;
	}> {
		const syncPrompt = `
    Sync with GitHub repository: ${repository}
    
    Please analyze:
    1. Open issues
    2. Active pull requests
    3. Repository activity
    `;

		const response = await this.lettaClient.agents.messages.create(
			this.agentId,
			{ messages: [{ role: "user", content: syncPrompt }] },
		);

		const firstMessage = response.messages[0];
		return {
			issues: [],
			pullRequests: [],
			syncStatus: firstMessage?.content || "Sync completed",
		};
	}
}

/**
 * Agent Factory - Creates and manages specialized agents
 */
export class AgentFactory {
	private static agents: Map<string, VoiceAgent | CodeAgent | TaskAgent> =
		new Map();

	static async createVoiceAgent(agentId: string): Promise<VoiceAgent> {
		if (AgentFactory.agents.has(agentId)) {
			return AgentFactory.agents.get(agentId) as VoiceAgent;
		}

		const agent = new VoiceAgent(agentId);
		await agent.initialize();
		AgentFactory.agents.set(agentId, agent);
		return agent;
	}

	static async createCodeAgent(agentId: string): Promise<CodeAgent> {
		if (AgentFactory.agents.has(agentId)) {
			return AgentFactory.agents.get(agentId) as CodeAgent;
		}

		const agent = new CodeAgent(agentId);
		await agent.initialize();
		AgentFactory.agents.set(agentId, agent);
		return agent;
	}

	static async createTaskAgent(agentId: string): Promise<TaskAgent> {
		if (AgentFactory.agents.has(agentId)) {
			return AgentFactory.agents.get(agentId) as TaskAgent;
		}

		const agent = new TaskAgent(agentId);
		await agent.initialize();
		AgentFactory.agents.set(agentId, agent);
		return agent;
	}

	static getAgent(
		agentId: string,
	): VoiceAgent | CodeAgent | TaskAgent | undefined {
		return AgentFactory.agents.get(agentId);
	}

	static getAllAgents(): Map<string, VoiceAgent | CodeAgent | TaskAgent> {
		return new Map(AgentFactory.agents);
	}

	static removeAgent(agentId: string): boolean {
		return AgentFactory.agents.delete(agentId);
	}
}
