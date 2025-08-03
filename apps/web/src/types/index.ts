/**
 * Centralized type definitions export
 * Import types from here to maintain consistency across the application
 */

// Re-export commonly used types with aliases for convenience
export type {
	ApiResponse as BaseApiResponse,
	HealthStatus as BaseHealthStatus,
	LogEntry as BaseLogEntry,
	PerformanceMetric as BasePerformanceMetric,
	TaskExecution as BaseTaskExecution,
} from "./common";
// Core application types
export * from "./common";
export type {
	GitHubBranch,
	GitHubCommit,
	GitHubIssue,
	GitHubPullRequest,
	GitHubRepository,
	GitHubUser,
	RepositoryData,
} from "./github";
// Integration types
export * from "./github";
export type {
	AutomationResult,
	AutomationTask,
	ExtractedData,
	ExtractSchema,
	ObservationData,
	SessionConfig,
} from "./stagehand";
export * from "./stagehand";
export type {
	ConversationContext,
	ConversationMessage,
	LLMRequest,
	LLMResponse,
	VoiceCommand,
	VoiceRecognitionResult,
	VoiceSettings,
	VoiceUIState,
} from "./voice";
export * from "./voice";

// Type guards and utility functions
export const isApiResponse = <T>(obj: unknown): obj is ApiResponse<T> => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"success" in obj &&
		typeof (obj as Record<string, unknown>).success === "boolean"
	);
};

export const isHealthStatus = (obj: unknown): obj is HealthStatus => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"healthy" in obj &&
		typeof (obj as Record<string, unknown>).healthy === "boolean" &&
		"timestamp" in obj &&
		"service" in obj
	);
};

export const isVoiceRecognitionResult = (
	obj: unknown,
): obj is VoiceRecognitionResult => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"transcript" in obj &&
		"confidence" in obj &&
		"isFinal" in obj &&
		typeof (obj as Record<string, unknown>).transcript === "string"
	);
};

export const isGitHubRepository = (obj: unknown): obj is GitHubRepository => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"id" in obj &&
		"name" in obj &&
		"full_name" in obj &&
		typeof (obj as Record<string, unknown>).id === "number"
	);
};

// Import statements for better IDE support
import type { ApiResponse, HealthStatus } from "./common";
import type { GitHubRepository } from "./github";
import type { VoiceRecognitionResult } from "./voice";
