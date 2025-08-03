"use client";

import {
  AlertCircle,
  CheckCircle,
  Key,
  Settings,
  Bot,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useClaudeAuth } from "@/hooks/use-claude-auth";

export default function SettingsPage() {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isTestingOpenai, setIsTestingOpenai] = useState(false);
  const [openaiStatus, setOpenaiStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");

  const {
    isAuthenticated: isClaudeAuthenticated,
    user: claudeUser,
    authMethod: claudeAuthMethod,
    isLoading: isClaudeLoading,
    error: claudeError,
    login: loginClaude,
    loginWithApiKey: loginClaudeWithApiKey,
    logout: logoutClaude,
  } = useClaudeAuth();

  const handleOpenaiApiKeyTest = async () => {
    if (!openaiApiKey.trim()) return;

    setIsTestingOpenai(true);
    try {
      const response = await fetch("/api/auth/openai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openaiApiKey }),
      });

      const result = await response.json();
      setOpenaiStatus(result.success ? "valid" : "invalid");

      if (result.success) {
        localStorage.setItem("openai_api_key", openaiApiKey);
      }
    } catch (error) {
      setOpenaiStatus("invalid");
    } finally {
      setIsTestingOpenai(false);
    }
  };

  const handleOpenaiKeySave = () => {
    if (openaiStatus === "valid") {
      localStorage.setItem("openai_api_key", openaiApiKey);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="font-bold text-3xl">Settings</h1>
          <p className="text-muted-foreground">
            Configure your AI agents and authentication
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Claude Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Bot className="h-6 w-6" />
              Claude Code Authentication
            </CardTitle>
            <CardDescription>
              Connect your Claude Pro or Max account for enhanced code
              generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isClaudeAuthenticated ? (
              <div className="space-y-4">
                <div
                  className="flex items-center justify-between rounded-lg border bg-green-50 p-4"
                  data-testid="claude-auth-status"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Connected</p>
                      <p className="text-muted-foreground text-sm">
                        {claudeAuthMethod === "oauth"
                          ? "OAuth Authentication"
                          : "API Key Authentication"}
                        {claudeUser?.subscription && (
                          <Badge variant="secondary" className="ml-2">
                            {claudeUser.subscription}
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={logoutClaude}
                    data-testid="claude-disconnect-button"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {claudeError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{claudeError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={loginClaude}
                    disabled={isClaudeLoading}
                    className="w-full"
                    data-testid="claude-oauth-button"
                  >
                    {isClaudeLoading
                      ? "Connecting..."
                      : "Connect with Claude Pro/Max"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or use API key
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claude-api-key">Claude API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="claude-api-key"
                        type="password"
                        placeholder="sk-ant-api..."
                        onChange={(e) => {
                          // Could add API key input handling here
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          const input = document.getElementById(
                            "claude-api-key",
                          ) as HTMLInputElement;
                          if (input?.value) {
                            loginClaudeWithApiKey(input.value);
                          }
                        }}
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OpenAI Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Sparkles className="h-6 w-6" />
              OpenAI Authentication
            </CardTitle>
            <CardDescription>
              Configure your OpenAI API key for GPT models and OpenCode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">OpenAI API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-api-key"
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  data-testid="openai-api-key-input"
                />
                <Button
                  variant="outline"
                  onClick={handleOpenaiApiKeyTest}
                  disabled={!openaiApiKey.trim() || isTestingOpenai}
                  data-testid="openai-test-button"
                >
                  {isTestingOpenai ? "Testing..." : "Test"}
                </Button>
              </div>

              {openaiStatus === "valid" && (
                <div
                  className="flex items-center gap-2 text-green-600 text-sm"
                  data-testid="openai-validation-status"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>API key is valid</span>
                  <Button
                    size="sm"
                    onClick={handleOpenaiKeySave}
                    data-testid="openai-save-button"
                  >
                    Save
                  </Button>
                </div>
              )}

              {openaiStatus === "invalid" && (
                <div
                  className="flex items-center gap-2 text-red-600 text-sm"
                  data-testid="openai-validation-status"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Invalid API key</span>
                </div>
              )}
            </div>

            <p className="text-muted-foreground text-sm">
              Your API key is stored locally and used for OpenAI CLI and
              OpenCode agents.
            </p>
          </CardContent>
        </Card>

        {/* API Key Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Key className="h-5 w-5" />
              API Key Management
            </CardTitle>
            <CardDescription>
              Manage and test your AI provider API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Claude</h4>
                  <div className="flex items-center gap-2">
                    {isClaudeAuthenticated ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 text-sm">
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-orange-600 text-sm">
                          Not connected
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">OpenAI</h4>
                  <div className="flex items-center gap-2">
                    {openaiStatus === "valid" ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 text-sm">
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-orange-600 text-sm">
                          Not connected
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
