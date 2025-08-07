import { useCallback, useState } from "react";

interface UseCopyToClipboardOptions {
	timeout?: number;
}

type CopyToClipboardResult = [boolean, (text: string) => Promise<void>];

/**
 * Hook for copying text to clipboard with feedback
 */
export function useCopyToClipboard(
	options: UseCopyToClipboardOptions = {},
): CopyToClipboardResult {
	const { timeout = 2000 } = options;
	const [isCopied, setIsCopied] = useState(false);

	const copyToClipboard = useCallback(
		async (text: string) => {
			try {
				await navigator.clipboard.writeText(text);
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), timeout);
			} catch (error) {
				console.error("Failed to copy text to clipboard:", error);
				// Fallback for older browsers
				try {
					const textArea = document.createElement("textarea");
					textArea.value = text;
					textArea.style.position = "fixed";
					textArea.style.left = "-999999px";
					textArea.style.top = "-999999px";
					document.body.appendChild(textArea);
					textArea.focus();
					textArea.select();
					document.execCommand("copy");
					textArea.remove();
					setIsCopied(true);
					setTimeout(() => setIsCopied(false), timeout);
				} catch (fallbackError) {
					console.error("Fallback copy failed:", fallbackError);
				}
			}
		},
		[timeout],
	);

	return [isCopied, copyToClipboard];
}
