/**
 * Example component demonstrating error handling patterns
 * Shows how to use the new error handling system in practice
 */

"use client";

import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
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
import {
	createValidationError,
	ErrorBoundary,
	type FormValidationRule,
	useAsyncOperation,
	useErrorHandler,
	useFormValidation,
} from "@/lib/error-handling";

// Mock API function that can fail
async function mockApiCall(
	delay = 1000,
	shouldFail = false,
): Promise<{ message: string; timestamp: string }> {
	await new Promise((resolve) => setTimeout(resolve, delay));

	if (shouldFail) {
		throw new Error("Mock API failure - this is intentional for demonstration");
	}

	return {
		message: "API call successful!",
		timestamp: new Date().toISOString(),
	};
}

interface FormData extends Record<string, unknown> {
	email: string;
	name: string;
	age: string;
}

const validationRules: {
	[K in keyof FormData]: FormValidationRule<FormData[K]>;
} = {
	email: {
		required: true,
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		custom: (value: unknown) => {
			if (typeof value === "string" && value.includes("test@")) {
				return "Test emails are not allowed";
			}
			return null;
		},
	},
	name: {
		required: true,
		minLength: 2,
		maxLength: 50,
	},
	age: {
		required: true,
		custom: (value: unknown) => {
			const num = Number(value);
			if (Number.isNaN(num) || num < 0 || num > 150) {
				return "Age must be a valid number between 0 and 150";
			}
			return null;
		},
	},
};

function AsyncOperationExample() {
	const [shouldFail, setShouldFail] = useState(false);

	const { data, loading, error, hasError, execute, reset } = useAsyncOperation(
		() => mockApiCall(1500, shouldFail),
		{
			retryAttempts: 3,
			retryDelay: 1000,
			showToast: true,
			context: { component: "AsyncOperationExample" },
		},
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<RefreshCw className="h-5 w-5" />
					Async Operation with Error Handling
				</CardTitle>
				<CardDescription>
					Demonstrates automatic retry logic and error recovery
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="shouldFail"
						checked={shouldFail}
						onChange={(e) => setShouldFail(e.target.checked)}
						className="rounded"
					/>
					<Label htmlFor="shouldFail">Simulate API failure</Label>
				</div>

				<div className="flex gap-2">
					<Button
						onClick={() => execute()}
						disabled={loading}
						className="flex items-center gap-2"
					>
						{loading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						{loading ? "Loading..." : "Call API"}
					</Button>

					{hasError && (
						<Button onClick={reset} variant="outline" size="sm">
							Reset
						</Button>
					)}
				</div>

				{data && (
					<div className="rounded-lg border border-green-200 bg-green-50 p-3">
						<div className="flex items-center gap-2 text-green-800">
							<CheckCircle className="h-4 w-4" />
							<span className="font-medium">Success!</span>
						</div>
						<p className="mt-1 text-green-700 text-sm">{data.message}</p>
						<p className="mt-1 text-green-600 text-xs">
							Time: {data.timestamp}
						</p>
					</div>
				)}

				{hasError && error && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-3">
						<div className="flex items-center gap-2 text-red-800">
							<AlertCircle className="h-4 w-4" />
							<span className="font-medium">Error Occurred</span>
						</div>
						<p className="mt-1 text-red-700 text-sm">{error.userMessage}</p>
						<p className="mt-1 text-red-600 text-xs">Code: {error.code}</p>
						{error.recoverable && (
							<p className="text-red-600 text-xs">
								This error is recoverable - try again
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function FormValidationExample() {
	const {
		values,
		hasErrors,
		isFieldTouched,
		getFieldError,
		handleFieldChange,
		handleFieldBlur,
		validateForm,
		reset,
	} = useFormValidation<FormData>(
		{ email: "", name: "", age: "" },
		validationRules,
	);

	const { handleError } = useErrorHandler({
		showToast: true,
		context: { component: "FormValidationExample" },
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			handleError(
				createValidationError("Please fix the form errors before submitting"),
			);
			return;
		}

		try {
			// Simulate form submission
			await mockApiCall(1000, false);
			alert("Form submitted successfully!");
			reset();
		} catch (error) {
			handleError(error);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Form Validation with Error Handling</CardTitle>
				<CardDescription>
					Real-time validation with custom error messages
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={values.email}
							onChange={(e) => handleFieldChange("email", e.target.value)}
							onBlur={() => handleFieldBlur("email")}
							className={
								isFieldTouched("email") && getFieldError("email")
									? "border-red-500"
									: ""
							}
							placeholder="Enter your email"
						/>
						{isFieldTouched("email") && getFieldError("email") && (
							<p className="text-red-500 text-sm">{getFieldError("email")}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={values.name}
							onChange={(e) => handleFieldChange("name", e.target.value)}
							onBlur={() => handleFieldBlur("name")}
							className={
								isFieldTouched("name") && getFieldError("name")
									? "border-red-500"
									: ""
							}
							placeholder="Enter your name"
						/>
						{isFieldTouched("name") && getFieldError("name") && (
							<p className="text-red-500 text-sm">{getFieldError("name")}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="age">Age</Label>
						<Input
							id="age"
							type="number"
							value={values.age}
							onChange={(e) => handleFieldChange("age", e.target.value)}
							onBlur={() => handleFieldBlur("age")}
							className={
								isFieldTouched("age") && getFieldError("age")
									? "border-red-500"
									: ""
							}
							placeholder="Enter your age"
						/>
						{isFieldTouched("age") && getFieldError("age") && (
							<p className="text-red-500 text-sm">{getFieldError("age")}</p>
						)}
					</div>

					<div className="flex gap-2">
						<Button type="submit" disabled={hasErrors}>
							Submit Form
						</Button>
						<Button type="button" variant="outline" onClick={reset}>
							Reset
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function ComponentThatThrows() {
	const [shouldThrow, setShouldThrow] = useState(false);

	if (shouldThrow) {
		throw new Error("This is a deliberate error to test the error boundary");
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Error Boundary Test</CardTitle>
				<CardDescription>
					This component can throw an error to test the error boundary
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					onClick={() => setShouldThrow(true)}
					variant="destructive"
					className="flex items-center gap-2"
				>
					<AlertCircle className="h-4 w-4" />
					Throw Error
				</Button>
			</CardContent>
		</Card>
	);
}

export default function ErrorHandlingExample() {
	return (
		<div className="container mx-auto space-y-6 py-8">
			<div className="text-center">
				<h1 className="mb-2 font-bold text-3xl">Error Handling Examples</h1>
				<p className="text-muted-foreground">
					Demonstration of various error handling patterns and recovery
					mechanisms
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
				<AsyncOperationExample />
				<FormValidationExample />

				<ErrorBoundary
					fallback={(error, _errorId, reset) => (
						<Card className="border-red-200 bg-red-50">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-red-800">
									<AlertCircle className="h-5 w-5" />
									Component Error
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="mb-4 text-red-700">
									This component encountered an error: {error.message}
								</p>
								<Button onClick={reset} variant="outline" size="sm">
									Reset Component
								</Button>
							</CardContent>
						</Card>
					)}
				>
					<ComponentThatThrows />
				</ErrorBoundary>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Error Handling Features</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<h3 className="mb-2 font-semibold">✅ Implemented Features</h3>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>• Automatic retry with exponential backoff</li>
								<li>• Toast notifications for errors</li>
								<li>• Form validation with real-time feedback</li>
								<li>• Error boundaries with recovery</li>
								<li>• Consistent error types and codes</li>
								<li>• Contextual error information</li>
								<li>• Recoverable vs non-recoverable errors</li>
							</ul>
						</div>
						<div>
							<h3 className="mb-2 font-semibold">🎯 Benefits</h3>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>• Improved user experience</li>
								<li>• Better error debugging</li>
								<li>• Consistent error handling</li>
								<li>• Reduced application crashes</li>
								<li>• Automatic error recovery</li>
								<li>• Better error reporting</li>
								<li>• Type-safe error handling</li>
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
