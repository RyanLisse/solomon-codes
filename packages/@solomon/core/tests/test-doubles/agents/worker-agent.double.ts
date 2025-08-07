/**
 * Worker Agent Test Double
 * TDD London School - Mock implementation for testing
 */

import { expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

export interface WorkerAgentCapabilities {
	spawn: (config: WorkerConfig) => Promise<WorkerInstance>;
	execute: (task: unknown) => Promise<unknown>;
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
	execute: (task: unknown) => Promise<unknown>;
	terminate: () => Promise<void>;
}

export interface WorkerAgentTestHelpers {
	givenSpawnReturns: (instance: WorkerInstance) => void;
	givenExecuteReturns: (result: unknown) => void;
	givenStatusIs: (status: string, progress: number) => void;
	assertSpawnedWithType: (type: string) => void;
	assertExecutedTask: (task: unknown) => void;
	getSpawnedInstances: () => WorkerInstance[];
}

export const createWorkerAgentDouble = (
	overrides?: Partial<WorkerAgentCapabilities>,
): WorkerAgentCapabilities & { __testHelpers: WorkerAgentTestHelpers } => {
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

	// Add test helper methods
	(
		double as WorkerAgentCapabilities & {
			__testHelpers: WorkerAgentTestHelpers;
		}
	).__testHelpers = {
		givenSpawnReturns: (instance: WorkerInstance) => {
			double.spawn.mockResolvedValue(instance);
		},
		givenExecuteReturns: (result: unknown) => {
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
		assertExecutedTask: (task: unknown) => {
			expect(double.execute).toHaveBeenCalledWith(task);
		},
		getSpawnedInstances: () => Array.from(workerInstances.values()),
		getInstanceById: (id: string) => workerInstances.get(id),
	};

	return double;
};
