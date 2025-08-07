/**
 * Tool Adapter Framework - Main Export Module
 * Unified interface for all LangGraph tool integrations
 */

// Core framework exports
export {
	type AdapterConfig,
	type AdapterEvent,
	AdapterRegistry,
	type AdapterStatus,
	BaseAdapter,
	createToolIntegrationState,
	globalAdapterRegistry,
	type ToolAdapter,
	updateToolIntegrationStatus,
} from "./adapter-framework";
export {
	AgentInboxAdapter,
	type AgentInboxConfig,
	AgentInboxConfigSchema,
	type AgentInboxInput,
	type AgentInboxResult,
} from "./adapters/agent-inbox-adapter";
// Specific adapter exports
export {
	VibeTunnelAdapter,
	type VibeTunnelConfig,
	VibeTunnelConfigSchema,
	type VibeTunnelInput,
	type VibeTunnelResult,
} from "./adapters/vibe-tunnel-adapter";

export {
	VoiceSystemAdapter,
	type VoiceSystemConfig,
	VoiceSystemConfigSchema,
	type VoiceSystemInput,
	type VoiceSystemResult,
} from "./adapters/voice-system-adapter";

// Adapter factory for easy instantiation
export function createAdapterRegistry(): AdapterRegistry {
	const registry = new AdapterRegistry();

	// Register all available adapters
	registry.register(new VibeTunnelAdapter());
	registry.register(new AgentInboxAdapter());
	registry.register(new VoiceSystemAdapter());

	return registry;
}

// Pre-configured adapter registry with all adapters
export const defaultAdapterRegistry = createAdapterRegistry();

// Helper function to get adapter by name with type safety
export function getAdapter<T extends ToolAdapter>(
	registry: AdapterRegistry,
	name: string,
): T | undefined {
	return registry.get<T>(name);
}

// LangGraph tool integration helpers
export async function initializeAllAdapters(
	registry: AdapterRegistry,
	configs: {
		vibeTunnel?: VibeTunnelConfig;
		agentInbox?: AgentInboxConfig;
		voiceSystem?: VoiceSystemConfig;
	},
): Promise<void> {
	const adapterConfigs: Record<string, unknown> = {};

	if (configs.vibeTunnel) {
		adapterConfigs.vibeTunnel = configs.vibeTunnel;
	}

	if (configs.agentInbox) {
		adapterConfigs.agentInbox = configs.agentInbox;
	}

	if (configs.voiceSystem) {
		adapterConfigs.voiceSystem = configs.voiceSystem;
	}

	await registry.initializeAll(adapterConfigs);
}

// Health check for all adapters
export async function checkAdapterHealth(registry: AdapterRegistry): Promise<{
	healthy: boolean;
	status: Record<string, AdapterStatus>;
	summary: {
		total: number;
		healthy: number;
		degraded: number;
		error: number;
		inactive: number;
	};
}> {
	const status = await registry.getHealthStatus();

	const summary = {
		total: 0,
		healthy: 0,
		degraded: 0,
		error: 0,
		inactive: 0,
	};

	for (const adapterStatus of Object.values(status)) {
		summary.total++;
		summary[adapterStatus.status]++;
	}

	const healthy = summary.error === 0 && summary.total > 0;

	return {
		healthy,
		status,
		summary,
	};
}

// Export type definitions for LangGraph integration
export type {
	ByzantineConsensusEngine,
	ConsensusSession,
	ImplementationPhases,
	NetworkGraph,
	ToolIntegrationState,
	TopologyManager,
} from "../state/unified-state";

import { AgentInboxConfigSchema } from "./adapters/agent-inbox-adapter";
// Re-export adapter configurations for convenience
import { VibeTunnelConfigSchema } from "./adapters/vibe-tunnel-adapter";
import { VoiceSystemConfigSchema } from "./adapters/voice-system-adapter";

export const AdapterConfigSchemas = {
	vibeTunnel: VibeTunnelConfigSchema,
	agentInbox: AgentInboxConfigSchema,
	voiceSystem: VoiceSystemConfigSchema,
} as const;
