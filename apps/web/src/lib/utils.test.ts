import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn utility function", () => {
	it("should merge class names correctly", () => {
		const result = cn("bg-red-500", "text-white");
		expect(result).toBe("bg-red-500 text-white");
	});

	it("should handle conditional classes", () => {
		const isActive = true;
		const result = cn("base-class", isActive && "active-class");
		expect(result).toBe("base-class active-class");
	});

	it("should handle undefined and null values", () => {
		const result = cn("base-class", undefined, null, "another-class");
		expect(result).toBe("base-class another-class");
	});

	it("should handle Tailwind merge conflicts", () => {
		const result = cn("p-4", "p-2");
		expect(result).toBe("p-2");
	});

	it("should handle empty input", () => {
		const result = cn();
		expect(result).toBe("");
	});
});
