const { chromium } = require("playwright");

async function testCloudMode(page) {
	console.log("☁️  Testing Cloud execution mode...");

	// Look for execution mode toggle
	const executionToggle = page.locator('[role="switch"]').first();
	const isToggleVisible = await executionToggle.isVisible().catch(() => false);

	if (isToggleVisible) {
		// Check current state
		const isLocal = await page
			.locator("text=Local")
			.isVisible()
			.catch(() => false);

		if (isLocal) {
			console.log("🔄 Switching from Local to Cloud mode...");
			await executionToggle.click();
			await page.waitForTimeout(1000);

			const isCloudNow = await page
				.locator("text=Cloud")
				.isVisible()
				.catch(() => false);
			console.log("☁️  Cloud mode active:", isCloudNow);

			await page.screenshot({
				path: "solomon-codes-cloud-mode.png",
				fullPage: true,
			});
		}
	}
}

async function testAskButton(page) {
	console.log("❓ Testing Ask button functionality...");

	const askButton = page.locator('button:has-text("Ask")').first();
	const isAskVisible = await askButton.isVisible().catch(() => false);

	if (isAskVisible) {
		// Clear and enter a question-type task
		const taskInput = page.locator("textarea").first();
		await taskInput.fill(
			"How do I implement user authentication in a React app?",
		);
		console.log(
			'❓ Question entered: "How do I implement user authentication in a React app?"',
		);

		await page.waitForTimeout(1000);
		await askButton.click();
		console.log("🎯 Clicked Ask button");

		await page.waitForTimeout(3000);
		await page.screenshot({
			path: "solomon-codes-ask-response.png",
			fullPage: true,
		});

		// Check for response or loading indicators
		const responseArea = await page
			.locator('.response, .answer, [data-testid="response"]')
			.count();
		const loadingIndicators = await page
			.locator('.loading, .spinner, [data-loading="true"]')
			.count();

		console.log("📝 Response areas found:", responseArea);
		console.log("⏳ Loading indicators:", loadingIndicators);
	}
}

async function testNavigationTabs(page) {
	console.log("🗂️  Testing navigation tabs...");

	// Test different navigation sections
	const automationsTab = page.locator("text=Automations").first();
	const statsTab = page.locator("text=Stats").first();
	const environmentsTab = page.locator("text=Environments").first();
	const settingsTab = page.locator("text=Settings").first();

	const tabs = [
		{ element: automationsTab, name: "Automations" },
		{ element: statsTab, name: "Stats" },
		{ element: environmentsTab, name: "Environments" },
		{ element: settingsTab, name: "Settings" },
	];

	for (const tab of tabs) {
		const isVisible = await tab.element.isVisible().catch(() => false);
		if (isVisible) {
			console.log(`🔗 Testing ${tab.name} tab...`);
			await tab.element.click();
			await page.waitForTimeout(2000);
			await page.screenshot({
				path: `solomon-codes-${tab.name.toLowerCase()}.png`,
				fullPage: true,
			});

			const currentUrl = page.url();
			console.log(`📍 ${tab.name} URL:`, currentUrl);
		}
	}

	// Return to home
	const homeTab = page.locator("text=Home").first();
	const isHomeVisible = await homeTab.isVisible().catch(() => false);
	if (isHomeVisible) {
		await homeTab.click();
		await page.waitForTimeout(1000);
		console.log("🏠 Returned to Home tab");
	}
}

async function testVoiceInput(page) {
	console.log("🎤 Testing voice input functionality...");

	const voiceButton = page
		.locator(
			'button[aria-label*="voice"], button[title*="voice"], .voice-button',
		)
		.first();
	const micButton = page.locator('🎤, [role="button"]:has-text("🎤")').first();

	const isVoiceVisible = await voiceButton.isVisible().catch(() => false);
	const isMicVisible = await micButton.isVisible().catch(() => false);

	if (isVoiceVisible || isMicVisible) {
		console.log("🎤 Voice input button found");
		const buttonToClick = isVoiceVisible ? voiceButton : micButton;
		await buttonToClick.click();
		await page.waitForTimeout(2000);

		await page.screenshot({
			path: "solomon-codes-voice-input.png",
			fullPage: true,
		});

		console.log("🎤 Voice input activated");
	} else {
		console.log("🎤 No voice input button found");
	}
}

async function extendedTestSolomonCodes() {
	console.log("🚀 Starting Extended Solomon Codes E2E Testing...");

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log("📍 Navigating to http://localhost:3001...");
		await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

		await page.screenshot({
			path: "solomon-codes-extended-start.png",
			fullPage: true,
		});

		// Test basic functionality first
		const taskInput = page.locator("textarea").first();
		const hasTaskInput = await taskInput.isVisible().catch(() => false);

		if (hasTaskInput) {
			console.log("✅ Main application loaded for extended testing");

			// Test different execution modes
			await testCloudMode(page);

			// Test Ask button functionality
			await testAskButton(page);

			// Test navigation tabs
			await testNavigationTabs(page);

			// Test voice input if available
			await testVoiceInput(page);

			// Test with different types of tasks
			console.log("🔄 Testing different task types...");

			const taskTypes = [
				"Build a REST API with Express.js and MongoDB",
				"Create a responsive navigation component with Tailwind CSS",
				"Implement a Redis caching layer for better performance",
				"Set up Docker containers for development environment",
			];

			for (let i = 0; i < taskTypes.length; i++) {
				const task = taskTypes[i];
				console.log(`📝 Testing task ${i + 1}: "${task}"`);

				await taskInput.fill(task);
				await page.waitForTimeout(1000);

				// Test Code button for this task
				const codeButton = page.locator('button:has-text("Code")').first();
				if (await codeButton.isVisible().catch(() => false)) {
					await codeButton.click();
					await page.waitForTimeout(2000);

					await page.screenshot({
						path: `solomon-codes-task-${i + 1}-response.png`,
						fullPage: true,
					});

					// Check for any environment setup dialogs
					const envDialog = await page
						.locator('text*="Environment", text*="Docker", text*="Setup"')
						.count();
					if (envDialog > 0) {
						console.log(
							`🐳 Environment setup dialog detected for task ${i + 1}`,
						);
						await page.screenshot({
							path: `solomon-codes-task-${i + 1}-env-setup.png`,
							fullPage: true,
						});
					}
				}

				await page.waitForTimeout(1000);
			}
		} else {
			console.log("❌ Main application not available for extended testing");
		}
	} catch (error) {
		console.error("❌ Error during extended testing:", error);
		await page.screenshot({
			path: "solomon-codes-extended-error.png",
			fullPage: true,
		});
	} finally {
		await browser.close();
		console.log("🏁 Extended E2E Testing completed");
	}
}

extendedTestSolomonCodes().catch(console.error);
