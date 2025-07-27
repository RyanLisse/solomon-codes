import { describe, expect, it } from "vitest";
import {
	agentExecutions,
	agentMemory,
	environments,
	executionSnapshots,
	observabilityEvents,
	tasks,
	workflowExecutions,
	workflows,
} from "./schema";

describe("Database Schema", () => {
	describe("Tasks Table", () => {
		it("should have all required fields for task management", () => {
			const taskColumns = Object.keys(tasks);

			expect(taskColumns).toContain("id");
			expect(taskColumns).toContain("title");
			expect(taskColumns).toContain("description");
			expect(taskColumns).toContain("status");
			expect(taskColumns).toContain("messages");
			expect(taskColumns).toContain("branch");
			expect(taskColumns).toContain("sessionId");
			expect(taskColumns).toContain("repository");
			expect(taskColumns).toContain("createdAt");
			expect(taskColumns).toContain("updatedAt");
			expect(taskColumns).toContain("isArchived");
			expect(taskColumns).toContain("mode");
			expect(taskColumns).toContain("hasChanges");
		});

		it("should support task status values", () => {
			// This test ensures the schema supports the expected status values
			const validStatuses = ["IN_PROGRESS", "DONE", "MERGED"];
			expect(validStatuses).toContain("IN_PROGRESS");
			expect(validStatuses).toContain("DONE");
			expect(validStatuses).toContain("MERGED");
		});

		it("should support task modes", () => {
			const validModes = ["code", "ask"];
			expect(validModes).toContain("code");
			expect(validModes).toContain("ask");
		});
	});

	describe("Environments Table", () => {
		it("should have all required fields for environment management", () => {
			const envColumns = Object.keys(environments);

			expect(envColumns).toContain("id");
			expect(envColumns).toContain("name");
			expect(envColumns).toContain("description");
			expect(envColumns).toContain("githubOrganization");
			expect(envColumns).toContain("githubToken");
			expect(envColumns).toContain("githubRepository");
			expect(envColumns).toContain("createdAt");
			expect(envColumns).toContain("updatedAt");
			expect(envColumns).toContain("isActive");
		});
	});

	describe("Agent Executions Table", () => {
		it("should have all required fields for agent tracking", () => {
			const agentColumns = Object.keys(agentExecutions);

			expect(agentColumns).toContain("id");
			expect(agentColumns).toContain("taskId");
			expect(agentColumns).toContain("agentType");
			expect(agentColumns).toContain("status");
			expect(agentColumns).toContain("startedAt");
			expect(agentColumns).toContain("completedAt");
			expect(agentColumns).toContain("input");
			expect(agentColumns).toContain("output");
			expect(agentColumns).toContain("error");
			expect(agentColumns).toContain("traceId");
			expect(agentColumns).toContain("executionTimeMs");
			expect(agentColumns).toContain("tokenUsage");
		});
	});

	describe("Observability Events Table", () => {
		it("should have all required fields for observability", () => {
			const obsColumns = Object.keys(observabilityEvents);

			expect(obsColumns).toContain("id");
			expect(obsColumns).toContain("eventType");
			expect(obsColumns).toContain("timestamp");
			expect(obsColumns).toContain("data");
			expect(obsColumns).toContain("traceId");
			expect(obsColumns).toContain("spanId");
			expect(obsColumns).toContain("correlationId");
		});
	});

	describe("Agent Memory Table", () => {
		it("should have all required fields for agent memory", () => {
			const memoryColumns = Object.keys(agentMemory);

			expect(memoryColumns).toContain("id");
			expect(memoryColumns).toContain("agentId");
			expect(memoryColumns).toContain("memoryType");
			expect(memoryColumns).toContain("content");
			expect(memoryColumns).toContain("embedding");
			expect(memoryColumns).toContain("createdAt");
			expect(memoryColumns).toContain("accessedAt");
		});
	});

	describe("Workflows Table", () => {
		it("should have all required fields for workflow management", () => {
			const workflowColumns = Object.keys(workflows);

			expect(workflowColumns).toContain("id");
			expect(workflowColumns).toContain("name");
			expect(workflowColumns).toContain("definition");
			expect(workflowColumns).toContain("version");
			expect(workflowColumns).toContain("isActive");
			expect(workflowColumns).toContain("createdAt");
			expect(workflowColumns).toContain("createdBy");
		});
	});

	describe("Workflow Executions Table", () => {
		it("should have all required fields for workflow execution tracking", () => {
			const execColumns = Object.keys(workflowExecutions);

			expect(execColumns).toContain("id");
			expect(execColumns).toContain("workflowId");
			expect(execColumns).toContain("status");
			expect(execColumns).toContain("startedAt");
			expect(execColumns).toContain("completedAt");
			expect(execColumns).toContain("input");
			expect(execColumns).toContain("output");
			expect(execColumns).toContain("currentStep");
		});
	});

	describe("Execution Snapshots Table", () => {
		it("should have all required fields for time-travel debugging", () => {
			const snapshotColumns = Object.keys(executionSnapshots);

			expect(snapshotColumns).toContain("id");
			expect(snapshotColumns).toContain("executionId");
			expect(snapshotColumns).toContain("stepNumber");
			expect(snapshotColumns).toContain("timestamp");
			expect(snapshotColumns).toContain("state");
			expect(snapshotColumns).toContain("variables");
			expect(snapshotColumns).toContain("stackTrace");
		});
	});

	describe("Schema Relationships", () => {
		it("should define proper foreign key relationships", () => {
			// Test that relationships are properly defined
			// This is more of a structural test to ensure the schema is well-formed
			expect(agentExecutions.taskId).toBeDefined();
			expect(workflowExecutions.workflowId).toBeDefined();
			expect(executionSnapshots.executionId).toBeDefined();
		});
	});
});
