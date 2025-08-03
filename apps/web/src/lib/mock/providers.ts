import { excludeFromProduction } from "./manager";

/**
 * Mock data providers for development and testing
 * These are automatically excluded from production builds
 */

/**
 * Mock user data
 */
export const mockUsers = excludeFromProduction([
	{
		id: "user-1",
		name: "John Doe",
		email: "john.doe@example.com",
		avatar: "https://avatars.githubusercontent.com/u/1?v=4",
		role: "developer",
	},
	{
		id: "user-2",
		name: "Jane Smith",
		email: "jane.smith@example.com",
		avatar: "https://avatars.githubusercontent.com/u/2?v=4",
		role: "designer",
	},
]);

/**
 * Mock task data
 */
export const mockTasks = excludeFromProduction([
	{
		id: "task-1",
		title: "Implement user authentication",
		description: "Add OAuth integration with GitHub",
		status: "in_progress",
		priority: "high",
		assignee: "user-1",
		createdAt: new Date("2024-01-01T10:00:00Z"),
		updatedAt: new Date("2024-01-02T15:30:00Z"),
	},
	{
		id: "task-2",
		title: "Design landing page",
		description: "Create responsive landing page design",
		status: "completed",
		priority: "medium",
		assignee: "user-2",
		createdAt: new Date("2024-01-01T09:00:00Z"),
		updatedAt: new Date("2024-01-01T17:00:00Z"),
	},
]);

/**
 * Mock environment data
 */
export const mockEnvironments = excludeFromProduction([
	{
		id: "env-1",
		name: "Development",
		url: "http://localhost:3001",
		status: "active",
		type: "development",
		lastDeployment: new Date("2024-01-02T10:00:00Z"),
	},
	{
		id: "env-2",
		name: "Staging",
		url: "https://staging.solomon-codes.com",
		status: "active",
		type: "staging",
		lastDeployment: new Date("2024-01-01T20:00:00Z"),
	},
]);

/**
 * Mock API responses
 */
export const mockApiResponses = excludeFromProduction({
	github: {
		user: {
			login: "mockuser",
			id: 12345,
			avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
			name: "Mock User",
			email: "mock@example.com",
		},
		repositories: [
			{
				id: 1,
				name: "solomon_codes",
				full_name: "mockuser/solomon_codes",
				private: false,
				html_url: "https://github.com/mockuser/solomon_codes",
				description: "Mock repository for development",
				default_branch: "main",
			},
		],
		branches: [
			{
				name: "main",
				commit: {
					sha: "abc123def456",
					url: "https://api.github.com/repos/mockuser/solomon_codes/commits/abc123def456",
				},
				protected: true,
			},
			{
				name: "feature/mock-branch",
				commit: {
					sha: "def456ghi789",
					url: "https://api.github.com/repos/mockuser/solomon_codes/commits/def456ghi789",
				},
				protected: false,
			},
		],
	},
	stagehand: {
		session: {
			sessionId: "mock-session-123",
			success: true,
			message: "Mock session created successfully",
		},
		automation: {
			success: true,
			result: "Mock automation completed",
			logs: [
				"Starting mock automation",
				"Mock step completed",
				"Automation finished",
			],
		},
	},
	vibekit: {
		response: {
			stdout: "Mock VibeKit response - task completed successfully",
			sandboxId: "mock-sandbox-456",
			success: true,
		},
	},
});

/**
 * Mock configuration data
 */
export const mockConfig = excludeFromProduction({
	database: {
		url: "postgresql://localhost:5432/solomon_codes_dev",
		maxConnections: 10,
		ssl: false,
	},
	redis: {
		url: "redis://localhost:6379",
		maxRetries: 3,
	},
	apis: {
		openai: {
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4",
		},
		github: {
			baseUrl: "https://api.github.com",
			clientId: "mock-github-client-id",
		},
	},
});

/**
 * Mock telemetry data
 */
export const mockTelemetry = excludeFromProduction({
	traces: [
		{
			traceId: "trace-123",
			spanId: "span-456",
			operationName: "mock-operation",
			duration: 150,
			status: "success",
			tags: {
				service: "solomon-codes-web",
				environment: "development",
			},
		},
	],
	metrics: {
		requestCount: 42,
		averageResponseTime: 125,
		errorRate: 0.02,
	},
});

/**
 * Mock error responses for testing error handling
 */
export const mockErrors = excludeFromProduction({
	networkError: new Error("Mock network error - connection timeout"),
	authError: new Error("Mock authentication error - invalid token"),
	validationError: new Error("Mock validation error - invalid input"),
	serverError: new Error("Mock server error - internal server error"),
});

/**
 * Mock delay utility for simulating network latency
 */
export const mockDelay = excludeFromProduction((ms = 500): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
});

/**
 * Mock data generators
 */
export const mockGenerators = excludeFromProduction({
	/**
	 * Generate mock user
	 */
	user: (overrides: Partial<Record<string, unknown>> = {}) => ({
		id: `user-${Math.random().toString(36).substr(2, 9)}`,
		name: "Mock User",
		email: "mock@example.com",
		avatar: "https://avatars.githubusercontent.com/u/1?v=4",
		role: "developer",
		...overrides,
	}),

	/**
	 * Generate mock task
	 */
	task: (overrides: Partial<Record<string, unknown>> = {}) => ({
		id: `task-${Math.random().toString(36).substr(2, 9)}`,
		title: "Mock Task",
		description: "This is a mock task for development",
		status: "pending",
		priority: "medium",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Generate mock environment
	 */
	environment: (overrides: Partial<Record<string, unknown>> = {}) => ({
		id: `env-${Math.random().toString(36).substr(2, 9)}`,
		name: "Mock Environment",
		url: "http://localhost:3001",
		status: "active",
		type: "development",
		lastDeployment: new Date(),
		...overrides,
	}),
});

/**
 * Type-safe mock data access
 */
export type MockDataType =
	| typeof mockUsers
	| typeof mockTasks
	| typeof mockEnvironments;

/**
 * Get mock data by type with fallback
 */
export function getMockData<T>(mockData: T | undefined, fallback: T): T {
	if (process.env.NODE_ENV === "production") {
		return fallback;
	}
	return mockData || fallback;
}
