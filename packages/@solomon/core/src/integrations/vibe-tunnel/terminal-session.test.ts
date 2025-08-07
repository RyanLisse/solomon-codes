/**
 * VibeTunnel Terminal Session Tests
 * TDD London School approach with comprehensive test coverage
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	TerminalCommand,
	TerminalResponse,
	TerminalSessionState,
} from "../../tests/test-doubles/integrations/vibe-tunnel/terminal-session.double";
import {
	createVibeTunnelTerminalSession,
	VibeTunnelTerminalManager,
	VibeTunnelTerminalSession,
} from "./terminal-session";

describe("VibeTunnelTerminalSession", () => {
	let session: VibeTunnelTerminalSession;

	beforeEach(() => {
		session = new VibeTunnelTerminalSession("test-session");
	});

	describe("Session Initialization", () => {
		it("should initialize with correct default state", () => {
			const state = session.getState();

			expect(state.id).toBe("test-session");
			expect(state.status).toBe("initializing");
			expect(state.environment).toBeDefined();
			expect(state.workingDirectory).toBeDefined();
			expect(state.commandHistory).toEqual([]);
			expect(state.activeProcesses).toBe(0);
			expect(state.lastActivity).toBeDefined();
		});

		it("should initialize with custom configuration", async () => {
			const customSession = new VibeTunnelTerminalSession("custom", {
				maxHistorySize: 500,
				commandTimeout: 60000,
			});

			await customSession.initialize({
				environment: { NODE_ENV: "test" },
				workingDirectory: "/tmp",
			});

			const state = customSession.getState();
			expect(state.status).toBe("active");
			expect(state.environment.NODE_ENV).toBe("test");
			expect(state.workingDirectory).toBe("/tmp");
		});

		it("should reject initialization with restricted paths", async () => {
			const restrictedSession = new VibeTunnelTerminalSession("restricted", {
				restrictedPaths: ["/etc", "/root"],
			});

			await expect(
				restrictedSession.initialize({
					workingDirectory: "/etc/config",
				}),
			).rejects.toThrow("Access denied to path: /etc/config");
		});

		it("should transition from initializing to active", async () => {
			expect(session.getState().status).toBe("initializing");
			expect(session.isActive()).toBe(false);

			await session.initialize();

			expect(session.getState().status).toBe("active");
			expect(session.isActive()).toBe(true);
		});
	});

	describe("Command Execution", () => {
		beforeEach(async () => {
			await session.initialize();
		});

		it("should execute simple commands successfully", async () => {
			const command: TerminalCommand = {
				id: "cmd-1",
				command: "echo",
				args: ["hello", "world"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			const response = await session.executeCommand(command);

			expect(response.commandId).toBe("cmd-1");
			expect(response.exitCode).toBe(0);
			expect(response.stdout).toBe("hello world");
			expect(response.stderr).toBe("");
			expect(response.duration).toBeGreaterThanOrEqual(0);
			expect(response.timestamp).toBeDefined();
		});

		it("should handle pwd command", async () => {
			await session.changeDirectory("/test/dir");

			const command: TerminalCommand = {
				id: "pwd-cmd",
				command: "pwd",
				args: [],
				workingDirectory: "/test/dir",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			const response = await session.executeCommand(command);

			expect(response.exitCode).toBe(0);
			expect(response.stdout).toBe("/test/dir");
		});

		it("should handle ls command", async () => {
			const command: TerminalCommand = {
				id: "ls-cmd",
				command: "ls",
				args: [],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			const response = await session.executeCommand(command);

			expect(response.exitCode).toBe(0);
			expect(response.stdout).toContain("file1.txt");
			expect(response.stdout).toContain("directory1/");
		});

		it("should reject commands when session is not active", async () => {
			await session.terminate();

			const command: TerminalCommand = {
				id: "cmd-inactive",
				command: "echo",
				args: ["test"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			await expect(session.executeCommand(command)).rejects.toThrow(
				"Terminal session not active: terminated",
			);
		});

		it("should enforce maximum active processes limit", async () => {
			const limitedSession = new VibeTunnelTerminalSession("limited", {
				maxActiveProcesses: 1,
			});
			await limitedSession.initialize();

			// Simulate one active process
			limitedSession.getState().activeProcesses = 1;

			const command: TerminalCommand = {
				id: "cmd-limit",
				command: "echo",
				args: ["test"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			await expect(limitedSession.executeCommand(command)).rejects.toThrow(
				"Maximum active processes limit reached",
			);
		});

		it("should track command history", async () => {
			const commands = [
				{ command: "pwd", args: [] },
				{ command: "ls", args: ["-la"] },
				{ command: "echo", args: ["test"] },
			];

			for (const [index, cmd] of commands.entries()) {
				const command: TerminalCommand = {
					id: `cmd-${index}`,
					command: cmd.command,
					args: cmd.args,
					workingDirectory: "/tmp",
					environment: {},
					timestamp: new Date().toISOString(),
				};

				await session.executeCommand(command);
			}

			const history = session.getCommandHistory();
			expect(history).toHaveLength(3);
			expect(history[0]).toBe("pwd");
			expect(history[1]).toBe("ls");
			expect(history[2]).toBe("echo");
		});

		it("should limit command history size", async () => {
			const limitedSession = new VibeTunnelTerminalSession("limited", {
				maxHistorySize: 2,
			});
			await limitedSession.initialize();

			// Execute 3 commands
			for (let i = 0; i < 3; i++) {
				const command: TerminalCommand = {
					id: `cmd-${i}`,
					command: `command${i}`,
					args: [],
					workingDirectory: "/tmp",
					environment: {},
					timestamp: new Date().toISOString(),
				};

				await limitedSession.executeCommand(command);
			}

			const history = limitedSession.getCommandHistory();
			expect(history).toHaveLength(2);
			expect(history[0]).toBe("command1"); // First command should be removed
			expect(history[1]).toBe("command2");
		});
	});

	describe("Security and Validation", () => {
		let secureSession: VibeTunnelTerminalSession;

		beforeEach(async () => {
			secureSession = new VibeTunnelTerminalSession("secure", {
				allowedCommands: ["ls", "pwd", "echo"],
				restrictedPaths: ["/etc", "/root", "/sys"],
			});
			await secureSession.initialize();
		});

		it("should reject disallowed commands", async () => {
			const command: TerminalCommand = {
				id: "bad-cmd",
				command: "rm",
				args: ["-rf", "/"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			await expect(secureSession.executeCommand(command)).rejects.toThrow(
				"Command not allowed: rm",
			);
		});

		it("should reject commands accessing restricted paths", async () => {
			const command: TerminalCommand = {
				id: "restricted-cmd",
				command: "ls",
				args: ["/etc/passwd"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			await expect(secureSession.executeCommand(command)).rejects.toThrow(
				"Access denied to restricted path: /etc",
			);
		});

		it("should reject changing to restricted directory", async () => {
			await expect(secureSession.changeDirectory("/root")).rejects.toThrow(
				"Access denied to path: /root",
			);
		});

		it("should reject commands with restricted working directory", async () => {
			const command: TerminalCommand = {
				id: "bad-wd-cmd",
				command: "pwd",
				args: [],
				workingDirectory: "/sys/kernel",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			await expect(secureSession.executeCommand(command)).rejects.toThrow(
				"Access denied to working directory: /sys/kernel",
			);
		});
	});

	describe("Session State Management", () => {
		beforeEach(async () => {
			await session.initialize();
		});

		it("should suspend and resume session", async () => {
			expect(session.isActive()).toBe(true);

			await session.suspend();
			expect(session.getState().status).toBe("suspended");
			expect(session.isActive()).toBe(false);

			await session.resume();
			expect(session.getState().status).toBe("active");
			expect(session.isActive()).toBe(true);
		});

		it("should terminate session properly", async () => {
			await session.terminate();

			const state = session.getState();
			expect(state.status).toBe("terminated");
			expect(state.activeProcesses).toBe(0);
			expect(session.isActive()).toBe(false);
		});

		it("should update environment variables", async () => {
			await session.setEnvironment({
				NODE_ENV: "production",
				DEBUG: "true",
			});

			const state = session.getState();
			expect(state.environment.NODE_ENV).toBe("production");
			expect(state.environment.DEBUG).toBe("true");
		});

		it("should change working directory", async () => {
			await session.changeDirectory("/new/path");

			const state = session.getState();
			expect(state.workingDirectory).toBe("/new/path");
		});

		it("should clear command history", () => {
			// Add some history first
			session.getState().commandHistory.push("test1", "test2", "test3");
			expect(session.getCommandHistory()).toHaveLength(3);

			session.clearHistory();
			expect(session.getCommandHistory()).toHaveLength(0);
		});

		it("should provide immutable state snapshots", () => {
			const state1 = session.getState();
			const state2 = session.getState();

			expect(state1).not.toBe(state2);
			expect(state1).toEqual(state2);

			// Modifying returned state should not affect internal state
			state1.commandHistory.push("modified");
			expect(session.getCommandHistory()).toHaveLength(0);
		});
	});
});

describe("VibeTunnelTerminalManager", () => {
	let manager: VibeTunnelTerminalManager;

	beforeEach(() => {
		manager = new VibeTunnelTerminalManager();
	});

	afterEach(async () => {
		await manager.terminateAllSessions();
	});

	describe("Session Management", () => {
		it("should create and initialize new sessions", async () => {
			const session = await manager.createSession("session-1");

			expect(session).toBeInstanceOf(VibeTunnelTerminalSession);
			expect(session.getState().id).toBe("session-1");
			expect(session.isActive()).toBe(true);
		});

		it("should create sessions with custom config", async () => {
			const session = await manager.createSession("session-1", {
				maxHistorySize: 100,
				commandTimeout: 30000,
			});

			expect(session.getState().id).toBe("session-1");
			expect(session.isActive()).toBe(true);
		});

		it("should prevent duplicate session IDs", async () => {
			await manager.createSession("duplicate-id");

			await expect(manager.createSession("duplicate-id")).rejects.toThrow(
				"Terminal session with ID duplicate-id already exists",
			);
		});

		it("should retrieve existing sessions", async () => {
			const originalSession = await manager.createSession("session-1");
			const retrievedSession = manager.getSession("session-1");

			expect(retrievedSession).toBe(originalSession);
		});

		it("should return undefined for non-existent sessions", () => {
			const session = manager.getSession("non-existent");
			expect(session).toBeUndefined();
		});

		it("should terminate specific sessions", async () => {
			const session = await manager.createSession("session-1");
			expect(session.isActive()).toBe(true);

			await manager.terminateSession("session-1");

			const retrievedSession = manager.getSession("session-1");
			expect(retrievedSession).toBeUndefined();
		});

		it("should handle terminating non-existent sessions gracefully", async () => {
			// Should not throw error
			await manager.terminateSession("non-existent");
		});

		it("should terminate all sessions", async () => {
			await manager.createSession("session-1");
			await manager.createSession("session-2");
			await manager.createSession("session-3");

			const activeBefore = manager.getActiveSessions();
			expect(activeBefore).toHaveLength(3);

			await manager.terminateAllSessions();

			const activeAfter = manager.getActiveSessions();
			expect(activeAfter).toHaveLength(0);
		});

		it("should list active sessions", async () => {
			await manager.createSession("active-1");
			await manager.createSession("active-2");

			const session3 = await manager.createSession("inactive");
			await session3.suspend();

			const activeSessions = manager.getActiveSessions();
			expect(activeSessions).toHaveLength(2);
			expect(activeSessions).toContain("active-1");
			expect(activeSessions).toContain("active-2");
			expect(activeSessions).not.toContain("inactive");
		});

		it("should get session states", async () => {
			await manager.createSession("session-1");
			await manager.createSession("session-2");

			const states = manager.getSessionStates();

			expect(Object.keys(states)).toHaveLength(2);
			expect(states["session-1"]).toBeDefined();
			expect(states["session-2"]).toBeDefined();
			expect(states["session-1"].id).toBe("session-1");
			expect(states["session-2"].id).toBe("session-2");
		});
	});

	describe("Concurrent Session Operations", () => {
		it("should handle multiple concurrent session creations", async () => {
			const createPromises = Array.from({ length: 5 }, (_, i) =>
				manager.createSession(`concurrent-${i}`),
			);

			const sessions = await Promise.all(createPromises);

			expect(sessions).toHaveLength(5);
			sessions.forEach((session, index) => {
				expect(session.getState().id).toBe(`concurrent-${index}`);
				expect(session.isActive()).toBe(true);
			});
		});

		it("should handle concurrent operations on different sessions", async () => {
			const session1 = await manager.createSession("session-1");
			const session2 = await manager.createSession("session-2");

			const command1: TerminalCommand = {
				id: "cmd-1",
				command: "echo",
				args: ["session-1"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			const command2: TerminalCommand = {
				id: "cmd-2",
				command: "echo",
				args: ["session-2"],
				workingDirectory: "/tmp",
				environment: {},
				timestamp: new Date().toISOString(),
			};

			const [response1, response2] = await Promise.all([
				session1.executeCommand(command1),
				session2.executeCommand(command2),
			]);

			expect(response1.stdout).toBe("session-1");
			expect(response2.stdout).toBe("session-2");
		});
	});
});

describe("createVibeTunnelTerminalSession Factory", () => {
	it("should create session with default config", () => {
		const session = createVibeTunnelTerminalSession("factory-test");

		expect(session).toBeInstanceOf(VibeTunnelTerminalSession);
		expect(session.getState().id).toBe("factory-test");
		expect(session.getState().status).toBe("initializing");
	});

	it("should create session with custom config", () => {
		const session = createVibeTunnelTerminalSession("factory-test", {
			maxHistorySize: 200,
			commandTimeout: 45000,
			allowedCommands: ["ls", "pwd"],
		});

		expect(session).toBeInstanceOf(VibeTunnelTerminalSession);
		expect(session.getState().id).toBe("factory-test");
	});
});
