/**
 * Letta Service Type Definitions
 */

export interface AgentMemoryBlock {
	id?: string;
	label: string;
	value: string;
	description?: string;
}

export interface AgentConfig {
	id: string;
	name: string;
	persona?: string;
	human?: string;
	model?: string;
}

export interface LettaResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	details?: Record<string, unknown>;
}

export interface MemoryUpdate {
	blocks: AgentMemoryBlock[];
}

export interface MemoryBlockCreate {
	label: string;
	value: string;
	description?: string;
}
