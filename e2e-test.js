const { chromium } = require("playwright");

async function handleOfflinePage(page) {
	const isOffline = await page
		.locator(".offline")
		.isVisible()
		.catch(() => false);

	if (isOffline) {
		console.log("⚠️  Offline page detected, trying to refresh...");
		await page.reload({ waitUntil: "networkidle" });
		await page.screenshot({
			path: "solomon-codes-after-refresh.png",
			fullPage: true,
		});
		console.log(
			"📸 Screenshot after refresh saved: solomon-codes-after-refresh.png",
		);
	}
}

async function testGitHubAuthentication(page) {
	const authMessage = await page
		.locator('text*="No GitHub token"')
		.isVisible()
		.catch(() => false);
	const connectGithubButton = page
		.locator('button:has-text("Connect GitHub")')
		.first();
	const hasConnectButton = await connectGithubButton
		.isVisible()
		.catch(() => false);

	if (authMessage || hasConnectButton) {
		console.log(
			"🔐 GitHub authentication required - this is expected for local mode",
		);

		if (hasConnectButton) {
			console.log("🔗 Testing GitHub connection flow...");
			await connectGithubButton.click();
			await page.waitForTimeout(2000);
			await page.screenshot({
				path: "solomon-codes-github-auth.png",
				fullPage: true,
			});

			const currentUrl = page.url();
			console.log("🌐 Current URL after GitHub click:", currentUrl);
		}
	}
}

async function testDockerDialog(page) {
	const dockerDialog = await page
		.locator('text*="Docker"')
		.isVisible()
		.catch(() => false);
	const daggerDialog = await page
		.locator('text*="Dagger"')
		.isVisible()
		.catch(() => false);
	const environmentDialog = await page
		.locator('text*="Environment"')
		.isVisible()
		.catch(() => false);

	if (dockerDialog || daggerDialog || environmentDialog) {
		console.log("🐳 Docker/Dagger environment setup detected");
		await page.screenshot({
			path: "solomon-codes-docker-setup.png",
			fullPage: true,
		});
	}
}

async function testModelSelection(page) {
	console.log("🔄 Testing model selection...");
	const claudeCodeDropdown = page
		.locator('button:has-text("Claude Code")')
		.first();
	const sonnetDropdown = page.locator('button:has-text("Sonnet")').first();

	if (await claudeCodeDropdown.isVisible().catch(() => false)) {
		await claudeCodeDropdown.click();
		await page.waitForTimeout(1000);
		await page.screenshot({
			path: "solomon-codes-claude-dropdown.png",
			fullPage: true,
		});

		const dropdownOptions = await page
			.locator('[role="option"], [role="menuitem"]')
			.count();
		console.log("🎛️  Claude Code dropdown options:", dropdownOptions);
		await page.click("body");
	}

	if (await sonnetDropdown.isVisible().catch(() => false)) {
		await sonnetDropdown.click();
		await page.waitForTimeout(1000);
		await page.screenshot({
			path: "solomon-codes-sonnet-dropdown.png",
			fullPage: true,
		});

		const dropdownOptions = await page
			.locator('[role="option"], [role="menuitem"]')
			.count();
		console.log("🎛️  Sonnet dropdown options:", dropdownOptions);
		await page.click("body");
	}
}

async function testSolomonCodes() {
	console.log("🚀 Starting Solomon Codes E2E Testing...");

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log("📍 Navigating to http://localhost:3001...");
		await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

		await page.screenshot({
			path: "solomon-codes-initial.png",
			fullPage: true,
		});
		console.log("📸 Screenshot saved: solomon-codes-initial.png");

		const title = await page.title();
		console.log("📄 Page title:", title);

		await handleOfflinePage(page);

		const taskInput = page.locator("textarea").first();
		const hasTaskInput = await taskInput.isVisible().catch(() => false);
		const codeButton = page.locator('button:has-text("Code")').first();
		const hasCodeButton = await codeButton.isVisible().catch(() => false);
		const askButton = page.locator('button:has-text("Ask")').first();
		const hasAskButton = await askButton.isVisible().catch(() => false);

		console.log("🔍 Task input visible:", hasTaskInput);
		console.log("🔍 Code button visible:", hasCodeButton);
		console.log("🔍 Ask button visible:", hasAskButton);

		if (hasTaskInput) {
			console.log("✅ Main application loaded successfully");

			const localModeActive = await page
				.locator("text=Local")
				.isVisible()
				.catch(() => false);
			console.log("🏠 Local execution mode active:", localModeActive);

			await taskInput.fill(
				"Create a simple Python function that calculates the factorial of a number",
			);
			console.log(
				'✏️  Task entered: "Create a simple Python function that calculates the factorial of a number"',
			);

			await page.waitForTimeout(1000);
			await page.screenshot({
				path: "solomon-codes-before-code.png",
				fullPage: true,
			});

			if (hasCodeButton) {
				console.log("🎯 Clicking Code button...");
				await codeButton.click();
				await page.waitForTimeout(3000);
				await page.screenshot({
					path: "solomon-codes-after-code-click.png",
					fullPage: true,
				});

				await testGitHubAuthentication(page);
				await testDockerDialog(page);

				const errorMessages = await page
					.locator('[role="alert"], .error, .alert-error')
					.count();
				const loadingStates = await page
					.locator('[data-loading="true"], .loading, .spinner')
					.count();

				console.log("⚠️  Error messages found:", errorMessages);
				console.log("⏳ Loading states found:", loadingStates);
			}

			await testModelSelection(page);
		} else {
			console.log("❌ Main application elements not found");
		}

		const pageContent = await page.content();
		console.log("📝 Page content length:", pageContent.length);
	} catch (error) {
		console.error("❌ Error during testing:", error);
		await page.screenshot({ path: "solomon-codes-error.png", fullPage: true });
	} finally {
		await browser.close();
		console.log("🏁 E2E Testing completed");
	}
}

testSolomonCodes().catch(console.error);
