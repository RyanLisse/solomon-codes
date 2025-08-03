/**
 * Mock Server for External API Dependencies
 *
 * London School TDD Mock Server
 * - Provides controlled responses for Claude OAuth and OpenAI API
 * - Enables contract-driven testing with predictable behavior
 * - Supports interaction verification through request logging
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3002;

// Mock state management
let mockState = {
	claudeOAuthCalls: [],
	openaiValidationCalls: [],
	claudeTokens: new Map(),
	validOpenAIKeys: new Set(["sk-test-valid-key-123456789"]),
};

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
	console.log(
		`[MOCK] ${req.method} ${req.path}`,
		req.body ? JSON.stringify(req.body) : "",
	);
	next();
});

/**
 * Claude OAuth Mock Endpoints
 * Simulates the Claude OAuth flow with PKCE
 */

// Mock Claude OAuth authorization endpoint
app.get("/oauth2/authorize", (req, res) => {
	const { client_id, redirect_uri, state, code_challenge } = req.query;

	mockState.claudeOAuthCalls.push({
		type: "authorize",
		timestamp: Date.now(),
		params: { client_id, redirect_uri, state, code_challenge },
	});

	// Simulate OAuth authorization page
	// In real tests, Playwright will interact with this page
	res.send(`
    <html>
      <body>
        <h1>Mock Claude Authorization</h1>
        <p>Authorize access to your Claude account?</p>
        <button onclick="approve()">Approve</button>
        <button onclick="deny()">Deny</button>
        <script>
          function approve() {
            window.location.href = '${redirect_uri}?code=mock-auth-code-123&state=${state}';
          }
          function deny() {
            window.location.href = '${redirect_uri}?error=access_denied&state=${state}';
          }
        </script>
      </body>
    </html>
  `);
});

// Mock Claude token exchange endpoint
app.post("/oauth2/token", (req, res) => {
	const { code } = req.body;

	mockState.claudeOAuthCalls.push({
		type: "token",
		timestamp: Date.now(),
		body: req.body,
	});

	if (code === "mock-auth-code-123") {
		const mockTokenData = {
			access_token: `mock-claude-access-token-${Date.now()}`,
			refresh_token: `mock-claude-refresh-token-${Date.now()}`,
			expires_in: 3600,
			token_type: "Bearer",
			scope: "read write",
		};

		// Store token for later verification
		mockState.claudeTokens.set(mockTokenData.access_token, {
			...mockTokenData,
			created_at: Date.now(),
			user_id: "mock-claude-user-123",
		});

		res.json(mockTokenData);
	} else {
		res.status(400).json({
			error: "invalid_grant",
			error_description: "Invalid authorization code",
		});
	}
});

// Mock Claude user info endpoint
app.get("/v1/me", (req, res) => {
	const authHeader = req.headers.authorization;
	const token = authHeader?.replace("Bearer ", "");

	const tokenData = mockState.claudeTokens.get(token);
	if (tokenData) {
		res.json({
			id: tokenData.user_id,
			email: "test-user@example.com",
			name: "Test User",
			subscription: "pro",
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		});
	} else {
		res.status(401).json({
			error: "unauthorized",
			message: "Invalid or expired token",
		});
	}
});

/**
 * OpenAI API Mock Endpoints
 * Simulates OpenAI API validation
 */

// Mock OpenAI models endpoint (used for validation)
app.get("/v1/models", (req, res) => {
	const authHeader = req.headers.authorization;
	const apiKey = authHeader?.replace("Bearer ", "");

	mockState.openaiValidationCalls.push({
		type: "validate",
		timestamp: Date.now(),
		apiKey: `${apiKey?.substring(0, 10)}...`,
		headers: req.headers,
	});

	if (mockState.validOpenAIKeys.has(apiKey)) {
		res.json({
			object: "list",
			data: [
				{
					id: "gpt-4",
					object: "model",
					created: 1687882411,
					owned_by: "openai",
				},
				{
					id: "gpt-3.5-turbo",
					object: "model",
					created: 1677610602,
					owned_by: "openai",
				},
			],
		});
	} else if (!apiKey?.startsWith("sk-")) {
		res.status(401).json({
			error: {
				message: "Invalid API key provided.",
				type: "invalid_request_error",
				param: null,
				code: "invalid_api_key",
			},
		});
	} else {
		res.status(401).json({
			error: {
				message: "Incorrect API key provided.",
				type: "invalid_request_error",
				param: null,
				code: "invalid_api_key",
			},
		});
	}
});

/**
 * Test Control Endpoints
 * Allow tests to control mock behavior and verify interactions
 */

// Reset mock state
app.post("/test/reset", (_req, res) => {
	mockState = {
		claudeOAuthCalls: [],
		openaiValidationCalls: [],
		claudeTokens: new Map(),
		validOpenAIKeys: new Set(["sk-test-valid-key-123456789"]),
	};
	res.json({ success: true });
});

// Get interaction logs
app.get("/test/interactions", (_req, res) => {
	res.json({
		claudeOAuth: mockState.claudeOAuthCalls,
		openaiValidation: mockState.openaiValidationCalls,
		tokensIssued: mockState.claudeTokens.size,
	});
});

// Add valid OpenAI key for testing
app.post("/test/openai/add-valid-key", (req, res) => {
	const { key } = req.body;
	mockState.validOpenAIKeys.add(key);
	res.json({ success: true, validKeys: mockState.validOpenAIKeys.size });
});

// Health check
app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		endpoints: {
			claude: "/oauth2/authorize, /oauth2/token, /v1/me",
			openai: "/v1/models",
			test: "/test/reset, /test/interactions",
		},
	});
});

app.listen(PORT, () => {
	console.log(`Mock server running on http://localhost:${PORT}`);
	console.log("Available endpoints:");
	console.log("  Claude OAuth: /oauth2/authorize, /oauth2/token, /v1/me");
	console.log("  OpenAI API: /v1/models");
	console.log("  Test Control: /test/reset, /test/interactions");
});
