import winston from "winston";

/**
 * Create a development-friendly console formatter
 */
export function createDevelopmentFormatter() {
	return winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.errors({ stack: true }),
		winston.format.colorize(),
		winston.format.printf(({ timestamp, level, message, ...meta }) => {
			// Remove empty metadata
			const cleanMeta = Object.fromEntries(
				Object.entries(meta).filter(
					([_, value]) => value !== undefined && value !== null,
				),
			);

			const metaStr =
				Object.keys(cleanMeta).length > 0
					? `\n${JSON.stringify(cleanMeta, null, 2)}`
					: "";

			return `${timestamp} [${level}]: ${message}${metaStr}`;
		}),
	);
}

/**
 * Create a production JSON formatter
 */
export function createProductionFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json(),
	);
}

/**
 * Create a structured formatter with correlation ID
 */
export function createStructuredFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const { timestamp, level, message, ...meta } = info;

			// Ensure correlation ID is included
			const structuredLog = {
				timestamp,
				level,
				message,
				...meta,
			};

			return JSON.stringify(structuredLog);
		}),
	);
}

/**
 * Create a formatter that includes performance metrics
 */
export function createPerformanceFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const { timestamp, level, message, duration, ...meta } = info;

			const performanceLog = {
				timestamp,
				level,
				message,
				...(duration ? { performance: { duration } } : {}),
				...(meta && typeof meta === "object" ? meta : {}),
			};

			return JSON.stringify(performanceLog);
		}),
	);
}

/**
 * Create a formatter for API requests
 */
export function createApiFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const {
				timestamp,
				level,
				message,
				method,
				url,
				statusCode,
				responseTime,
				correlationId,
				...meta
			} = info;

			const apiLog = {
				timestamp,
				level,
				message,
				request: {
					method,
					url,
					...(correlationId ? { correlationId } : {}),
				},
				...(statusCode ? { response: { statusCode, responseTime } } : {}),
				...(meta && typeof meta === "object" ? meta : {}),
			};

			return JSON.stringify(apiLog);
		}),
	);
}

/**
 * Create a formatter for database operations
 */
export function createDatabaseFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const {
				timestamp,
				level,
				message,
				query,
				queryType,
				executionTime,
				affectedRows,
				database,
				table,
				...meta
			} = info;

			const dbLog = {
				timestamp,
				level,
				message,
				database: {
					...(database ? { name: database } : {}),
					...(table ? { table } : {}),
					...(query
						? {
								query:
									typeof query === "string"
										? query.substring(0, 1000)
										: String(query).substring(0, 1000),
							}
						: {}), // Truncate long queries
					...(queryType ? { type: queryType } : {}),
					...(executionTime ? { executionTime } : {}),
					...(affectedRows ? { affectedRows } : {}),
				},
				...(meta && typeof meta === "object" ? meta : {}),
			};

			return JSON.stringify(dbLog);
		}),
	);
}

/**
 * Create a formatter for agent operations
 */
export function createAgentFormatter() {
	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const {
				timestamp,
				level,
				message,
				agentType,
				agentId,
				operation,
				provider,
				model,
				tokenUsage,
				confidence,
				reasoning,
				...meta
			} = info;

			const agentLog = {
				timestamp,
				level,
				message,
				agent: {
					...(agentType ? { type: agentType } : {}),
					...(agentId ? { id: agentId } : {}),
					...(operation ? { operation } : {}),
					...(provider ? { provider } : {}),
					...(model ? { model } : {}),
					...(tokenUsage ? { tokenUsage } : {}),
					...(confidence ? { confidence } : {}),
					...(reasoning ? { reasoning } : {}),
				},
				...(meta && typeof meta === "object" ? meta : {}),
			};

			return JSON.stringify(agentLog);
		}),
	);
}

/**
 * Create a custom formatter with metadata filtering
 */
export function createCustomFormatter(options: {
	includeFields?: string[];
	excludeFields?: string[];
	maxMessageLength?: number;
	prettyPrint?: boolean;
}) {
	const {
		includeFields,
		excludeFields = [],
		maxMessageLength = 1000,
		prettyPrint = false,
	} = options;

	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			const { timestamp, level, message, ...meta } = info;

			// Truncate message if too long
			const messageStr =
				typeof message === "string" ? message : String(message);
			const truncatedMessage =
				messageStr.length > maxMessageLength
					? `${messageStr.substring(0, maxMessageLength)}...`
					: messageStr;

			// Filter metadata
			let filteredMeta = meta && typeof meta === "object" ? { ...meta } : {};

			if (includeFields) {
				filteredMeta = Object.fromEntries(
					Object.entries(filteredMeta).filter(([key]) =>
						includeFields.includes(key),
					),
				);
			}

			if (excludeFields.length > 0) {
				filteredMeta = Object.fromEntries(
					Object.entries(filteredMeta).filter(
						([key]) => !excludeFields.includes(key),
					),
				);
			}

			const logEntry = {
				timestamp,
				level,
				message: truncatedMessage,
				...filteredMeta,
			};

			return prettyPrint
				? JSON.stringify(logEntry, null, 2)
				: JSON.stringify(logEntry);
		}),
	);
}

/**
 * Create a security-focused formatter that redacts sensitive information
 */
export function createSecurityFormatter() {
	const sensitiveFields = [
		"password",
		"token",
		"secret",
		"key",
		"authorization",
		"cookie",
		"session",
		"apikey",
		"api_key",
	];

	return winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.printf((info) => {
			// Deep clone to avoid modifying original
			const sanitized = JSON.parse(JSON.stringify(info));

			// Recursively redact sensitive fields
			function redactSensitive(obj: unknown): unknown {
				if (obj === null || typeof obj !== "object") {
					return obj;
				}

				if (Array.isArray(obj)) {
					return obj.map(redactSensitive);
				}

				const result: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(obj)) {
					const lowerKey = key.toLowerCase();
					if (
						sensitiveFields.some((sensitive) => lowerKey.includes(sensitive))
					) {
						result[key] = "[REDACTED]";
					} else {
						result[key] = redactSensitive(value);
					}
				}
				return result;
			}

			const redacted = redactSensitive(sanitized);
			return JSON.stringify(redacted);
		}),
	);
}
