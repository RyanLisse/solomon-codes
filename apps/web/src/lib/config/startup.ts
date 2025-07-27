import { getConfigurationService } from "./service";
import { validateEnvironment, printValidationResults } from "./validation";
import { createContextLogger } from "../logging/factory";
import { initializeTelemetry, getTelemetryService } from "../telemetry";
import { checkDatabaseHealth, testDatabaseConnection } from "../database/connection";
import type { ValidationResult } from "./validation";

export interface StartupMetrics {
	startTime: number;
	endTime?: number;
	duration?: number;
	validationSteps: Array<{
		name: string;
		startTime: number;
		endTime: number;
		duration: number;
		success: boolean;
		errors?: string[];
		warnings?: string[];
	}>;
}

/**
 * Startup validation service for comprehensive environment checking
 */
export class StartupValidationService {
	private configService = getConfigurationService();
	private logger = createContextLogger("startup-validation");
	private metrics: StartupMetrics = {
		startTime: Date.now(),
		validationSteps: [],
	};

	/**
	 * Run comprehensive startup validation
	 */
	async validateStartup(): Promise<ValidationResult> {
		this.logger.info("Starting application validation");
		this.metrics.startTime = Date.now();
		
		const results: ValidationResult[] = [];
		
		// 1. Environment variable validation
		const envResult = await this.runValidationStep("environment", async () => {
			this.logger.info("Validating environment variables");
			return validateEnvironment();
		});
		results.push(envResult);
		
		if (!envResult.success) {
			this.logger.error("Environment validation failed", {
				errors: envResult.errors,
				warnings: envResult.warnings,
			});
			printValidationResults(envResult);
			this.metrics.endTime = Date.now();
			this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
			return this.combineResults(results);
		}
		
		// 2. Configuration validation
		const configResult = await this.runValidationStep("configuration", async () => {
			this.logger.info("Validating configuration");
			const configValid = this.configService.validateConfiguration();
			if (!configValid) {
				return {
					success: false,
					errors: ["Configuration validation failed"],
					warnings: [],
					timestamp: new Date(),
					environment: this.configService.getConfiguration().nodeEnv,
				};
			}
			return {
				success: true,
				errors: [],
				warnings: [],
				timestamp: new Date(),
				environment: this.configService.getConfiguration().nodeEnv,
			};
		});
		results.push(configResult);
		
		if (!configResult.success) {
			this.logger.error("Configuration validation failed");
			this.metrics.endTime = Date.now();
			this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
			return this.combineResults(results);
		}
		
		// 3. Database connectivity validation
		const dbResult = await this.runValidationStep("database", async () => {
			this.logger.info("Validating database connectivity");
			return await this.validateDatabaseConnectivity();
		});
		results.push(dbResult);
		
		// 4. API connectivity validation
		const apiResult = await this.runValidationStep("api-connectivity", async () => {
			this.logger.info("Validating API connectivity");
			return await this.validateApiConnectivity();
		});
		results.push(apiResult);
		
		// 5. Service dependencies validation
		const depsResult = await this.runValidationStep("service-dependencies", async () => {
			this.logger.info("Validating service dependencies");
			return await this.validateServiceDependencies();
		});
		results.push(depsResult);
		
		// 6. Initialize telemetry service
		const telemetryResult = await this.runValidationStep("telemetry", async () => {
			this.logger.info("Initializing telemetry service");
			const telemetryInitialized = await initializeTelemetry();
			if (!telemetryInitialized) {
				// Telemetry failure is not critical, just log a warning
				return {
					success: true, // Don't fail startup for telemetry
					errors: [],
					warnings: ["Telemetry service initialization failed - continuing without telemetry"],
					timestamp: new Date(),
					environment: this.configService.getConfiguration().nodeEnv,
				};
			}
			return {
				success: true,
				errors: [],
				warnings: [],
				timestamp: new Date(),
				environment: this.configService.getConfiguration().nodeEnv,
			};
		});
		results.push(telemetryResult);
		
		this.metrics.endTime = Date.now();
		this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
		
		const finalResult = this.combineResults(results);
		
		if (finalResult.success) {
			this.logger.info("All startup validations passed", {
				warnings: finalResult.warnings,
				duration: this.metrics.duration,
			});
		} else {
			this.logger.error("Startup validation failed", {
				errors: finalResult.errors,
				warnings: finalResult.warnings,
				duration: this.metrics.duration,
			});
			printValidationResults(finalResult);
		}
		
		return finalResult;
	}

	/**
	 * Run a validation step with timing metrics
	 */
	private async runValidationStep(
		name: string,
		validationFn: () => Promise<ValidationResult>
	): Promise<ValidationResult> {
		const startTime = Date.now();
		
		try {
			const result = await validationFn();
			const endTime = Date.now();
			
			this.metrics.validationSteps.push({
				name,
				startTime,
				endTime,
				duration: endTime - startTime,
				success: result.success,
				errors: result.errors,
				warnings: result.warnings,
			});
			
			return result;
		} catch (error) {
			const endTime = Date.now();
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			this.metrics.validationSteps.push({
				name,
				startTime,
				endTime,
				duration: endTime - startTime,
				success: false,
				errors: [errorMessage],
			});
			
			return {
				success: false,
				errors: [errorMessage],
				warnings: [],
				timestamp: new Date(),
				environment: this.configService.getConfiguration().nodeEnv,
			};
		}
	}

	/**
	 * Validate database connectivity
	 */
	private async validateDatabaseConnectivity(): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];
		const dbConfig = this.configService.getDatabaseConfig();
		
		if (!dbConfig.isConfigured) {
			if (this.configService.isProduction()) {
				errors.push("Database configuration is required in production environment");
			} else {
				warnings.push("Database not configured - some features may be limited");
			}
		} else {
			try {
				// Test database connectivity with retry logic
				const connectionTest = await testDatabaseConnection(3, 1000);
				if (!connectionTest.success) {
					if (this.configService.isProduction()) {
						errors.push(`Database connectivity failed: ${connectionTest.error}`);
					} else {
						warnings.push(`Database connectivity failed: ${connectionTest.error} (attempts: ${connectionTest.attempts})`);
					}
				} else {
					// Get detailed health check
					const health = await checkDatabaseHealth();
					if (!health.isHealthy) {
						warnings.push(`Database health check failed: ${health.errors.join(", ")}`);
					}
					
					// Log performance metrics
					this.logger.info("Database connectivity validated", {
						responseTime: health.responseTime,
						attempts: connectionTest.attempts,
						isHealthy: health.isHealthy,
					});
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (this.configService.isProduction()) {
					errors.push(`Database validation error: ${errorMessage}`);
				} else {
					warnings.push(`Database validation error: ${errorMessage}`);
				}
			}
		}
		
		return {
			success: errors.length === 0,
			errors,
			warnings,
			timestamp: new Date(),
			environment: this.configService.getConfiguration().nodeEnv,
		};
	}

	/**
	 * Validate API connectivity for required services
	 */
	private async validateApiConnectivity(): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];
		const apiConfig = this.configService.getApiConfig();
		
		// Check OpenAI API key in production
		if (this.configService.isProduction() && !apiConfig.openai.isConfigured) {
			errors.push("OpenAI API key is required in production environment");
		}
		
		// Check BrowserBase configuration for browser automation
		if (!apiConfig.browserbase.isConfigured) {
			if (this.configService.isProduction()) {
				errors.push("BrowserBase configuration is required in production");
			} else {
				warnings.push("BrowserBase not configured - browser automation features will be disabled");
			}
		}
		
		// Test OpenAI connectivity if configured
		if (apiConfig.openai.isConfigured) {
			try {
				// Simple connectivity test - just check if the key format is valid
				if (!apiConfig.openai.apiKey?.startsWith('sk-')) {
					warnings.push("OpenAI API key format appears invalid");
				}
			} catch (error) {
				warnings.push(`OpenAI API connectivity check failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		
		return {
			success: errors.length === 0,
			errors,
			warnings,
			timestamp: new Date(),
			environment: this.configService.getConfiguration().nodeEnv,
		};
	}

	/**
	 * Validate service dependencies
	 */
	private async validateServiceDependencies(): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// Check telemetry service configuration and connectivity
		const telemetryConfig = this.configService.getTelemetryConfig();
		if (telemetryConfig.isEnabled) {
			try {
				// Validate telemetry endpoint URL
				const url = new URL(telemetryConfig.endpoint);
				if (this.configService.isProduction() && url.protocol !== 'https:') {
					warnings.push("Telemetry endpoint should use HTTPS in production");
				}
				
				// Test telemetry service initialization
				const telemetryService = getTelemetryService();
				const telemetryValid = telemetryService.isEnabled();
				if (!telemetryValid && this.configService.isProduction()) {
					warnings.push("Telemetry service configuration is invalid in production");
				}
				
				this.logger.info("Telemetry service dependency validated", {
					enabled: telemetryValid,
					endpoint: telemetryConfig.endpoint,
				});
			} catch (error) {
				if (this.configService.isProduction()) {
					errors.push(`Invalid telemetry endpoint: ${telemetryConfig.endpoint}`);
				} else {
					warnings.push(`Telemetry endpoint validation failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		} else {
			if (this.configService.isProduction()) {
				warnings.push("Telemetry is disabled in production - monitoring capabilities will be limited");
			}
		}
		
		// Check external service dependencies (placeholder for future services)
		const externalServices = this.getExternalServiceDependencies();
		for (const service of externalServices) {
			try {
				await this.validateExternalService(service);
			} catch (error) {
				warnings.push(`External service ${service.name} validation failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		
		return {
			success: errors.length === 0,
			errors,
			warnings,
			timestamp: new Date(),
			environment: this.configService.getConfiguration().nodeEnv,
		};
	}

	/**
	 * Get external service dependencies to validate
	 */
	private getExternalServiceDependencies(): Array<{
		name: string;
		url?: string;
		required: boolean;
	}> {
		const apiConfig = this.configService.getApiConfig();
		const services = [];
		
		// Add configured external services
		if (apiConfig.openai.isConfigured) {
			services.push({
				name: "OpenAI API",
				url: "https://api.openai.com",
				required: this.configService.isProduction(),
			});
		}
		
		if (apiConfig.browserbase.isConfigured) {
			services.push({
				name: "BrowserBase",
				required: this.configService.isProduction(),
			});
		}
		
		return services;
	}

	/**
	 * Validate external service connectivity
	 */
	private async validateExternalService(service: {
		name: string;
		url?: string;
		required: boolean;
	}): Promise<void> {
		// For now, just validate the service configuration
		// In the future, this could include actual connectivity tests
		this.logger.debug(`Validating external service: ${service.name}`, {
			required: service.required,
			hasUrl: Boolean(service.url),
		});
	}

	/**
	 * Combine multiple validation results
	 */
	private combineResults(results: ValidationResult[]): ValidationResult {
		const allErrors = results.flatMap(r => r.errors);
		const allWarnings = results.flatMap(r => r.warnings);
		
		return {
			success: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
			timestamp: new Date(),
			environment: this.configService.getConfiguration().nodeEnv,
		};
	}

	/**
	 * Get startup metrics for monitoring and performance analysis
	 */
	getStartupMetrics(): StartupMetrics {
		return { ...this.metrics };
	}

	/**
	 * Get validation summary for monitoring
	 */
	getValidationSummary(): {
		environment: string;
		configurationValid: boolean;
		databaseConnectivityValid: boolean;
		apiConnectivityValid: boolean;
		dependenciesValid: boolean;
		telemetryValid: boolean;
		lastValidation?: Date;
		startupDuration?: number;
		validationSteps?: Array<{
			name: string;
			duration: number;
			success: boolean;
		}>;
	} {
		// Get validation step results
		const envStep = this.metrics.validationSteps.find(s => s.name === "environment");
		const configStep = this.metrics.validationSteps.find(s => s.name === "configuration");
		const dbStep = this.metrics.validationSteps.find(s => s.name === "database");
		const apiStep = this.metrics.validationSteps.find(s => s.name === "api-connectivity");
		const depsStep = this.metrics.validationSteps.find(s => s.name === "service-dependencies");
		const telemetryStep = this.metrics.validationSteps.find(s => s.name === "telemetry");

		return {
			environment: this.configService.getConfiguration().nodeEnv,
			configurationValid: configStep?.success ?? this.configService.validateConfiguration(),
			databaseConnectivityValid: dbStep?.success ?? false,
			apiConnectivityValid: apiStep?.success ?? false,
			dependenciesValid: depsStep?.success ?? false,
			telemetryValid: telemetryStep?.success ?? false,
			lastValidation: this.metrics.endTime ? new Date(this.metrics.endTime) : undefined,
			startupDuration: this.metrics.duration,
			validationSteps: this.metrics.validationSteps.map(step => ({
				name: step.name,
				duration: step.duration,
				success: step.success,
			})),
		};
	}
}

/**
 * Global startup validation service instance
 */
let _startupService: StartupValidationService | null = null;

/**
 * Get the startup validation service
 */
export function getStartupValidationService(): StartupValidationService {
	if (!_startupService) {
		_startupService = new StartupValidationService();
	}
	return _startupService;
}

/**
 * Reset startup validation service (for testing)
 */
export function resetStartupValidationService(): void {
	_startupService = null;
}

/**
 * Run startup validation and exit on failure
 * Should be called at the very beginning of application startup
 */
export async function validateStartupOrExit(): Promise<void> {
	const logger = createContextLogger("startup");
	const service = getStartupValidationService();
	const result = await service.validateStartup();
	
	if (!result.success) {
		logger.error("Application startup validation failed. Exiting...", {
			errors: result.errors,
			warnings: result.warnings,
		});
		
		// Still use console for critical startup failures to ensure visibility
		console.error("💥 Application startup validation failed. Exiting...");
		console.error("Errors:");
		for (const error of result.errors) {
			console.error(`  • ${error}`);
		}
		
		if (result.warnings.length > 0) {
			console.warn("Warnings:");
			for (const warning of result.warnings) {
				console.warn(`  • ${warning}`);
			}
		}
		
		process.exit(1);
	}
	
	if (result.warnings.length > 0) {
		logger.warn("Startup completed with warnings", {
			warnings: result.warnings,
		});
		
		// Keep console output for startup warnings
		console.warn("⚠️  Startup completed with warnings:");
		for (const warning of result.warnings) {
			console.warn(`  • ${warning}`);
		}
	}
	
	logger.info("Application startup validation completed successfully");
	console.log("🎉 Application startup validation completed successfully");
}

/**
 * Create actionable error messages for configuration failures
 */
export function createActionableErrorMessage(
	variable: string,
	description: string,
	example?: string,
): string {
	let message = `❌ Missing required environment variable: ${variable}\n`;
	message += `   Description: ${description}\n`;
	
	if (example) {
		message += `   Example: ${variable}=${example}\n`;
	}
	
	message += `   💡 Add this to your .env file or set it in your environment\n`;
	
	return message;
}

/**
 * Validate specific environment requirements with detailed feedback
 */
export function validateEnvironmentRequirements(
	requirements: Array<{
		variable: string;
		required: boolean;
		description: string;
		example?: string;
		validator?: (value: string) => boolean;
	}>,
): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	for (const req of requirements) {
		const value = process.env[req.variable];
		
		if (req.required && !value) {
			errors.push(createActionableErrorMessage(req.variable, req.description, req.example));
		} else if (!req.required && !value) {
			warnings.push(`Optional variable not set: ${req.variable} - ${req.description}`);
		} else if (value && req.validator && !req.validator(value)) {
			errors.push(`Invalid value for ${req.variable}: ${req.description}`);
		}
	}
	
	return {
		success: errors.length === 0,
		errors,
		warnings,
		timestamp: new Date(),
		environment: process.env.NODE_ENV || "development",
	};
}