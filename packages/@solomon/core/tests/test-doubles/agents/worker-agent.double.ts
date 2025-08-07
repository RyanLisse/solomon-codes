/**
 * Worker Agent Test Double
 * TDD London School - Mock implementation for testing
 */

import { expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

// Define proper types for Worker Agent
export interface WorkerTask {
	id: string;
	type: string;
	description: string;
	payload?: unknown;
	[key: string]: unknown;
}

export interface WorkerResult {
	success: boolean;
	result?: unknown;
	error?: string;
	[key: string]: unknown;
}

export interface WorkerAgentCapabilities {
	spawn: (config: WorkerConfig) => Promise<WorkerInstance>;
	execute: (task: WorkerTask) => Promise<WorkerResult>;
	reportStatus: () => { status: string; progress: number };
	terminate: () => Promise<void>;
}

export interface WorkerConfig {
	id: string;
	type: string;
	capabilities: string[];
	resources?: {
		cpu: number;
		memory: number;
	};
}

export interface WorkerInstance {
	id: string;
	type: string;
	status: "idle" | "working" | "completed" | "failed";
	execute: (task: WorkerTask) => Promise<WorkerResult>;
	terminate: () => Promise<void>;
}

export const createWorkerAgentDouble = (
	overrides?: Partial<WorkerAgentCapabilities>,
) => {
	const workerInstances = new Map<string, WorkerInstance>();

	const double = mockDeep<WorkerAgentCapabilities>({
		spawn: vi.fn().mockImplementation(async (config: WorkerConfig) => {
			const instance: WorkerInstance = {
				id: config.id,
				type: config.type,
				status: "idle",
				execute: vi.fn().mockResolvedValue({ success: true }),
				terminate: vi.fn().mockResolvedValue(undefined),
			};
			workerInstances.set(config.id, instance);
			return instance;
		}),
		execute: vi.fn().mockResolvedValue({ result: "completed" }),
		reportStatus: vi.fn().mockReturnValue({ status: "idle", progress: 0 }),
		terminate: vi.fn().mockResolvedValue(undefined),
		...overrides,
	});

	// Define interface for double with test helpers
	interface WorkerAgentDoubleWithHelpers extends WorkerAgentCapabilities {
		__testHelpers: {
			givenSpawnReturns: (instance: WorkerInstance | (() => WorkerInstance)) => void;
			givenExecuteReturns: (result: WorkerResult) => void;
			givenStatusIs: (status: string, progress: number) => void;
			assertSpawnedWithType: (type: string) => void;
			assertExecutedTask: (task: WorkerTask) => void;
			getSpawnedInstances: () => WorkerInstance[];
			getInstanceById: (id: string) => WorkerInstance | undefined;
		};
	}

	// Add test helper methods with proper typing
	const enhancedDouble = double as WorkerAgentDoubleWithHelpers;
	
	enhancedDouble.__testHelpers = {
		givenSpawnReturns: (instance: WorkerInstance | (() => WorkerInstance)) => {
			if (typeof instance === "function") {
				double.spawn.mockImplementation(async () => {
					const workerInstance = instance();
					// Ensure terminate method exists
					if (!workerInstance.terminate) {
						workerInstance.terminate = vi.fn().mockResolvedValue(undefined);
					}
					return workerInstance;
				});
			} else {
				// Ensure terminate method exists
				if (!instance.terminate) {
					instance.terminate = vi.fn().mockResolvedValue(undefined);
				}
				double.spawn.mockResolvedValue(instance);
			}
		},
		givenExecuteReturns: (result: WorkerResult) => {
			double.execute.mockResolvedValue(result);
		},
		givenStatusIs: (status: string, progress: number) => {
			double.reportStatus.mockReturnValue({ status, progress });
		},
		assertSpawnedWithType: (type: string) => {
			expect(double.spawn).toHaveBeenCalledWith(
				expect.objectContaining({ type }),
			);
		},
		assertExecutedTask: (task: WorkerTask) => {
			expect(double.execute).toHaveBeenCalledWith(task);
		},
		getSpawnedInstances: () => Array.from(workerInstances.values()),
		getInstanceById: (id: string) => workerInstances.get(id),
	};

	return enhancedDouble;
};
