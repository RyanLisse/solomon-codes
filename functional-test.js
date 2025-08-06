const { chromium } = require("playwright");

/**
 * Functional test to verify the complete Solomon Codes workflow
 * This test goes beyond UI testing to verify actual functionality
 */

async function waitForResponse(page, timeout = 30000) {
	console.log("⏳ Waiting for response from CLI agent...");

	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		// Check for success indicators
		const hasResponse = await page
			.locator('.response, .answer, [data-response="true"], .task-result')
			.count();
		const hasCodeBlock = await page.locator("pre, code, .code-block").count();
		const hasGeneratedContent = await page
			.locator('text*="function", text*="const", text*="import"')
			.count();

		// Check for error messages
		const hasError = await page
			.locator(
				'[role="alert"], .error, .alert-error, text*="Error:", text*="Failed"',
			)
			.count();

		// Check for loading states
		const isLoading = await page
			.locator('.loading, .spinner, [data-loading="true"]')
			.count();

		console.log(
			`📊 Status check: responses=${hasResponse}, code=${hasCodeBlock}, content=${hasGeneratedContent}, errors=${hasError}, loading=${isLoading}`,
		);

		if (hasResponse > 0 || hasCodeBlock > 0 || hasGeneratedContent > 0) {
			console.log("✅ Response detected!");
			return { success: true, hasContent: true };
		}

		if (hasError > 0 && isLoading === 0) {
			console.log("❌ Error detected without loading state");
			return { success: false, error: "Error state detected" };
		}

		await page.waitForTimeout(2000);
	}

	console.log("⏰ Timeout waiting for response");
	return { success: false, error: "Timeout waiting for response" };
}

async function testGitHubAuthentication(page) {
	console.log("🔐 Testing GitHub authentication flow...");

	// Look for Connect GitHub button
	const connectButton = page
		.locator('button:has-text("Connect GitHub")')
		.first();
	const isVisible = await connectButton.isVisible().catch(() => false);

	if (isVisible) {
		console.log("🔗 Clicking Connect GitHub...");
		await connectButton.click();

		await page.waitForTimeout(3000);

		// Check if we're redirected to GitHub OAuth or get a popup
		const currentUrl = page.url();
		console.log("🌐 Current URL after GitHub click:", currentUrl);

		// Check for OAuth page elements
		const isGitHubOAuth =
			currentUrl.includes("github.com") ||
			(await page.locator('text*="OAuth", text*="Authorize"').count()) > 0;

		if (isGitHubOAuth) {
			console.log("✅ GitHub OAuth flow initiated");
			// For testing, we'll navigate back since we can't complete OAuth
			await page.goBack();
			return { authenticated: false, oauthInitiated: true };
		}
	}

	return { authenticated: false, oauthInitiated: false };
}

async function testVibeKitIntegration(page, taskText, buttonType = "Code") {
	console.log(`🧪 Testing VibeKit integration with ${buttonType} button...`);

	// Enter task
	const taskInput = page.locator("textarea").first();
	await taskInput.fill(taskText);
	console.log(`📝 Task entered: "${taskText}"`);

	await page.waitForTimeout(500);

	// Take screenshot before clicking
	await page.screenshot({
		path: `functional-test-before-${buttonType.toLowerCase()}.png`,
		fullPage: true,
	});

	// Click the appropriate button
	const actionButton = page.locator(`button:has-text("${buttonType}")`).first();
	const isButtonVisible = await actionButton.isVisible().catch(() => false);

	if (!isButtonVisible) {
		console.log(`❌ ${buttonType} button not visible`);
		return { success: false, error: `${buttonType} button not found` };
	}

	console.log(`🎯 Clicking ${buttonType} button...`);
	await actionButton.click();

	// Wait a moment for any immediate UI changes
	await page.waitForTimeout(1000);

	// Take screenshot after clicking
	await page.screenshot({
		path: `functional-test-after-${buttonType.toLowerCase()}-click.png`,
		fullPage: true,
	});

	// Check for authentication requirement
	const needsAuth =
		(await page
			.locator(':has-text("No GitHub token"), :has-text("Connect GitHub")')
			.count()) > 0;

	if (needsAuth) {
		console.log("🔐 GitHub authentication required");
		const authResult = await testGitHubAuthentication(page);

		if (!authResult.oauthInitiated) {
			console.log("⚠️  Cannot proceed without GitHub authentication");
			return {
				success: false,
				error: "GitHub authentication required but OAuth not initiated",
				needsAuth: true,
			};
		}
	}

	// Wait for response from VibeKit
	const responseResult = await waitForResponse(page, 45000);

	// Take final screenshot
	await page.screenshot({
		path: `functional-test-${buttonType.toLowerCase()}-final.png`,
		fullPage: true,
	});

	// Get any console errors
	const consoleLogs = await page.evaluate(() => {
		return window.consoleErrors || [];
	});

	// Check for specific VibeKit errors in the page
	const vibkitError =
		(await page
			.locator('text*="Failed to generate code with VibeKit"')
			.count()) > 0;
	const connectionError =
		(await page.locator('text*="connection", text*="network"').count()) > 0;

	return {
		...responseResult,
		needsAuth,
		consoleLogs,
		vibkitError,
		connectionError,
		buttonType,
	};
}

async function comprehensiveFunctionalTest() {
	console.log("🚀 Starting Comprehensive Functional Test...");
	console.log(
		"📋 This test verifies actual functionality, not just UI elements",
	);

	const browser = await chromium.launch({
		headless: false,
		// Add debugging options
		args: ["--disable-dev-shm-usage", "--disable-extensions"],
	});

	const context = await browser.newContext({
		// Enable console logging
		recordVideo: { dir: "test-videos/" },
	});

	const page = await context.newPage();

	// Capture console errors
	const consoleErrors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			consoleErrors.push(msg.text());
			console.log("🔴 Console Error:", msg.text());
		}
	});

	// Capture network failures
	page.on("response", (response) => {
		if (response.status() >= 400) {
			console.log(`🌐 Network Error: ${response.status()} ${response.url()}`);
		}
	});

	try {
		console.log("📍 Navigating to Solomon Codes...");
		await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

		const title = await page.title();
		console.log("📄 Page title:", title);

		await page.screenshot({
			path: "functional-test-initial.png",
			fullPage: true,
		});

		// Verify basic UI is loaded
		const taskInput = page.locator("textarea").first();
		const hasTaskInput = await taskInput.isVisible().catch(() => false);

		if (!hasTaskInput) {
			throw new Error("Task input not found - basic UI not loaded");
		}

		console.log("✅ Basic UI loaded successfully");

		// Test different scenarios
		const testScenarios = [
			{
				task: "Create a simple JavaScript function that adds two numbers",
				button: "Code",
				description: "Basic code generation",
			},
			{
				task: "How do I center a div in CSS?",
				button: "Ask",
				description: "Q&A functionality",
			},
			{
				task: "Build a React component with state management",
				button: "Code",
				description: "Complex code generation",
			},
		];

		for (let i = 0; i < testScenarios.length; i++) {
			const scenario = testScenarios[i];
			console.log(`\n🧪 Test ${i + 1}: ${scenario.description}`);
			console.log(`📝 Task: "${scenario.task}"`);

			const result = await testVibeKitIntegration(
				page,
				scenario.task,
				scenario.button,
			);

			console.log(`📊 Result for ${scenario.description}:`, {
				success: result.success,
				error: result.error,
				needsAuth: result.needsAuth,
				vibkitError: result.vibkitError,
				connectionError: result.connectionError,
			});

			if (result.success) {
				console.log(`✅ ${scenario.description} - PASSED`);
			} else {
				console.log(`❌ ${scenario.description} - FAILED: ${result.error}`);
			}

			// Wait between tests
			await page.waitForTimeout(2000);
		}

		// Check execution modes
		console.log("\n🔄 Testing execution modes...");

		// Test Local mode
		const localToggle = page.locator("text=Local").first();
		const isLocalVisible = await localToggle.isVisible().catch(() => false);
		console.log("🏠 Local mode available:", isLocalVisible);

		// Test Cloud mode
		const executionToggle = page.locator('[role="switch"]').first();
		const isToggleVisible = await executionToggle
			.isVisible()
			.catch(() => false);

		if (isToggleVisible && isLocalVisible) {
			console.log("☁️  Switching to Cloud mode...");
			await executionToggle.click();
			await page.waitForTimeout(1000);

			const isCloudMode = await page
				.locator("text=Cloud")
				.isVisible()
				.catch(() => false);
			console.log("☁️  Cloud mode active:", isCloudMode);

			if (isCloudMode) {
				// Test in cloud mode
				const cloudResult = await testVibeKitIntegration(
					page,
					"Create a Python script to read a CSV file",
					"Code",
				);
				console.log(
					"☁️  Cloud mode test result:",
					cloudResult.success ? "PASSED" : "FAILED",
				);
			}
		}

		// Final diagnostics
		console.log("\n🔍 Final Diagnostics:");
		console.log("🔴 Console errors captured:", consoleErrors.length);
		consoleErrors.forEach((error, i) => {
			console.log(`   ${i + 1}. ${error}`);
		});

		const pageContent = await page.content();
		const hasVibeKitError = pageContent.includes(
			"Failed to generate code with VibeKit",
		);
		const hasConfigError =
			pageContent.includes("configuration") && pageContent.includes("error");

		console.log("🧰 VibeKit error in page:", hasVibeKitError);
		console.log("⚙️  Configuration error in page:", hasConfigError);
	} catch (error) {
		console.error("❌ Test error:", error);
		await page.screenshot({
			path: "functional-test-error.png",
			fullPage: true,
		});
	} finally {
		await browser.close();
		console.log("\n🏁 Comprehensive Functional Test completed");
		console.log("📸 Screenshots saved for review");
		console.log("🎥 Video recordings saved in test-videos/");
	}
}

comprehensiveFunctionalTest().catch(console.error);
