"use client";

import { Key, Loader2, LogIn, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClaudeAuth } from "@/hooks/use-claude-auth";
import type { ClaudeUser } from "@/lib/auth/claude-token-store";

/**
 * Props for Claude authentication button component
 */
export interface ClaudeAuthButtonProps {
	onAuthSuccess?: (user: ClaudeUser) => void;
	onAuthError?: (error: string) => void;
	className?: string;
}

/**
 * Main Claude authentication component with dual authentication options
 * Supports both OAuth and API key authentication methods
 */
export function ClaudeAuthButton({
	onAuthSuccess,
	onAuthError,
	className = "",
}: ClaudeAuthButtonProps) {
	const {
		isAuthenticated,
		user,
		authMethod,
		isLoading,
		error,
		login,
		loginWithApiKey,
		logout,
	} = useClaudeAuth();

	const [apiKey, setApiKey] = useState("");
	const [_showApiKeyInput, _setShowApiKeyInput] = useState(false);

	// Handle OAuth login
	const handleOAuthLogin = async () => {
		try {
			await login();
			if (user && onAuthSuccess) {
				onAuthSuccess(user);
			}
		} catch (loginError) {
			const errorMessage =
				loginError instanceof Error ? loginError.message : "OAuth login failed";
			if (onAuthError) {
				onAuthError(errorMessage);
			}
		}
	};

	// Handle API key login
	const handleApiKeyLogin = async () => {
		if (!apiKey.trim()) {
			if (onAuthError) {
				onAuthError("Please enter your API key");
			}
			return;
		}

		try {
			await loginWithApiKey(apiKey.trim());
			if (user && onAuthSuccess) {
				onAuthSuccess(user);
			}
			setApiKey(""); // Clear API key from state
		} catch (apiKeyError) {
			const errorMessage =
				apiKeyError instanceof Error
					? apiKeyError.message
					: "API key authentication failed";
			if (onAuthError) {
				onAuthError(errorMessage);
			}
		}
	};

	// Handle logout
	const handleLogout = async () => {
		try {
			await logout();
		} catch (logoutError) {
			const errorMessage =
				logoutError instanceof Error ? logoutError.message : "Logout failed";
			if (onAuthError) {
				onAuthError(errorMessage);
			}
		}
	};

	// Show authenticated state
	if (isAuthenticated && user) {
		return (
			<div className={`space-y-3 ${className}`}>
				<div className="flex items-center space-x-3 rounded-lg border bg-muted/50 p-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
						<User className="h-4 w-4" />
					</div>
					<div className="flex-1">
						<p className="font-medium text-sm">{user.name}</p>
						<p className="text-muted-foreground text-xs">
							{authMethod === "oauth" ? "OAuth" : "API Key"} •{" "}
							{user.subscription}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleLogout}
						disabled={isLoading}
					>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<LogOut className="h-4 w-4" />
						)}
						<span className="ml-1">Logout</span>
					</Button>
				</div>
			</div>
		);
	}

	// Show authentication options
	return (
		<div className={`space-y-4 ${className}`}>
			<Tabs defaultValue="oauth" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="oauth">Claude Max</TabsTrigger>
					<TabsTrigger value="apikey">API Key</TabsTrigger>
				</TabsList>

				<TabsContent value="oauth" className="space-y-3">
					<div className="space-y-2 text-center">
						<p className="text-muted-foreground text-sm">
							Sign in with your Claude Max subscription
						</p>
						<Button
							onClick={handleOAuthLogin}
							disabled={isLoading}
							className="w-full"
							size="lg"
						>
							{isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<LogIn className="h-4 w-4" />
							)}
							<span className="ml-2">Sign in with Claude Max</span>
						</Button>
					</div>
				</TabsContent>

				<TabsContent value="apikey" className="space-y-3">
					<div className="space-y-3">
						<div className="text-center">
							<p className="text-muted-foreground text-sm">
								Use your Claude API key for authentication
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="claude-api-key">Claude API Key</Label>
							<Input
								id="claude-api-key"
								type="password"
								placeholder="sk-ant-api03-..."
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								onKeyPress={(e) => {
									if (e.key === "Enter") {
										void handleApiKeyLogin();
									}
								}}
								disabled={isLoading}
							/>
							<p className="text-muted-foreground text-xs">
								Your API key starts with &ldquo;sk-ant-api&rdquo; and is 104
								characters long
							</p>
						</div>

						<Button
							onClick={handleApiKeyLogin}
							disabled={isLoading || !apiKey.trim()}
							className="w-full"
							variant="outline"
						>
							{isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Key className="h-4 w-4" />
							)}
							<span className="ml-2">Authenticate with API Key</span>
						</Button>
					</div>
				</TabsContent>
			</Tabs>

			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
