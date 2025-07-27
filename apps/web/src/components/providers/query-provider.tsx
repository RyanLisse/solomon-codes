"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

interface QueryProviderProps {
	children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// Stale time: how long data is considered fresh
						staleTime: 1000 * 60 * 5, // 5 minutes
						// GC time: how long data stays in cache after component unmounts
						gcTime: 1000 * 60 * 10, // 10 minutes
						// Retry failed requests
						retry: (failureCount, error) => {
							// Don't retry 4xx errors except 408 (timeout)
							if (error instanceof Error && "status" in error) {
								const status = (error as Error & { status: number }).status;
								if (status >= 400 && status < 500 && status !== 408) {
									return false;
								}
							}
							// Retry up to 3 times for other errors
							return failureCount < 3;
						},
						// Refetch on window focus in production only
						refetchOnWindowFocus: process.env.NODE_ENV === "production",
						// Refetch on network reconnect
						refetchOnReconnect: true,
					},
					mutations: {
						// Retry mutations once
						retry: 1,
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{process.env.NODE_ENV === "development" && (
				<ReactQueryDevtools
					initialIsOpen={false}
					buttonPosition="bottom-left"
				/>
			)}
		</QueryClientProvider>
	);
}
