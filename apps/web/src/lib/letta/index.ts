/**
 * Letta Service Module
 * Provides integration with Letta stateful AI agents system
 */

// Import types  that would come from @letta-ai/letta-client
// For now, we'll define them locally until the package is properly installed
export interface LettaMemoryBlock {
	label: string;
	value: string;
	description?: string;
}

export interface AgentConfig {
	name: string;
	persona: string;
	human: string;
	model: string;
	embeddingModel: string;
	memoryBlocks?: LettaMemoryBlock[];
}

export interface LettaAgent {
	id: string;
	name: string;
	memoryBlocks: LettaMemoryBlock[];
	model: string;
	embedding: string;
	tools: string[];
}

interface LettaApiMessage {
	id: string;
	message_type: string;
	content: string;
	reasoning?: string;
	tool_call?: {
		name: string;
		arguments: Record<string, unknown>;
	};
	tool_return?: unknown;
}

interface LettaApiAgent {
	id: string;
	name: string;
	memory_blocks?: LettaMemoryBlock[];
	model: string;
	embedding: string;
	tools?: string[];
}

interface LettaApiTool {
	name: string;
	description: string;
}

export interface LettaMessage {
	messageId: string;
	agentId: string;
	messageType:
		| "assistant_message"
		| "reasoning_message"
		| "tool_call_message"
		| "tool_return_message"
		| "usage_statistics";
	content?: string;
	reasoning?: string;
	toolCall?: {
		name: string;
		arguments: Record<string, unknown>;
	};
	toolReturn?: unknown;
	metadata?: {
		processingTime: number;
		confidence: number;
		voiceGenerated: boolean;
	};
}

export interface LettaResponse {
	messages: LettaMessage[];
	usage: {
		completion_tokens: number;
		prompt_tokens: number;
		total_tokens: number;
		step_count: number;
	};
}

export interface AgentMemoryBlock {
	id?: string;
	label: string;
	value: string;
	description?: string;
}

export interface IMemoryManager {
	getMemory(agentId: string): Promise<AgentMemoryBlock[]>;
	updateBlock(
		agentId: string,
		blockId: string,
		value: string,
	): Promise<AgentMemoryBlock>;
	createBlock(
		agentId: string,
		block: AgentMemoryBlock,
	): Promise<AgentMemoryBlock>;
	deleteBlock(agentId: string, blockId: string): Promise<void>;
}

export interface ILettaService {
	memory: IMemoryManager;
	client: LettaClient;
	initialize(): Promise<void>;
	createAgent(config: AgentConfig): Promise<LettaAgent>;
	sendMessage(agentId: string, message: string): Promise<LettaMessage>;
}

// Letta Client Interface (based on documentation)
export interface LettaClient {
	agents: {
		create(config: {
			memoryBlocks: LettaMemoryBlock[];
			tools: string[];
			model: string;
			embedding: string;
			name?: string;
		}): Promise<LettaAgent>;

		messages: {
			create(
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
				},
			): Promise<LettaResponse>;

			createStream(
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
					streamTokens?: boolean;
				},
			): AsyncIterableIterator<LettaMessage>;
		};

		get(agentId: string): Promise<LettaAgent>;
		list(): Promise<LettaAgent[]>;
		delete(agentId: string): Promise<boolean>;
	};

	tools: {
		list(): Promise<Array<{ name: string; description: string }>>;
	};

	// Direct methods for convenience (used by tests)
	createAgent(config: AgentConfig): Promise<LettaAgent>;
	sendMessage(agentId: string, message: string): Promise<LettaMessage>;
	updateMemory(
		agentId: string,
		memoryBlocks: LettaMemoryBlock[],
	): Promise<void>;
	getAgent(agentId: string): Promise<LettaAgent>;
	deleteAgent(agentId: string): Promise<boolean>;
}

class LettaMemoryManager implements IMemoryManager {
	constructor(private client: LettaClient) {}

	async getMemory(agentId: string): Promise<AgentMemoryBlock[]> {
		try {
			const agent = await this.client.agents.get(agentId);
			return agent.memoryBlocks.map((block) => ({
				id: block.label,
				label: block.label,
				value: block.value,
				description: block.description,
			}));
		} catch (error) {
			console.error("Failed to get agent memory:", error);
			return [];
		}
	}

	async updateBlock(
		_agentId: string,
		blockId: string,
		value: string,
	): Promise<AgentMemoryBlock> {
		// Note: This would need to be implemented with the actual Letta API
		// For now, return a mock response
		return {
			id: blockId,
			label: blockId,
			value,
			description: "Updated block",
		};
	}

	async createBlock(
		_agentId: string,
		block: AgentMemoryBlock,
	): Promise<AgentMemoryBlock> {
		// Note: This would need to be implemented with the actual Letta API
		return {
			...block,
			id: block.label,
		};
	}

	async deleteBlock(agentId: string, blockId: string): Promise<void> {
		// Note: This would need to be implemented with the actual Letta API
		console.log(`Mock: Deleting memory block ${blockId} for agent ${agentId}`);
	}
}

// Real Letta Client Implementation
class RealLettaClient implements LettaClient {
	private baseUrl: string;
	private token?: string;

	constructor(config: { baseUrl?: string; token?: string } = {}) {
		this.baseUrl =
			config.baseUrl || process.env.LETTA_BASE_URL || "https://api.letta.com";
		this.token = config.token || process.env.LETTA_API_KEY;
	}

	private async makeRequest(
		endpoint: string,
		options: RequestInit = {},
	): Promise<unknown> {
		const url = `${this.baseUrl}/v1${endpoint}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...((options.headers as Record<string, string>) || {}),
		};

		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			throw new Error(
				`Letta API error: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	agents = {
		create: async (config: {
			memoryBlocks: LettaMemoryBlock[];
			tools: string[];
			model: string;
			embedding: string;
			name?: string;
		}): Promise<LettaAgent> => {
			const response = await this.makeRequest("/agents", {
				method: "POST",
				body: JSON.stringify({
					memory_blocks: config.memoryBlocks,
					tools: config.tools,
					model: config.model,
					embedding: config.embedding,
					name: config.name,
				}),
			});

			const apiResponse = response as LettaApiAgent;
			return {
				id: apiResponse.id,
				name: apiResponse.name,
				memoryBlocks: apiResponse.memory_blocks || config.memoryBlocks,
				model: apiResponse.model,
				embedding: apiResponse.embedding,
				tools: apiResponse.tools || [],
			};
		},

		messages: {
			create: async (
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
				},
			): Promise<LettaResponse> => {
				const response = await this.makeRequest(`/agents/${agentId}/messages`, {
					method: "POST",
					body: JSON.stringify(request),
				});

				const apiResponse = response as {
					messages: LettaApiMessage[];
					usage?: {
						prompt_tokens?: number;
						completion_tokens?: number;
						total_tokens?: number;
						step_count?: number;
					};
				};
				return {
					messages: apiResponse.messages.map((msg: LettaApiMessage) => ({
						messageId: msg.id,
						agentId: agentId,
						messageType: msg.message_type as LettaMessage["messageType"],
						content: msg.content,
						reasoning: msg.reasoning,
						toolCall: msg.tool_call
							? {
									name: msg.tool_call.name,
									arguments: msg.tool_call.arguments,
								}
							: undefined,
						toolReturn: msg.tool_return,
						metadata: {
							processingTime: 100,
							confidence: 0.95,
							voiceGenerated: false,
						},
					})),
					usage: {
						completion_tokens: apiResponse.usage?.completion_tokens || 0,
						prompt_tokens: apiResponse.usage?.prompt_tokens || 0,
						total_tokens: apiResponse.usage?.total_tokens || 0,
						step_count: apiResponse.usage?.step_count || 1,
					},
				};
			},

			createStream: async function* (
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
					streamTokens?: boolean;
				},
			): AsyncIterableIterator<LettaMessage> {
				// Note: Streaming implementation would need to be added
				// For now, fall back to non-streaming
				const response = await this.create(agentId, request);
				for (const message of response.messages) {
					yield message;
				}
			},
		},

		get: async (agentId: string): Promise<LettaAgent> => {
			const response = await this.makeRequest(`/agents/${agentId}`);
			const apiResponse = response as LettaApiAgent;
			return {
				id: apiResponse.id,
				name: apiResponse.name,
				memoryBlocks: apiResponse.memory_blocks || [],
				model: apiResponse.model,
				embedding: apiResponse.embedding,
				tools: apiResponse.tools || [],
			};
		},

		list: async (): Promise<LettaAgent[]> => {
			const response = await this.makeRequest("/agents");
			const apiResponse = response as LettaApiAgent[];
			return apiResponse.map((agent: LettaApiAgent) => ({
				id: agent.id,
				name: agent.name,
				memoryBlocks: agent.memory_blocks || [],
				model: agent.model,
				embedding: agent.embedding,
				tools: agent.tools || [],
			}));
		},

		delete: async (agentId: string): Promise<boolean> => {
			await this.makeRequest(`/agents/${agentId}`, {
				method: "DELETE",
			});
			return true;
		},
	};

	tools = {
		list: async (): Promise<Array<{ name: string; description: string }>> => {
			const response = await this.makeRequest("/tools");
			const apiResponse = response as LettaApiTool[];
			return apiResponse.map((tool: LettaApiTool) => ({
				name: tool.name,
				description: tool.description,
			}));
		},
	};

	// Direct convenience methods (required by interface)
	async createAgent(config: AgentConfig): Promise<LettaAgent> {
		return this.agents.create({
			memoryBlocks: config.memoryBlocks || [],
			tools: [], // Default to empty tools array
			model: config.model,
			embedding: config.embeddingModel,
			name: config.name,
		});
	}

	async sendMessage(agentId: string, message: string): Promise<LettaMessage> {
		const response = await this.agents.messages.create(agentId, {
			messages: [{ role: "user", content: message }],
		});
		return response.messages[0];
	}

	async updateMemory(
		agentId: string,
		memoryBlocks: LettaMemoryBlock[],
	): Promise<void> {
		await this.makeRequest(`/agents/${agentId}/memory`, {
			method: "PUT",
			body: JSON.stringify({ memory_blocks: memoryBlocks }),
		});
	}

	async getAgent(agentId: string): Promise<LettaAgent> {
		return this.agents.get(agentId);
	}

	async deleteAgent(agentId: string): Promise<boolean> {
		return this.agents.delete(agentId);
	}
}

// Mock Letta Client for development/testing
class MockLettaClient implements LettaClient {
	private mockAgents: Map<string, LettaAgent> = new Map();

	agents = {
		create: async (config: {
			memoryBlocks: LettaMemoryBlock[];
			tools: string[];
			model: string;
			embedding: string;
			name?: string;
		}): Promise<LettaAgent> => {
			const agent: LettaAgent = {
				id: `agent-${Date.now()}`,
				name: config.name || "Mock Agent",
				memoryBlocks: config.memoryBlocks,
				model: config.model,
				embedding: config.embedding,
				tools: config.tools,
			};

			this.mockAgents.set(agent.id, agent);
			console.log("Mock: Created Letta agent:", agent);
			return agent;
		},

		messages: {
			create: async (
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
				},
			): Promise<LettaResponse> => {
				console.log(
					`Mock: Sending message to agent ${agentId}:`,
					request.messages[0]?.content,
				);

				// Simulate processing delay
				await new Promise((resolve) => setTimeout(resolve, 100));

				const _message = request.messages[0];
				return {
					messages: [
						{
							messageId: `msg-${Date.now()}`,
							agentId,
							messageType: "assistant_message",
							content:
								"This is a simulated response from the Letta voice agent.",
							metadata: {
								processingTime: 100,
								confidence: 0.95,
								voiceGenerated: false,
							},
						},
					],
					usage: {
						completion_tokens: 50,
						prompt_tokens: 20,
						total_tokens: 70,
						step_count: 1,
					},
				};
			},

			createStream: async function* (
				agentId: string,
				request: {
					messages: Array<{ role: "user"; content: string }>;
					streamTokens?: boolean;
				},
			): AsyncIterableIterator<LettaMessage> {
				const response = await this.create(agentId, request);
				for (const message of response.messages) {
					yield message;
				}
			},
		},

		get: async (agentId: string): Promise<LettaAgent> => {
			const agent = this.mockAgents.get(agentId);
			if (!agent) {
				throw new Error(`Agent ${agentId} not found`);
			}
			return agent;
		},

		list: async (): Promise<LettaAgent[]> => {
			return Array.from(this.mockAgents.values());
		},

		delete: async (agentId: string): Promise<boolean> => {
			return this.mockAgents.delete(agentId);
		},
	};

	tools = {
		list: async (): Promise<Array<{ name: string; description: string }>> => {
			return [
				{ name: "web_search", description: "Search the web for information" },
				{
					name: "run_code",
					description: "Execute code in a sandbox environment",
				},
			];
		},
	};

	// Direct methods for convenience (used by tests)
	createAgent = async (config: AgentConfig): Promise<LettaAgent> => {
		return this.agents.create({
			memoryBlocks: config.memoryBlocks || [],
			tools: ["web_search", "run_code"],
			model: config.model,
			embedding: config.embeddingModel,
			name: config.name,
		});
	};

	sendMessage = async (
		agentId: string,
		message: string,
	): Promise<LettaMessage> => {
		const response = await this.agents.messages.create(agentId, {
			messages: [{ role: "user", content: message }],
		});
		return response.messages[0];
	};

	updateMemory = async (
		agentId: string,
		memoryBlocks: LettaMemoryBlock[],
	): Promise<void> => {
		const agent = await this.agents.get(agentId);
		agent.memoryBlocks = memoryBlocks;
		this.mockAgents.set(agentId, agent);
	};

	getAgent = async (agentId: string): Promise<LettaAgent> => {
		return this.agents.get(agentId);
	};

	deleteAgent = async (agentId: string): Promise<boolean> => {
		return this.agents.delete(agentId);
	};
}

class LettaService implements ILettaService {
	public memory: IMemoryManager;
	public client: LettaClient;

	constructor() {
		// Use real client if API key is available, otherwise use mock
		const hasApiKey = !!process.env.LETTA_API_KEY;

		if (hasApiKey) {
			console.log("Initializing real Letta client");
			this.client = new RealLettaClient();
		} else {
			console.log("No LETTA_API_KEY found, using mock client");
			this.client = new MockLettaClient();
		}

		this.memory = new LettaMemoryManager(this.client);
	}

	async initialize(): Promise<void> {
		try {
			// Test the connection by listing tools
			await this.client.tools.list();
			console.log("Letta service initialized successfully");
		} catch (error) {
			console.error("Failed to initialize Letta service:", error);
			// Fall back to mock client if real client fails
			if (this.client instanceof RealLettaClient) {
				console.log("Falling back to mock client");
				this.client = new MockLettaClient();
				this.memory = new LettaMemoryManager(this.client);
			}
		}
	}

	async createAgent(config: AgentConfig): Promise<LettaAgent> {
		return this.client.createAgent(config);
	}

	async sendMessage(agentId: string, message: string): Promise<LettaMessage> {
		return this.client.sendMessage(agentId, message);
	}
}

let lettaServiceInstance: ILettaService | null = null;

export function getLettaService(): ILettaService {
	if (!lettaServiceInstance) {
		lettaServiceInstance = new LettaService();
	}
	return lettaServiceInstance;
}

export function resetLettaService(): void {
	lettaServiceInstance = null;
}

// Helper function to create a Letta client directly
export function createLettaClient(config?: {
	baseUrl?: string;
	token?: string;
}): LettaClient {
	const hasApiKey = !!(config?.token || process.env.LETTA_API_KEY);

	if (hasApiKey) {
		return new RealLettaClient(config);
	}
	return new MockLettaClient();
}

// Voice Agent specific helpers
export async function createVoiceAgent(
	client: LettaClient,
	config?: {
		name?: string;
		persona?: string;
		human?: string;
		voicePreferences?: string;
	},
): Promise<LettaAgent> {
	return client.agents.create({
		name: config?.name || "VoiceAssistant",
		memoryBlocks: [
			{
				label: "persona",
				value:
					config?.persona ||
					"I am a helpful voice assistant that specializes in natural conversation and helping users navigate the solomon_codes platform through speech and visual content analysis.",
			},
			{
				label: "human",
				value:
					config?.human ||
					"User preferences and conversation context will be stored here.",
			},
			{
				label: "voice_preferences",
				value:
					config?.voicePreferences ||
					"User's voice interaction preferences, language, and accessibility needs.",
				description:
					"Stores voice-specific user preferences and accessibility requirements",
			},
			{
				label: "visual_memory",
				value:
					"Stores descriptions and analysis of images and screenshots shared by the user.",
				description:
					"Maintains context about visual content shared in conversations",
			},
		],
		tools: ["web_search", "run_code"],
		model: "openai/gpt-4.1",
		embedding: "openai/text-embedding-3-small",
	});
}

export async function createCodeAgent(
	client: LettaClient,
	config?: {
		name?: string;
		persona?: string;
		human?: string;
	},
): Promise<LettaAgent> {
	return client.agents.create({
		name: config?.name || "CodeAssistant",
		memoryBlocks: [
			{
				label: "persona",
				value:
					config?.persona ||
					"I am an expert coding assistant that helps users generate, review, and manage code using VibeKit integration while maintaining conversation context. I can analyze screenshots of UIs, code, and design mockups to provide specific implementation guidance.",
			},
			{
				label: "human",
				value:
					config?.human ||
					"User's coding preferences, skill level, and project context.",
			},
			{
				label: "coding_context",
				value:
					"Current project details, repository information, and coding session context.",
				description:
					"Maintains context about current coding projects and user preferences",
			},
			{
				label: "visual_code_context",
				value:
					"Screenshots and visual references of UIs, designs, and code that inform implementation decisions.",
				description:
					"Stores visual context for code generation and UI implementation",
			},
		],
		tools: ["web_search", "run_code"],
		model: "openai/gpt-4.1",
		embedding: "openai/text-embedding-3-small",
	});
}

export async function createTaskAgent(
	client: LettaClient,
	config?: {
		name?: string;
		persona?: string;
		human?: string;
	},
): Promise<LettaAgent> {
	return client.agents.create({
		name: config?.name || "TaskManager",
		memoryBlocks: [
			{
				label: "persona",
				value:
					config?.persona ||
					"I am a task management specialist that helps users organize projects, track progress, and coordinate with GitHub repositories.",
			},
			{
				label: "human",
				value:
					config?.human ||
					"User's project management style, priorities, and workflow preferences.",
			},
			{
				label: "project_context",
				value:
					"Current projects, repositories, tasks, and organizational context.",
				description:
					"Maintains comprehensive project and task management context",
			},
		],
		tools: ["web_search", "run_code"],
		model: "openai/gpt-4.1",
		embedding: "openai/text-embedding-3-small",
	});
}
