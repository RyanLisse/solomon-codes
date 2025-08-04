/**
 * OpenAI Realtime API Service
 * Handles real-time voice-to-voice conversations using OpenAI's Realtime API
 */

import type { LettaVoiceAgent } from "@/components/voice/letta-voice-agent";
import { VoiceErrorCode } from "@/components/voice/types";

export interface RealtimeConfig {
	model: string;
	voice: string;
	temperature: number;
	maxTokens: number;
	instructions?: string;
}

export interface RealtimeEvent {
	type: string;
	[key: string]: unknown;
}

export interface RealtimeAudioData {
	audio: string; // base64 encoded audio
	transcript?: string;
}

export interface LettaIntegrationConfig {
	agent: LettaVoiceAgent;
	enableMemoryUpdates: boolean;
	enableToolCalls: boolean;
}

interface OpenAIFunctionTool {
	type: "function";
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<
			string,
			{
				type: string;
				description: string;
			}
		>;
		required?: string[];
	};
}

export class OpenAIRealtimeService {
	private websocket: WebSocket | null = null;
	private lettaAgent: LettaVoiceAgent | null = null;
	private readonly config: RealtimeConfig;
	private lettaConfig: LettaIntegrationConfig | null = null;
	private isConnected = false;
	private readonly eventListeners: Map<
		string,
		((event: RealtimeEvent) => void)[]
	> = new Map();

	constructor(config: RealtimeConfig) {
		this.config = config;
	}

	/**
	 * Connect to OpenAI Realtime API
	 */
	async connect(): Promise<void> {
		const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OpenAI API key not configured");
		}

		try {
			// Create WebSocket connection
			this.websocket = new WebSocket(
				`wss://api.openai.com/v1/realtime?model=${this.config.model}`,
				["realtime", `Bearer.${apiKey}`],
			);

			// Set up event handlers
			this.websocket.onopen = () => {
				console.log("Connected to OpenAI Realtime API");
				this.isConnected = true;
				this.initializeSession();
				this.emit("connected", { type: "connected" });
			};

			this.websocket.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					this.handleRealtimeEvent(message);
				} catch (error) {
					console.error("Error parsing WebSocket message:", error);
				}
			};

			this.websocket.onerror = (error) => {
				console.error("WebSocket error:", error);
				this.emit("error", {
					type: "error",
					code: VoiceErrorCode.NETWORK_ERROR,
					message: "WebSocket connection error",
					recoverable: true,
					details: { error },
				});
			};

			this.websocket.onclose = () => {
				console.log("Disconnected from OpenAI Realtime API");
				this.isConnected = false;
				this.emit("disconnected", { type: "disconnected" });
			};
		} catch (error) {
			throw new Error(`Failed to connect to Realtime API: ${error}`);
		}
	}

	/**
	 * Disconnect from the Realtime API
	 */
	async disconnect(): Promise<void> {
		if (this.websocket) {
			this.websocket.close();
			this.websocket = null;
		}
		this.isConnected = false;
		this.lettaAgent = null;
		this.lettaConfig = null;
	}

	/**
	 * Send audio data to the Realtime API
	 */
	async sendAudio(audioData: ArrayBuffer): Promise<void> {
		if (!this.isConnected || !this.websocket) {
			throw new Error("Not connected to Realtime API");
		}

		// Convert ArrayBuffer to base64
		const base64Audio = this.arrayBufferToBase64(audioData);

		const message = {
			type: "input_audio_buffer.append",
			audio: base64Audio,
		};

		this.websocket.send(JSON.stringify(message));
	}

	/**
	 * Receive audio from the Realtime API
	 */
	async receiveAudio(): Promise<ArrayBuffer> {
		// This is handled through event listeners
		// Audio data is received via the 'response.audio.delta' event
		throw new Error("Use event listeners to receive audio data");
	}

	/**
	 * Integrate with Letta agent
	 */
	async integrateWithLetta(config: LettaIntegrationConfig): Promise<void> {
		this.lettaAgent = config.agent;
		this.lettaConfig = config;

		// Configure session with Letta integration
		if (this.isConnected) {
			await this.updateSessionWithLetta();
		}
	}

	/**
	 * Handle Realtime API events
	 */
	handleRealtimeEvents(event: RealtimeEvent): void {
		this.handleRealtimeEvent(event);
	}

	/**
	 * Add event listener
	 */
	on(eventType: string, callback: (event: RealtimeEvent) => void): void {
		if (!this.eventListeners.has(eventType)) {
			this.eventListeners.set(eventType, []);
		}
		this.eventListeners.get(eventType)?.push(callback);
	}

	/**
	 * Remove event listener
	 */
	off(eventType: string, callback: (event: RealtimeEvent) => void): void {
		const listeners = this.eventListeners.get(eventType);
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * Emit event to listeners
	 */
	private emit(eventType: string, event: RealtimeEvent): void {
		const listeners = this.eventListeners.get(eventType);
		if (listeners) {
			listeners.forEach((callback) => callback(event));
		}
	}

	/**
	 * Initialize session configuration
	 */
	private initializeSession(): void {
		if (!this.websocket) return;

		const sessionConfig = {
			type: "session.update",
			session: {
				modalities: ["text", "audio"],
				instructions:
					this.config.instructions || "You are a helpful voice assistant.",
				voice: this.config.voice,
				input_audio_format: "pcm16",
				output_audio_format: "pcm16",
				input_audio_transcription: {
					model: "whisper-1",
				},
				turn_detection: {
					type: "server_vad",
					threshold: 0.5,
					prefix_padding_ms: 300,
					silence_duration_ms: 500,
				},
				tools: this.lettaConfig?.enableToolCalls ? this.getLettaTools() : [],
			},
		};

		this.websocket.send(JSON.stringify(sessionConfig));
	}

	/**
	 * Update session with Letta integration
	 */
	private async updateSessionWithLetta(): Promise<void> {
		if (!this.websocket || !this.lettaAgent) return;

		const instructions = `You are integrated with a Letta agent. 
    Maintain conversation context and memory. 
    Use the available tools to interact with the Letta agent when appropriate.
    ${this.config.instructions || ""}`;

		const sessionUpdate = {
			type: "session.update",
			session: {
				instructions,
				tools: this.getLettaTools(),
			},
		};

		this.websocket.send(JSON.stringify(sessionUpdate));
	}

	/**
	 * Get Letta integration tools for function calling
	 */
	private getLettaTools(): OpenAIFunctionTool[] {
		if (!this.lettaConfig?.enableToolCalls) return [];

		return [
			{
				type: "function",
				name: "send_to_letta_agent",
				description: "Send message to Letta agent for processing",
				parameters: {
					type: "object",
					properties: {
						message: {
							type: "string",
							description: "Message to send to the Letta agent",
						},
						context: {
							type: "object",
							description: "Additional context for the Letta agent",
						},
					},
					required: ["message"],
				},
			},
		];
	}

	/**
	 * Handle incoming Realtime API events
	 */
	private async handleRealtimeEvent(event: RealtimeEvent): Promise<void> {
		switch (event.type) {
			case "session.created":
				console.log("Realtime session created:", event.session);
				this.emit("session.created", event);
				break;

			case "response.audio.delta": {
				// Handle streaming audio response
				const delta = (event as { delta?: string }).delta;
				if (delta) {
					const audioData = this.base64ToArrayBuffer(delta);
					this.emit("audio.received", {
						type: "audio.received",
						audioData,
						event,
					});
				}
				break;
			}

			case "conversation.item.input_audio_transcription.completed": {
				const transcript = (event as { transcript?: string }).transcript;
				console.log("User transcript:", transcript);
				this.emit("transcript.received", {
					type: "transcript.received",
					transcript: transcript || "",
					event,
				});
				break;
			}

			case "response.function_call_arguments.done":
				// Handle function call to Letta agent
				await this.handleLettaFunctionCall(event);
				break;

			case "response.done":
				this.emit("response.done", event);
				break;

			case "error": {
				const errorData = (event as { error?: { message?: string } }).error;
				console.error("Realtime API error:", errorData);
				this.emit("error", {
					type: "error",
					code: VoiceErrorCode.NETWORK_ERROR,
					message: errorData?.message || "Realtime API error",
					recoverable: true,
					details: errorData,
				});
				break;
			}

			default:
				// Forward all other events
				this.emit(event.type, event);
				break;
		}
	}

	/**
	 * Handle function calls to Letta agent
	 */
	private async handleLettaFunctionCall(event: RealtimeEvent): Promise<void> {
		if (!this.lettaAgent || !this.websocket) return;

		try {
			const args = (event as { arguments?: string }).arguments;
			if (!args) return;
			const { message } = JSON.parse(args);

			// Send message to Letta agent
			const lettaResponse = await this.lettaAgent.processVoiceInput(message);

			// Update memory if enabled
			if (
				this.lettaConfig?.enableMemoryUpdates &&
				lettaResponse.memoryUpdates
			) {
				// Memory updates are handled by the Letta agent
			}

			// Send response back to Realtime API
			const callId = (event as { call_id?: string }).call_id;
			const functionOutput = {
				type: "conversation.item.create",
				item: {
					type: "function_call_output",
					call_id: callId,
					output: lettaResponse.content,
				},
			};

			this.websocket.send(JSON.stringify(functionOutput));

			// Trigger response generation
			this.websocket.send(JSON.stringify({ type: "response.create" }));
		} catch (error) {
			console.error("Error handling Letta function call:", error);

			// Send error response
			const callId = (event as { call_id?: string }).call_id;
			const errorOutput = {
				type: "conversation.item.create",
				item: {
					type: "function_call_output",
					call_id: callId,
					output: "Error processing request with Letta agent",
				},
			};

			this.websocket?.send(JSON.stringify(errorOutput));
		}
	}

	/**
	 * Convert ArrayBuffer to base64
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Convert base64 to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}
}
