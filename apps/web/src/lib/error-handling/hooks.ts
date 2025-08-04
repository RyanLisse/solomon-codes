/**
 * Error handling hooks
 * Provides reusable hooks for common error handling scenarios
 */

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
	AppError,
	createNetworkError,
	type ErrorContext,
	isAppError,
	isRecoverableError,
} from "./error-handler";

export interface UseErrorHandlerOptions {
	showToast?: boolean;
	logError?: boolean;
	onError?: (error: AppError) => void;
	context?: ErrorContext;
}

export interface ErrorHandlerState {
	error: AppError | null;
	hasError: boolean;
	isRecoverable: boolean;
}

/**
 * Hook for centralized error handling
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
	const { showToast = true, logError = true, onError, context } = options;
	const [errorState, setErrorState] = useState<ErrorHandlerState>({
		error: null,
		hasError: false,
		isRecoverable: false,
	});

	const clearError = useCallback(() => {
		setErrorState({
			error: null,
			hasError: false,
			isRecoverable: false,
		});
	}, []);

	const handleError = useCallback(
		(error: unknown, additionalContext?: ErrorContext) => {
			const appError = isAppError(error)
				? error
				: AppError.fromApiError(error, { ...context, ...additionalContext });

			const newState = {
				error: appError,
				hasError: true,
				isRecoverable: isRecoverableError(appError),
			};

			setErrorState(newState);

			// Log error if enabled
			if (logError) {
				console.error("Error handled:", appError.toJSON());
			}

			// Show toast notification if enabled
			if (showToast) {
				toast.error(appError.userMessage, {
					description: appError.code,
					action: newState.isRecoverable
						? {
								label: "Retry",
								onClick: () => clearError(),
							}
						: undefined,
				});
			}

			// Call custom error handler if provided
			onError?.(appError);

			return appError;
		},
		[context, logError, onError, showToast, clearError],
	);

	return {
		...errorState,
		handleError,
		clearError,
	};
}

export interface UseAsyncOperationOptions extends UseErrorHandlerOptions {
	retryAttempts?: number;
	retryDelay?: number;
}

export interface AsyncOperationState<T> {
	data: T | null;
	loading: boolean;
	error: AppError | null;
	hasError: boolean;
}

/**
 * Hook for handling async operations with error handling and retry logic
 */
export function useAsyncOperation<T>(
	asyncFn: () => Promise<T>,
	options: UseAsyncOperationOptions = {},
) {
	const { retryAttempts = 3, retryDelay = 1000, ...errorOptions } = options;
	const { handleError, clearError } = useErrorHandler(errorOptions);

	const [state, setState] = useState<AsyncOperationState<T>>({
		data: null,
		loading: false,
		error: null,
		hasError: false,
	});

	const execute = useCallback(
		async (attempt = 1): Promise<T | null> => {
			setState((prev) => ({
				...prev,
				loading: true,
				error: null,
				hasError: false,
			}));
			clearError();

			try {
				const result = await asyncFn();
				setState({
					data: result,
					loading: false,
					error: null,
					hasError: false,
				});
				return result;
			} catch (error) {
				const appError = handleError(error, {
					action: "async_operation",
					attempt,
					maxAttempts: retryAttempts,
				});

				setState({
					data: null,
					loading: false,
					error: appError,
					hasError: true,
				});

				// Retry logic for recoverable errors
				if (attempt < retryAttempts && isRecoverableError(appError)) {
					await new Promise((resolve) =>
						setTimeout(resolve, retryDelay * attempt),
					);
					return execute(attempt + 1);
				}

				return null;
			}
		},
		[asyncFn, clearError, handleError, retryAttempts, retryDelay],
	);

	const reset = useCallback(() => {
		setState({
			data: null,
			loading: false,
			error: null,
			hasError: false,
		});
		clearError();
	}, [clearError]);

	return {
		...state,
		execute,
		reset,
	};
}

export interface FormValidationRule<T> {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: RegExp;
	custom?: (value: T) => string | null;
}

export interface FormValidationErrors {
	[key: string]: string | undefined;
}

/**
 * Hook for form validation with error handling
 */
export function useFormValidation<T extends Record<string, unknown>>(
	initialValues: T,
	validationRules: { [K in keyof T]?: FormValidationRule<T[K]> },
) {
	const [values, setValues] = useState<T>(initialValues);
	const [errors, setErrors] = useState<FormValidationErrors>({});
	const [touched, setTouched] = useState<{ [K in keyof T]?: boolean }>({});

	const validateField = useCallback(
		(name: keyof T, value: T[keyof T]): string | null => {
			const rules = validationRules[name];
			if (!rules) return null;

			// Required validation
			if (
				rules.required &&
				(!value || (typeof value === "string" && value.trim() === ""))
			) {
				return `${String(name)} is required`;
			}

			// String-specific validations
			if (typeof value === "string") {
				if (rules.minLength && value.length < rules.minLength) {
					return `${String(name)} must be at least ${rules.minLength} characters`;
				}
				if (rules.maxLength && value.length > rules.maxLength) {
					return `${String(name)} must not exceed ${rules.maxLength} characters`;
				}
				if (rules.pattern && !rules.pattern.test(value)) {
					return `${String(name)} format is invalid`;
				}
			}

			// Custom validation
			if (rules.custom) {
				return rules.custom(value);
			}

			return null;
		},
		[validationRules],
	);

	const validateForm = useCallback((): boolean => {
		const newErrors: FormValidationErrors = {};
		let isValid = true;

		Object.keys(validationRules).forEach((key) => {
			const error = validateField(key as keyof T, values[key as keyof T]);
			if (error) {
				newErrors[key] = error;
				isValid = false;
			}
		});

		setErrors(newErrors);
		return isValid;
	}, [validateField, validationRules, values]);

	const handleFieldChange = useCallback(
		(name: keyof T, value: T[keyof T]) => {
			setValues((prev) => ({ ...prev, [name]: value }));

			// Clear error when user starts typing
			if (errors[name as string]) {
				setErrors((prev) => ({ ...prev, [name as string]: undefined }));
			}
		},
		[errors],
	);

	const handleFieldBlur = useCallback(
		(name: keyof T) => {
			setTouched((prev) => ({ ...prev, [name]: true }));

			const error = validateField(name, values[name]);
			if (error) {
				setErrors((prev) => ({ ...prev, [name as string]: error }));
			}
		},
		[validateField, values],
	);

	const reset = useCallback(() => {
		setValues(initialValues);
		setErrors({});
		setTouched({});
	}, [initialValues]);

	const hasErrors = Object.keys(errors).length > 0;
	const isFieldTouched = (name: keyof T) => Boolean(touched[name]);
	const getFieldError = (name: keyof T) => errors[name as string];

	return {
		values,
		errors,
		touched,
		hasErrors,
		isFieldTouched,
		getFieldError,
		handleFieldChange,
		handleFieldBlur,
		validateForm,
		reset,
	};
}

/**
 * Hook for API calls with built-in error handling
 */
export function useApiCall<TData = unknown, _TError = unknown>(
	options: UseErrorHandlerOptions = {},
) {
	const { handleError, clearError } = useErrorHandler(options);
	const [state, setState] = useState<{
		data: TData | null;
		loading: boolean;
		error: AppError | null;
	}>({
		data: null,
		loading: false,
		error: null,
	});

	const call = useCallback(
		async <T = TData>(apiCall: () => Promise<T>): Promise<T | null> => {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			clearError();

			try {
				const result = await apiCall();
				setState((prev) => ({
					...prev,
					data: result as TData,
					loading: false,
				}));
				return result;
			} catch (error) {
				const networkError = createNetworkError(
					error instanceof Error ? error : new Error(String(error)),
					{ action: "api_call" },
				);

				const appError = handleError(networkError);
				setState((prev) => ({ ...prev, loading: false, error: appError }));
				return null;
			}
		},
		[clearError, handleError],
	);

	return {
		...state,
		call,
		reset: () => {
			setState({ data: null, loading: false, error: null });
			clearError();
		},
	};
}

/**
 * Hook for debounced error handling (useful for real-time validation)
 */
export function useDebouncedError(delay = 300) {
	const [debouncedError, setDebouncedError] = useState<AppError | null>(null);
	const { handleError, clearError } = useErrorHandler({ showToast: false });

	const debouncedHandleError = useCallback(
		(error: unknown, context?: ErrorContext) => {
			const timer = setTimeout(() => {
				const appError = handleError(error, context);
				setDebouncedError(appError);
			}, delay);

			return () => clearTimeout(timer);
		},
		[delay, handleError],
	);

	const clearDebouncedError = useCallback(() => {
		setDebouncedError(null);
		clearError();
	}, [clearError]);

	return {
		debouncedError,
		debouncedHandleError,
		clearDebouncedError,
	};
}
