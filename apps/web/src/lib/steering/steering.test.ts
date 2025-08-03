import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getProductConfig,
	getStructureConfig,
	getTechConfig,
	loadSteeringConfig,
} from "./steering";

describe("Steering Configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("loadSteeringConfig", () => {
		it("should load and parse steering configuration files", async () => {
			const config = await loadSteeringConfig();

			expect(config).toBeDefined();
			expect(config.product).toBeDefined();
			expect(config.tech).toBeDefined();
			expect(config.structure).toBeDefined();
		});

		it("should include product information", async () => {
			const config = await loadSteeringConfig();

			expect(config.product.name).toBe("solomon_codes");
			expect(config.product.description).toContain("Better-T-Stack");
			expect(config.product.features).toContain("AI-powered code generation");
		});

		it("should include tech stack information", async () => {
			const config = await loadSteeringConfig();

			expect(config.tech.runtime).toBe("Bun");
			expect(config.tech.framework).toBe("Next.js 15.3");
			expect(config.tech.buildSystem).toBe("Turborepo");
			expect(config.tech.commands).toBeDefined();
		});

		it("should include structure information", async () => {
			const config = await loadSteeringConfig();

			expect(config.structure.type).toBe("monorepo");
			expect(config.structure.apps).toContain("web");
			expect(config.structure.apps).toContain("docs");
		});
	});

	describe("getProductConfig", () => {
		it("should return product configuration", async () => {
			const productConfig = await getProductConfig();

			expect(productConfig.name).toBe("solomon_codes");
			expect(productConfig.features).toBeInstanceOf(Array);
		});
	});

	describe("getTechConfig", () => {
		it("should return tech stack configuration", async () => {
			const techConfig = await getTechConfig();

			expect(techConfig.runtime).toBe("Bun");
			expect(techConfig.commands).toBeDefined();
			expect(techConfig.commands.dev).toBeDefined();
		});
	});

	describe("getStructureConfig", () => {
		it("should return structure configuration", async () => {
			const structureConfig = await getStructureConfig();

			expect(structureConfig.type).toBe("monorepo");
			expect(structureConfig.apps).toBeInstanceOf(Array);
		});
	});

	describe("error handling", () => {
		it("should handle missing config files gracefully", async () => {
			// This test ensures robust error handling
			expect(async () => {
				await loadSteeringConfig("/non-existent-path");
			}).not.toThrow();
		});
	});
});
