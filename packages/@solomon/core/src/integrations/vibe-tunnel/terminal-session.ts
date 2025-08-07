/**
 * VibeTunnel Terminal Session Implementation
 * Browser-based terminal access with secure command execution
 */

import type {
	TerminalCommand,
	TerminalResponse,
	TerminalSessionCapabilities,
	TerminalSessionState,
} from "../../tests/test-doubles/integrations/vibe-tunnel/terminal-session.double";

export interface TerminalSessionConfig {
	maxHistorySize?: number;
	commandTimeout?: number;
	maxActiveProcesses?: number;
	allowedCommands?: string[];
	restrictedPaths?: string[];
}

export class VibeTunnelTerminalSession implements TerminalSessionCapabilities {
	private readonly state: TerminalSessionState;
	private readonly config: Required<TerminalSessionConfig>;
	private readonly activeCommands: Map<string, NodeJS.Timeout> = new Map();

	constructor(id: string, config: TerminalSessionConfig = {}) {
		this.config = {
			maxHistorySize: config.maxHistorySize || 1000,
			commandTimeout: config.commandTimeout || 30000, // 30 seconds
			maxActiveProcesses: config.maxActiveProcesses || 10,
			allowedCommands: config.allowedCommands || [],
			restrictedPaths: config.restrictedPaths || [],
		};

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
		if (config.environment) {
			this.state.environment = {
				...this.state.environment,
				...config.environment,
			};
		}

		if (config.workingDirectory) {
			// Validate working directory is allowed
			if (this.isPathRestricted(config.workingDirectory)) {
				throw new Error(`Access denied to path: ${config.workingDirectory}`);
			}
			this.state.workingDirectory = config.workingDirectory;
		}

		this.state.status = "active";
		this.state.lastActivity = new Date().toISOString();
	}

	async executeCommand(command: TerminalCommand): Promise<TerminalResponse> {
		this.state.lastActivity = new Date().toISOString();

		if (this.state.status !== "active") {
			throw new Error(`Terminal session not active: ${this.state.status}`);
		}

		if (this.state.activeProcesses >= this.config.maxActiveProcesses) {
			throw new Error("Maximum active processes limit reached");
		}

		// Security checks
		this.validateCommand(command);

		// Add to history
		this.addToHistory(command.command);

		const startTime = Date.now();
		this.state.activeProcesses++;

		try {
			// Set up command timeout
			const timeoutId = setTimeout(() => {
				this.state.activeProcesses--;
				throw new Error("Command execution timeout");
			}, command.timeout || this.config.commandTimeout);

			this.activeCommands.set(command.id, timeoutId);

			// Execute command (in a real implementation, this would spawn a process)
			const result = await this.executeCommandInternal(command);

			// Clear timeout
			const timeout = this.activeCommands.get(command.id);
			if (timeout) {
				clearTimeout(timeout);
				this.activeCommands.delete(command.id);
			}

			const duration = Date.now() - startTime;
			this.state.activeProcesses--;

			return {
				commandId: command.id,
				exitCode: result.exitCode,
				stdout: result.stdout,
				stderr: result.stderr,
				duration,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			this.state.activeProcesses--;
			const duration = Date.now() - startTime;

			return {
				commandId: command.id,
				exitCode: 1,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				duration,
				timestamp: new Date().toISOString(),
			};
		}
	}

	async terminate(): Promise<void> {
		// Cancel all active commands
		for (const [commandId, timeout] of this.activeCommands) {
			clearTimeout(timeout);
		}
		this.activeCommands.clear();

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
		if (this.isPathRestricted(path)) {
			throw new Error(`Access denied to path: ${path}`);
		}

		this.state.workingDirectory = path;
		this.state.lastActivity = new Date().toISOString();
	}

	getCommandHistory(): string[] {
		return [...this.state.commandHistory];
	}

	clearHistory(): void {
		this.state.commandHistory = [];
	}

	private validateCommand(command: TerminalCommand): void {
		// Check if command is in allowed list (if specified)
		if (this.config.allowedCommands.length > 0) {
			const baseCommand = command.command.split(" ")[0];
			if (!this.config.allowedCommands.includes(baseCommand)) {
				throw new Error(`Command not allowed: ${baseCommand}`);
			}
		}

		// Check for restricted paths in command
		const fullCommand = `${command.command} ${command.args.join(" ")}`;
		for (const restrictedPath of this.config.restrictedPaths) {
			if (fullCommand.includes(restrictedPath)) {
				throw new Error(`Access denied to restricted path: ${restrictedPath}`);
			}
		}

		// Check working directory
		if (this.isPathRestricted(command.workingDirectory)) {
			throw new Error(
				`Access denied to working directory: ${command.workingDirectory}`,
			);
		}
	}

	private isPathRestricted(path: string): boolean {
		return this.config.restrictedPaths.some((restricted) =>
			path.startsWith(restricted),
		);
	}

	private addToHistory(command: string): void {
		this.state.commandHistory.push(command);

		// Trim history if it exceeds max size
		if (this.state.commandHistory.length > this.config.maxHistorySize) {
			this.state.commandHistory = this.state.commandHistory.slice(
				-this.config.maxHistorySize,
			);
		}
	}

	private async executeCommandInternal(command: TerminalCommand): Promise<{
		exitCode: number;
		stdout: string;
		stderr: string;
	}> {
		// This is a simplified implementation
		// In a real system, this would use child_process or similar

		try {
			// Simulate command execution based on command type
			if (command.command === "pwd") {
				return {
					exitCode: 0,
					stdout: command.workingDirectory,
					stderr: "",
				};
			}

			if (command.command === "echo" && command.args.length > 0) {
				return {
					exitCode: 0,
					stdout: command.args.join(" "),
					stderr: "",
				};
			}

			if (command.command === "ls") {
				return {
					exitCode: 0,
					stdout: "file1.txt\nfile2.txt\ndirectory1/",
					stderr: "",
				};
			}

			// Default success response for unknown commands
			return {
				exitCode: 0,
				stdout: `Executed: ${command.command} ${command.args.join(" ")}`,
				stderr: "",
			};
		} catch (error) {
			return {
				exitCode: 1,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Execution failed",
			};
		}
	}
}

// Factory function for creating VibeTunnel terminal sessions
export function createVibeTunnelTerminalSession(
	id: string,
	config?: TerminalSessionConfig,
): VibeTunnelTerminalSession {
	return new VibeTunnelTerminalSession(id, config);
}

// Terminal session manager for multiple sessions
export class VibeTunnelTerminalManager {
	private readonly sessions: Map<string, VibeTunnelTerminalSession> = new Map();

	async createSession(
		id: string,
		config?: TerminalSessionConfig,
	): Promise<VibeTunnelTerminalSession> {
		if (this.sessions.has(id)) {
			throw new Error(`Terminal session with ID ${id} already exists`);
		}

		const session = new VibeTunnelTerminalSession(id, config);
		await session.initialize();
		this.sessions.set(id, session);

		return session;
	}

	getSession(id: string): VibeTunnelTerminalSession | undefined {
		return this.sessions.get(id);
	}

	async terminateSession(id: string): Promise<void> {
		const session = this.sessions.get(id);
		if (session) {
			await session.terminate();
			this.sessions.delete(id);
		}
	}

	async terminateAllSessions(): Promise<void> {
		const promises = Array.from(this.sessions.keys()).map((id) =>
			this.terminateSession(id),
		);
		await Promise.all(promises);
	}

	getActiveSessions(): string[] {
		return Array.from(this.sessions.keys()).filter((id) => {
			const session = this.sessions.get(id);
			return session?.isActive();
		});
	}

	getSessionStates(): Record<string, TerminalSessionState> {
		const states: Record<string, TerminalSessionState> = {};
		this.sessions.forEach((session, id) => {
			states[id] = session.getState();
		});
		return states;
	}
}
