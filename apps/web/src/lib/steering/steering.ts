import fs from "node:fs";
import path from "node:path";

export interface ProductConfig {
	name: string;
	description: string;
	features: string[];
	applications: string[];
}

export interface TechConfig {
	runtime: string;
	framework: string;
	buildSystem: string;
	commands: {
		dev: string;
		build: string;
		test: string;
		[key: string]: string;
	};
	stack: {
		frontend: string[];
		backend: string[];
		database: string[];
		testing: string[];
	};
}

export interface StructureConfig {
	type: string;
	apps: string[];
	directories: {
		[key: string]: string;
	};
	conventions: {
		files: string;
		components: string;
		directories: string;
	};
}

export interface SteeringConfig {
	product: ProductConfig;
	tech: TechConfig;
	structure: StructureConfig;
}

const STEERING_PATH = path.join(process.cwd(), ".kiro", "steering");

function extractFeatures(lines: string[]): string[] {
	const features: string[] = [];
	let inFeatures = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "## Core Features") {
			inFeatures = true;
			continue;
		}
		if (trimmed.startsWith("##") && !trimmed.includes("Core Features")) {
			inFeatures = false;
		}
		if (inFeatures && trimmed.startsWith("- ")) {
			features.push(trimmed.substring(2));
		}
	}
	return features;
}

function extractApplications(lines: string[]): string[] {
	const applications: string[] = [];
	let inApplications = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "## Key Applications") {
			inApplications = true;
			continue;
		}
		if (trimmed.startsWith("##") && !trimmed.includes("Key Applications")) {
			inApplications = false;
		}
		if (inApplications && trimmed.startsWith("- ")) {
			applications.push(trimmed.substring(2));
		}
	}
	return applications;
}

function parseProductConfig(lines: string[]): ProductConfig {
	const name = "solomon_codes";
	let description = "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("**solomon_codes**")) {
			description = trimmed;
			break;
		}
	}

	const features = extractFeatures(lines);
	const applications = extractApplications(lines);

	return { name, description, features, applications };
}

function extractTechInfo(lines: string[]): {
	runtime: string;
	framework: string;
	buildSystem: string;
} {
	const defaults = {
		runtime: "Bun",
		framework: "Next.js 15.3",
		buildSystem: "Turborepo",
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.includes("**Bun**") && !trimmed.includes("Package manager")) {
			defaults.runtime = "Bun";
		}
		if (trimmed.includes("**Next.js") && trimmed.includes("**")) {
			const regex = /\*\*Next\.js[^*]*\*\*/;
			const match = regex.exec(trimmed);
			if (match) {
				defaults.framework = match[0].replace(/\*\*/g, "");
			}
		}
		if (
			trimmed.includes("**Turborepo**") &&
			!trimmed.includes("build system")
		) {
			defaults.buildSystem = "Turborepo";
		}
	}

	return defaults;
}

function extractCommands(lines: string[]): {
	dev: string;
	build: string;
	test: string;
	[key: string]: string;
} {
	const commands: { [key: string]: string } = {};
	let inCommands = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (
			trimmed.startsWith("### Development") ||
			trimmed.startsWith("### Building")
		) {
			inCommands = true;
			continue;
		}
		if (trimmed.startsWith("##") && !trimmed.includes("Commands")) {
			inCommands = false;
		}
		if (inCommands && trimmed.startsWith("bun ")) {
			const regex = /bun (\w+)/;
			const commandMatch = regex.exec(trimmed);
			if (commandMatch) {
				commands[commandMatch[1]] = trimmed;
			}
		}
	}

	// Set defaults
	if (!commands.dev) commands.dev = "bun dev";
	if (!commands.build) commands.build = "bun build";
	if (!commands.test) commands.test = "bun test";

	return commands as {
		dev: string;
		build: string;
		test: string;
		[key: string]: string;
	};
}

function parseTechConfig(lines: string[]): TechConfig {
	const { runtime, framework, buildSystem } = extractTechInfo(lines);
	const commands = extractCommands(lines);
	const stack = {
		frontend: [] as string[],
		backend: [] as string[],
		database: [] as string[],
		testing: [] as string[],
	};

	// Simple stack parsing
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.includes("**React**") || trimmed.includes("**Next.js**")) {
			const tech = trimmed.split("**")[1];
			if (tech && !stack.frontend.includes(tech)) {
				stack.frontend.push(tech);
			}
		}
		if (
			trimmed.includes("**Vitest**") ||
			trimmed.includes("**Testing Library**")
		) {
			const tech = trimmed.split("**")[1];
			if (tech && !stack.testing.includes(tech)) {
				stack.testing.push(tech);
			}
		}
	}

	return { runtime, framework, buildSystem, commands, stack };
}

function parseStructureConfig(lines: string[]): StructureConfig {
	const apps: string[] = [];
	const directories: { [key: string]: string } = {};
	const conventions = {
		files: "kebab-case",
		components: "PascalCase",
		directories: "kebab-case",
	};

	const type = "monorepo";

	for (const line of lines) {
		const trimmed = line.trim();

		if (
			(trimmed.includes("├── web/") || trimmed.includes("web application")) &&
			!apps.includes("web")
		) {
			apps.push("web");
		}
		if (
			(trimmed.includes("├── docs/") ||
				trimmed.includes("documentation site")) &&
			!apps.includes("docs")
		) {
			apps.push("docs");
		}

		// Parse directory structure
		if (trimmed.includes("├── ") || trimmed.includes("└── ")) {
			const dirMatch = trimmed.match(/[├└]── (\w+)\//);
			if (dirMatch) {
				directories[dirMatch[1]] = trimmed;
			}
		}
	}

	return { type, apps, directories, conventions };
}

function parseMarkdownConfig(
	content: string,
	type: "product" | "tech" | "structure",
): ProductConfig | TechConfig | StructureConfig {
	const lines = content.split("\n");

	switch (type) {
		case "product":
			return parseProductConfig(lines);
		case "tech":
			return parseTechConfig(lines);
		case "structure":
			return parseStructureConfig(lines);
		default:
			throw new Error(`Unknown config type: ${type}`);
	}
}

function getDefaultConfig(): SteeringConfig {
	return {
		product: {
			name: "solomon_codes",
			description: "Modern web application built with the Better-T-Stack",
			features: ["AI-powered code generation"],
			applications: ["Web App", "Docs"],
		},
		tech: {
			runtime: "Bun",
			framework: "Next.js 15.3",
			buildSystem: "Turborepo",
			commands: {
				dev: "bun dev",
				build: "bun build",
				test: "bun test",
			},
			stack: {
				frontend: ["React", "Next.js"],
				backend: ["Node.js"],
				database: ["PostgreSQL"],
				testing: ["Vitest"],
			},
		},
		structure: {
			type: "monorepo",
			apps: ["web", "docs"],
			directories: {},
			conventions: {
				files: "kebab-case",
				components: "PascalCase",
				directories: "kebab-case",
			},
		},
	};
}

export async function loadSteeringConfig(
	customPath?: string,
): Promise<SteeringConfig> {
	const basePath = customPath || STEERING_PATH;

	try {
		const productPath = path.join(basePath, "product.md");
		const techPath = path.join(basePath, "tech.md");
		const structurePath = path.join(basePath, "structure.md");

		const [productContent, techContent, structureContent] = await Promise.all([
			fs.promises.readFile(productPath, "utf-8").catch(() => ""),
			fs.promises.readFile(techPath, "utf-8").catch(() => ""),
			fs.promises.readFile(structurePath, "utf-8").catch(() => ""),
		]);

		const product = parseMarkdownConfig(
			productContent,
			"product",
		) as ProductConfig;
		const tech = parseMarkdownConfig(techContent, "tech") as TechConfig;
		const structure = parseMarkdownConfig(
			structureContent,
			"structure",
		) as StructureConfig;

		return { product, tech, structure };
	} catch (_error) {
		return getDefaultConfig();
	}
}

export async function getProductConfig(
	customPath?: string,
): Promise<ProductConfig> {
	const config = await loadSteeringConfig(customPath);
	return config.product;
}

export async function getTechConfig(customPath?: string): Promise<TechConfig> {
	const config = await loadSteeringConfig(customPath);
	return config.tech;
}

export async function getStructureConfig(
	customPath?: string,
): Promise<StructureConfig> {
	const config = await loadSteeringConfig(customPath);
	return config.structure;
}
