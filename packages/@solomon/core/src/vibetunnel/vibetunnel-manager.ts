import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "events";
import * as QRCode from "qrcode";

// VibeTunnel configuration types
export interface VibeTunnelConfig {
	enabled: boolean;
	authToken?: string;
	subdomain?: string;
	password?: string;
	httpsOnly?: boolean;
	ipWhitelist?: string[];
	services?: ServiceConfig[];
}

export interface ServiceConfig {
	name: string;
	port: number;
	subdomain?: string;
	path?: string;
	enabled?: boolean;
}

export interface TunnelResult {
	service: string;
	url: string;
	status: "connecting" | "active" | "failed" | "disconnected";
	error?: string;
	qrCode?: string;
}

export interface TunnelStatus extends TunnelResult {
	uptime?: number;
	lastError?: string;
	metrics?: {
		requests: number;
		bytesTransferred: number;
	};
}

// VibeTunnel Manager implementation
export class VibeTunnelManager extends EventEmitter {
	private config: VibeTunnelConfig;
	private tunnels: Map<string, ChildProcess> = new Map();
	private tunnelStatus: Map<string, TunnelStatus> = new Map();
	private startTime: Map<string, number> = new Map();

	constructor(config: VibeTunnelConfig) {
		super();
		this.config = config;
	}

	// Start tunnels for configured services
	async start(services?: ServiceConfig[]): Promise<TunnelResult[]> {
		if (!this.config.enabled) {
			console.log("VibeTunnel is disabled");
			return [];
		}

		const servicesToStart = services || this.config.services || [];
		const results: TunnelResult[] = [];

		for (const service of servicesToStart) {
			if (service.enabled !== false) {
				const result = await this.startTunnel(service);
				results.push(result);
			}
		}

		return results;
	}

	// Start a single tunnel
	private async startTunnel(service: ServiceConfig): Promise<TunnelResult> {
		const tunnelId = `${service.name}_${service.port}`;

		try {
			// Build VibeTunnel command
			const args = this.buildTunnelArgs(service);

			// Spawn VibeTunnel process
			const tunnel = spawn("vibetunnel", args, {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, VIBETUNNEL_TOKEN: this.config.authToken },
			});

			this.tunnels.set(tunnelId, tunnel);
			this.startTime.set(tunnelId, Date.now());

			// Handle tunnel output
			const result = await this.handleTunnelOutput(tunnel, service);

			// Generate QR code for mobile access
			if (result.status === "active") {
				result.qrCode = await this.generateQRCode(result.url);
			}

			// Update status
			this.tunnelStatus.set(tunnelId, {
				...result,
				uptime: 0,
				metrics: { requests: 0, bytesTransferred: 0 },
			});

			this.emit("tunnel:started", result);
			return result;
		} catch (error) {
			const errorResult: TunnelResult = {
				service: service.name,
				url: "",
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};

			this.tunnelStatus.set(tunnelId, {
				...errorResult,
				lastError: errorResult.error,
			});

			this.emit("tunnel:failed", errorResult);
			return errorResult;
		}
	}

	// Build command line arguments for VibeTunnel
	private buildTunnelArgs(service: ServiceConfig): string[] {
		const args: string[] = ["http", `localhost:${service.port}`];

		if (service.subdomain || this.config.subdomain) {
			args.push(
				"--subdomain",
				service.subdomain || `${this.config.subdomain}-${service.name}`,
			);
		}

		if (this.config.password) {
			args.push("--auth", `user:${this.config.password}`);
		}

		if (this.config.httpsOnly) {
			args.push("--https-only");
		}

		if (this.config.ipWhitelist && this.config.ipWhitelist.length > 0) {
			args.push("--ip-whitelist", this.config.ipWhitelist.join(","));
		}

		return args;
	}

	// Handle tunnel process output
	private async handleTunnelOutput(
		tunnel: ChildProcess,
		service: ServiceConfig,
	): Promise<TunnelResult> {
		return new Promise((resolve, reject) => {
			let url = "";
			let resolved = false;
			const timeout = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					reject(new Error("Tunnel connection timeout"));
				}
			}, 30000);

			tunnel.stdout?.on("data", (data) => {
				const output = data.toString();

				// Parse VibeTunnel output for URL
				const urlMatch = output.match(/https?:\/\/[^\s]+/);
				if (urlMatch && !resolved) {
					url = urlMatch[0];
					resolved = true;
					clearTimeout(timeout);
					resolve({
						service: service.name,
						url,
						status: "active",
					});
				}

				// Log tunnel output
				console.log(`[${service.name}] ${output}`);
			});

			tunnel.stderr?.on("data", (data) => {
				const error = data.toString();
				console.error(`[${service.name}] Error: ${error}`);

				if (!resolved) {
					resolved = true;
					clearTimeout(timeout);
					reject(new Error(error));
				}
			});

			tunnel.on("close", (code) => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeout);
					reject(new Error(`Tunnel process exited with code ${code}`));
				}
			});
		});
	}

	// Stop all tunnels
	async stop(): Promise<void> {
		const promises: Promise<void>[] = [];

		for (const [tunnelId, tunnel] of this.tunnels) {
			promises.push(this.stopTunnel(tunnelId, tunnel));
		}

		await Promise.all(promises);
		this.tunnels.clear();
		this.tunnelStatus.clear();
		this.startTime.clear();
	}

	// Stop a single tunnel
	private async stopTunnel(
		tunnelId: string,
		tunnel: ChildProcess,
	): Promise<void> {
		return new Promise((resolve) => {
			tunnel.on("close", () => {
				this.emit("tunnel:stopped", tunnelId);
				resolve();
			});

			tunnel.kill("SIGTERM");

			// Force kill after timeout
			setTimeout(() => {
				if (tunnel.killed === false) {
					tunnel.kill("SIGKILL");
				}
				resolve();
			}, 5000);
		});
	}

	// Get current tunnel status
	getStatus(): TunnelStatus[] {
		const statuses: TunnelStatus[] = [];

		for (const [tunnelId, status] of this.tunnelStatus) {
			const startTime = this.startTime.get(tunnelId);
			if (startTime) {
				status.uptime = Date.now() - startTime;
			}
			statuses.push(status);
		}

		return statuses;
	}

	// Generate QR code for URL
	private async generateQRCode(url: string): Promise<string> {
		try {
			return await QRCode.toDataURL(url, {
				width: 256,
				margin: 2,
				color: {
					dark: "#000000",
					light: "#FFFFFF",
				},
			});
		} catch (error) {
			console.error("Failed to generate QR code:", error);
			return "";
		}
	}

	// Display tunnel status in console
	displayStatus(): void {
		const statuses = this.getStatus();

		console.log("\n🌐 VibeTunnel Status:");
		console.log("═══════════════════════════════════════════════════════");

		for (const status of statuses) {
			const statusIcon = status.status === "active" ? "✅" : "❌";
			console.log(`\n${statusIcon} ${status.service}`);
			console.log(`   URL: ${status.url || "Not available"}`);
			console.log(`   Status: ${status.status}`);

			if (status.uptime) {
				const uptimeMinutes = Math.floor(status.uptime / 60000);
				console.log(`   Uptime: ${uptimeMinutes} minutes`);
			}

			if (status.error) {
				console.log(`   Error: ${status.error}`);
			}
		}

		console.log("═══════════════════════════════════════════════════════\n");
	}

	// Register status change callback
	onStatusChange(callback: (status: TunnelStatus[]) => void): void {
		this.on("tunnel:started", () => callback(this.getStatus()));
		this.on("tunnel:stopped", () => callback(this.getStatus()));
		this.on("tunnel:failed", () => callback(this.getStatus()));
	}
}

// Load configuration from environment variables
export function loadVibeTunnelConfig(): VibeTunnelConfig {
	return {
		enabled: process.env.VIBETUNNEL_ENABLED === "true",
		authToken: process.env.VIBETUNNEL_AUTH_TOKEN,
		subdomain: process.env.VIBETUNNEL_SUBDOMAIN,
		password: process.env.VIBETUNNEL_PASSWORD,
		httpsOnly: process.env.VIBETUNNEL_HTTPS_ONLY === "true",
		ipWhitelist:
			process.env.VIBETUNNEL_IP_WHITELIST?.split(",").filter(Boolean),
		services: [
			{
				name: "web",
				port: 3001,
				enabled: true,
			},
			{
				name: "docs",
				port: 4321,
				enabled: process.env.VIBETUNNEL_DOCS_ENABLED === "true",
			},
		],
	};
}

// Factory function
export function createVibeTunnelManager(
	config?: VibeTunnelConfig,
): VibeTunnelManager {
	const finalConfig = config || loadVibeTunnelConfig();
	return new VibeTunnelManager(finalConfig);
}
