/**
 * Terminal Session Test Double
 * TDD London School approach for VibeTunnel terminal sessions
 */

import { expect, vi } from "vitest";

export interface TerminalSessionState {
	id: string;
	status: "initializing" | "active" | "suspended" | "terminated" | "error";
	environment: Record<string, string>;
	workingDirectory: string;
	lastActivity: string;
	commandHistory: string[];
	activeProcesses: number;
}

export interface TerminalCommand {
	id: string;
	command: string;
	args: string[];
	workingDirectory: string;
	environment: Record<string, string>;
	timestamp: string;
	timeout?: number;
}

export interface TerminalResponse {
	commandId: string;
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
	timestamp: string;
}

export interface TerminalSessionCapabilities {
	initialize(config: {
		environment?: Record<string, string>;
		workingDirectory?: string;
	}): Promise<void>;
	executeCommand(command: TerminalCommand): Promise<TerminalResponse>;
	terminate(): Promise<void>;
	suspend(): Promise<void>;
	resume(): Promise<void>;
	getState(): TerminalSessionState;
	isActive(): boolean;
	setEnvironment(env: Record<string, string>): Promise<void>;
	changeDirectory(path: string): Promise<void>;
	getCommandHistory(): string[];
	clearHistory(): void;
}

export class TerminalSessionDouble implements TerminalSessionCapabilities {
	private state: TerminalSessionState;

	// Test helpers for controlling behavior
	public shouldFailInitialization = false;
	public shouldFailCommand = false;
	public commandResponses: Map<string, TerminalResponse> = new Map();
	public executionLog: TerminalCommand[] = [];
	public simulateExecutionTime = 0;

	constructor(id = "terminal-test-session") {
		this.state = {
			id,
			status: "initializing",
			environment: { ...process.env },
			workingDirectory: process.cwd(),
			lastActivity: new Date().toISOString(),
			commandHistory: [],
			activeProcesses: 0,
		};
	}

	async initialize(
		config: {
			environment?: Record<string, string>;
			workingDirectory?: string;
		} = {},
	): Promise<void> {
		if (this.shouldFailInitialization) {
			this.state.status = "error";
			throw new Error("Simulated initialization failure");
		}

		if (config.environment) {
			this.state.environment = {
				...this.state.environment,
				...config.environment,
			};
		}

		if (config.workingDirectory) {
			this.state.workingDirectory = config.workingDirectory;
		}

		this.state.status = "active";
		this.state.lastActivity = new Date().toISOString();
	}

	async executeCommand(command: TerminalCommand): Promise<TerminalResponse> {
		this.executionLog.push({ ...command });
		this.state.lastActivity = new Date().toISOString();
		this.state.commandHistory.push(command.command);

		if (this.state.status !== "active") {
			throw new Error(`Terminal session not active: ${this.state.status}`);
		}

		if (this.shouldFailCommand) {
			const errorResponse: TerminalResponse = {
				commandId: command.id,
				exitCode: 1,
				stdout: "",
				stderr: "Simulated command failure",
				duration: 0,
				timestamp: new Date().toISOString(),
			};
			return errorResponse;
		}

		// Check if we have a pre-configured response for this command
		const preConfiguredResponse = this.commandResponses.get(command.command);
		if (preConfiguredResponse) {
			return {
				...preConfiguredResponse,
				commandId: command.id,
				timestamp: new Date().toISOString(),
			};
		}

		// Simulate execution time
		if (this.simulateExecutionTime > 0) {
			await new Promise((resolve) =>
				setTimeout(resolve, this.simulateExecutionTime),
			);
		}

		// Default successful response
		const response: TerminalResponse = {
			commandId: command.id,
			exitCode: 0,
			stdout: `Mock output for command: ${command.command}`,
			stderr: "",
			duration: this.simulateExecutionTime,
			timestamp: new Date().toISOString(),
		};

		return response;
	}

	async terminate(): Promise<void> {
		this.state.status = "terminated";
		this.state.activeProcesses = 0;
		this.state.lastActivity = new Date().toISOString();
	}

	async suspend(): Promise<void> {
		if (this.state.status === "active") {
			this.state.status = "suspended";
			this.state.lastActivity = new Date().toISOString();
		}
	}

	async resume(): Promise<void> {
		if (this.state.status === "suspended") {
			this.state.status = "active";
			this.state.lastActivity = new Date().toISOString();
		}
	}

	getState(): TerminalSessionState {
		return { ...this.state };
	}

	isActive(): boolean {
		return this.state.status === "active";
	}

	async setEnvironment(env: Record<string, string>): Promise<void> {
		this.state.environment = { ...this.state.environment, ...env };
		this.state.lastActivity = new Date().toISOString();
	}

	async changeDirectory(path: string): Promise<void> {
		this.state.workingDirectory = path;
		this.state.lastActivity = new Date().toISOString();
	}

	getCommandHistory(): string[] {
		return [...this.state.commandHistory];
	}

	clearHistory(): void {
		this.state.commandHistory = [];
	}

	// Test helper methods
	setCommandResponse(
		command: string,
		response: Partial<TerminalResponse>,
	): void {
		const fullResponse: TerminalResponse = {
			commandId: "",
			exitCode: 0,
			stdout: "",
			stderr: "",
			duration: 0,
			timestamp: new Date().toISOString(),
			...response,
		};
		this.commandResponses.set(command, fullResponse);
	}

	simulateProcessStart(): void {
		this.state.activeProcesses++;
	}

	simulateProcessEnd(): void {
		this.state.activeProcesses = Math.max(0, this.state.activeProcesses - 1);
	}

	getExecutionLog(): TerminalCommand[] {
		return [...this.executionLog];
	}

	clearExecutionLog(): void {
		this.executionLog = [];
	}

	resetState(): void {
		this.clearExecutionLog();
		this.commandResponses.clear();
		this.state = {
			id: this.state.id,
			status: "initializing",
			environment: { ...process.env },
			workingDirectory: process.cwd(),
			lastActivity: new Date().toISOString(),
			commandHistory: [],
			activeProcesses: 0,
		};
		this.shouldFailInitialization = false;
		this.shouldFailCommand = false;
		this.simulateExecutionTime = 0;
	}
}

// Helper functions for test setup
export function createTerminalSessionDouble(
	id?: string,
	options: Partial<{
		shouldFailInitialization: boolean;
		shouldFailCommand: boolean;
		simulateExecutionTime: number;
	}> = {},
): TerminalSessionDouble {
	const double = new TerminalSessionDouble(id);

	if (options.shouldFailInitialization) {
		double.shouldFailInitialization = true;
	}
	if (options.shouldFailCommand) {
		double.shouldFailCommand = true;
	}
	if (options.simulateExecutionTime) {
		double.simulateExecutionTime = options.simulateExecutionTime;
	}

	return double;
}

export function expectTerminalSession(session: TerminalSessionDouble) {
	return {
		toHaveExecutedCommand: (command: string) => {
			const executionLog = session.getExecutionLog();
			expect(executionLog.some((cmd) => cmd.command === command)).toBe(true);
		},

		toHaveExecutedCommandWithArgs: (command: string, args: string[]) => {
			const executionLog = session.getExecutionLog();
			const matchingCommand = executionLog.find(
				(cmd) =>
					cmd.command === command &&
					JSON.stringify(cmd.args) === JSON.stringify(args),
			);
			expect(matchingCommand).toBeDefined();
		},

		toHaveState: (expectedState: Partial<TerminalSessionState>) => {
			const currentState = session.getState();
			Object.entries(expectedState).forEach(([key, value]) => {
				expect(currentState[key as keyof TerminalSessionState]).toEqual(value);
			});
		},

		toBeActive: () => {
			expect(session.isActive()).toBe(true);
		},

		toBeTerminated: () => {
			expect(session.getState().status).toBe("terminated");
		},

		toHaveCommandInHistory: (command: string) => {
			expect(session.getCommandHistory()).toContain(command);
		},

		toHaveEnvironmentVariable: (key: string, value: string) => {
			expect(session.getState().environment[key]).toBe(value);
		},
	};
}
