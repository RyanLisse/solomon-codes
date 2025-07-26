import { z } from "zod";

// Define proper types for extraction schemas and data
export type ExtractSchema = Record<
	string,
	"string" | "number" | "boolean" | "array" | "object"
>;

// Define possible data types that can be extracted
export type ExtractedData =
	| Record<
			string,
			string | number | boolean | unknown[] | Record<string, unknown>
	  >
	| unknown[]
	| null;

// Define observation result types
export type ObservationData = {
	elements?: Array<{
		tag: string;
		text?: string;
		attributes?: Record<string, string>;
		selector?: string;
	}>;
	links?: Array<{
		href: string;
		text: string;
	}>;
	forms?: Array<{
		action?: string;
		method?: string;
		fields: Array<{
			name: string;
			type: string;
			value?: string;
		}>;
	}>;
} | null;

export const AutomationTaskSchema = z.object({
	url: z.string(),
	instructions: z.string().min(1),
	extractSchema: z
		.record(
			z.string(),
			z.enum(["string", "number", "boolean", "array", "object"]),
		)
		.optional(),
});

export const SessionConfigSchema = z.object({
	headless: z.boolean().default(true),
	viewport: z
		.object({
			width: z.number().default(1280),
			height: z.number().default(720),
		})
		.optional(),
	logger: z.boolean().default(false),
});

export type AutomationTask = z.infer<typeof AutomationTaskSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export interface AutomationResult {
	success: boolean;
	data?: ExtractedData | ObservationData;
	error?: string;
	sessionId?: string;
	logs?: string[];
}
