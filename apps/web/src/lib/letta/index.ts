/**
 * Letta Service Module
 * Provides integration with Letta memory management system
 */

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
	initialize(): Promise<void>;
}

class MockMemoryManager implements IMemoryManager {
	async getMemory(_agentId: string): Promise<AgentMemoryBlock[]> {
		return [
			{
				id: "1",
				label: "core_memory",
				value: "Agent memory placeholder",
				description: "Core memory block",
			},
		];
	}

	async updateBlock(
		_agentId: string,
		_blockId: string,
		value: string,
	): Promise<AgentMemoryBlock> {
		return {
			id: _blockId,
			label: "updated_block",
			value,
			description: "Updated block",
		};
	}

	async createBlock(
		_agentId: string,
		block: AgentMemoryBlock,
	): Promise<AgentMemoryBlock> {
		return {
			...block,
			id: Math.random().toString(36).substr(2, 9),
		};
	}

	async deleteBlock(_agentId: string, _blockId: string): Promise<void> {
		// Mock implementation
	}
}

class LettaService implements ILettaService {
	public memory: IMemoryManager;

	constructor() {
		this.memory = new MockMemoryManager();
	}

	async initialize(): Promise<void> {
		// Mock initialization
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
