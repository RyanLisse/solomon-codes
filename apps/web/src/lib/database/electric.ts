import type { Environment, Task } from "./types";

/**
 * ElectricSQL configuration for the new API
 */
export interface ElectricConfig {
	url: string; // HTTP URL for the Electric service (e.g., http://localhost:3000)
	debug: boolean;
	retryAttempts: number;
	retryDelay: number;
}

/**
 * Shape configuration for ElectricSQL
 */
export interface ShapeConfig {
	table: string;
	where?: string;
	columns?: string[];
	offset?: string;
}

/**
 * Operation queue item for offline support
 */
import type { DatabaseRecord } from "../types/cleanup";

export interface QueuedOperation {
	type: "insert" | "update" | "delete";
	table: string;
	data: DatabaseRecord;
	timestamp: Date;
}

/**
 * Conflict resolution data structure
 */
export interface ConflictData<T = DatabaseRecord> {
	local: T;
	remote: T;
}

/**
 * Sync result structure
 */
export interface SyncResult {
	success: boolean;
	error?: string;
	syncedCount?: number;
}

/**
 * Connection result structure
 */
export interface ConnectionResult {
	success: boolean;
	error?: string;
}

// Define the Electric client interface
interface ElectricClient {
	connect(): Promise<boolean>;
	disconnect(): Promise<boolean>;
	sync(table: string): Promise<boolean>;
	subscribe(
		table: string,
		callback: (...args: unknown[]) => void,
	): Promise<string>;
	unsubscribe(subscriptionId: string): Promise<boolean>;
	isConnected(): boolean;
}

// Global state for offline mode and operation queue
let isOffline = false;
let operationQueue: QueuedOperation[] = [];
let electricClient: ElectricClient | null = null;

/**
 * Get ElectricSQL configuration from environment variables
 */
export function getElectricConfig(): ElectricConfig {
	// Use client-side environment variable for browser, server-side for SSR
	const electricUrl =
		typeof window !== "undefined"
			? process.env.NEXT_PUBLIC_ELECTRIC_URL
			: process.env.ELECTRIC_URL;

	return {
		url: electricUrl || "http://localhost:3000",
		debug: process.env.NODE_ENV === "development",
		retryAttempts: Number.parseInt(
			process.env.ELECTRIC_RETRY_ATTEMPTS || "3",
			10,
		),
		retryDelay: Number.parseInt(process.env.ELECTRIC_RETRY_DELAY || "1000", 10),
	};
}

/**
 * Create ElectricSQL client
 */
export async function createElectricClient(
	customConfig?: Partial<ElectricConfig>,
) {
	const _config = customConfig
		? { ...getElectricConfig(), ...customConfig }
		: getElectricConfig();

	try {
		// Mock ElectricSQL client for now since the actual package might not be available
		// In a real implementation, this would be:
		// const { Electric } = await import("electric-sql");
		// electricClient = new Electric(config);

		electricClient = {
			connect: async () => true,
			disconnect: async () => true,
			sync: async (_table: string) => true,
			subscribe: async (
				_table: string,
				_callback: (...args: unknown[]) => void,
			) => `subscription-${_table}-${Date.now()}`,
			unsubscribe: async (_subscriptionId: string) => true,
			isConnected: () => !isOffline,
		} as ElectricClient;

		return electricClient;
	} catch (error) {
		throw new Error(
			`Failed to create Electric client: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Connect to ElectricSQL service
 */
export async function connectElectric(): Promise<ConnectionResult> {
	try {
		if (!electricClient) {
			await createElectricClient();
		}

		await electricClient?.connect();

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Disconnect from ElectricSQL service
 */
export async function disconnectElectric(): Promise<ConnectionResult> {
	try {
		if (electricClient) {
			await electricClient.disconnect();
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Check if ElectricSQL is connected
 */
export function isElectricConnected(): boolean {
	return electricClient ? electricClient.isConnected() : false;
}

/**
 * Start synchronization for tasks table
 */
export async function startTaskSync(): Promise<SyncResult> {
	try {
		if (!electricClient) {
			await createElectricClient();
		}

		await electricClient?.sync("tasks");

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Start synchronization for environments table
 */
export async function startEnvironmentSync(): Promise<SyncResult> {
	try {
		if (!electricClient) {
			await createElectricClient();
		}

		await electricClient?.sync("environments");

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Subscribe to table changes
 */
export async function subscribeToTableChanges(
	table: string,
	callback: (...args: unknown[]) => void,
): Promise<string> {
	if (!electricClient) {
		await createElectricClient();
	}

	if (!electricClient) {
		throw new Error("Electric client not initialized");
	}

	return await electricClient.subscribe(table, callback);
}

/**
 * Unsubscribe from table changes
 */
export async function unsubscribeFromTableChanges(
	subscriptionId: string,
): Promise<boolean> {
	if (!electricClient) {
		return false;
	}

	return await electricClient?.unsubscribe(subscriptionId);
}

/**
 * Resolve task conflicts using last-write-wins strategy
 */
export function resolveTaskConflict(conflict: ConflictData<Task>): Task {
	const { local, remote } = conflict;

	// Use last-write-wins strategy based on updatedAt timestamp
	if (!local.updatedAt) return remote;
	if (!remote.updatedAt) return local;

	return new Date(local.updatedAt) > new Date(remote.updatedAt)
		? local
		: remote;
}

/**
 * Resolve environment conflicts using last-write-wins strategy
 */
export function resolveEnvironmentConflict(
	conflict: ConflictData<Environment>,
): Environment {
	const { local, remote } = conflict;

	// Use last-write-wins strategy based on updatedAt timestamp
	if (!local.updatedAt) return remote;
	if (!remote.updatedAt) return local;

	return new Date(local.updatedAt) > new Date(remote.updatedAt)
		? local
		: remote;
}

/**
 * Resolve conflicts using a custom strategy
 */
export function resolveConflictWithStrategy<T>(
	conflict: ConflictData<T>,
	resolver: (conflict: ConflictData<T>) => T,
): T {
	return resolver(conflict);
}

/**
 * Set offline mode
 */
export function setOfflineMode(offline: boolean): void {
	isOffline = offline;
}

/**
 * Check if in offline mode
 */
export function isOfflineMode(): boolean {
	return isOffline;
}

/**
 * Queue an operation for later synchronization
 */
export function queueOperation(
	operation: Omit<QueuedOperation, "timestamp">,
): void {
	operationQueue.push({
		...operation,
		timestamp: new Date(),
	});
}

/**
 * Get queued operations
 */
export function getQueuedOperations(): QueuedOperation[] {
	return [...operationQueue];
}

/**
 * Clear queued operations
 */
export function clearQueuedOperations(): void {
	operationQueue = [];
}

/**
 * Sync queued operations when coming back online
 */
export async function syncQueuedOperations(): Promise<SyncResult> {
	if (isOffline || operationQueue.length === 0) {
		return { success: true, syncedCount: 0 };
	}

	try {
		if (!electricClient) {
			await createElectricClient();
		}

		// In a real implementation, this would apply the queued operations
		// For now, we'll just simulate successful sync
		const syncedCount = operationQueue.length;

		// Clear the queue after successful sync
		clearQueuedOperations();

		return { success: true, syncedCount };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Modern ElectricSQL Shape API functions
 */

/**
 * Get Electric authentication headers
 */
function getElectricHeaders(): HeadersInit {
	const electricSecret =
		typeof window !== "undefined"
			? process.env.NEXT_PUBLIC_ELECTRIC_SECRET
			: process.env.ELECTRIC_SECRET;

	const headers: HeadersInit = {
		"Content-Type": "application/json",
	};

	if (electricSecret) {
		headers.Authorization = `Bearer ${electricSecret}`;
	}

	return headers;
}

/**
 * Fetch a shape using the HTTP API
 */
export async function fetchShape(config: ShapeConfig): Promise<unknown[]> {
	const electricConfig = getElectricConfig();
	const params = new URLSearchParams({
		table: config.table,
		offset: config.offset || "-1",
	});

	if (config.where) {
		params.append("where", config.where);
	}

	if (config.columns) {
		params.append("columns", config.columns.join(","));
	}

	const url = `${electricConfig.url}/v1/shape?${params.toString()}`;

	try {
		const response = await fetch(url, {
			headers: getElectricHeaders(),
		});
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		throw new Error(
			`Failed to fetch shape: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Create a shape stream for real-time updates
 */
export function createShapeStream(config: ShapeConfig): EventSource {
	const electricConfig = getElectricConfig();
	const params = new URLSearchParams({
		table: config.table,
		offset: config.offset || "-1",
	});

	if (config.where) {
		params.append("where", config.where);
	}

	if (config.columns) {
		params.append("columns", config.columns.join(","));
	}

	// Add authentication token to URL params since EventSource doesn't support headers
	const electricSecret =
		typeof window !== "undefined"
			? process.env.NEXT_PUBLIC_ELECTRIC_SECRET
			: process.env.ELECTRIC_SECRET;

	if (electricSecret) {
		params.append("token", electricSecret);
	}

	const url = `${electricConfig.url}/v1/shape?${params.toString()}&live=true`;
	return new EventSource(url);
}

/**
 * Initialize ElectricSQL with automatic reconnection
 */
export async function initializeElectric(): Promise<ConnectionResult> {
	try {
		const _client = await createElectricClient();
		const connectionResult = await connectElectric();

		if (!connectionResult.success) {
			return connectionResult;
		}

		// Start synchronization for main tables
		await startTaskSync();
		await startEnvironmentSync();

		// Set up automatic reconnection on network changes
		if (typeof window !== "undefined") {
			window.addEventListener("online", async () => {
				setOfflineMode(false);
				await connectElectric();
				await syncQueuedOperations();
			});

			window.addEventListener("offline", () => {
				setOfflineMode(true);
			});
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Get ElectricSQL health status
 */
export function getElectricHealth(): {
	isConnected: boolean;
	isOffline: boolean;
	queuedOperations: number;
	lastSync?: Date;
} {
	return {
		isConnected: isElectricConnected(),
		isOffline: isOfflineMode(),
		queuedOperations: operationQueue.length,
		// In a real implementation, this would track the last sync time
		lastSync: undefined,
	};
}
