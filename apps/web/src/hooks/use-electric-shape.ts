import { useCallback, useEffect, useState } from "react";
import {
	createShapeStream,
	fetchShape,
	type ShapeConfig,
} from "../lib/database/electric";

/**
 * Helper function to handle shape updates
 */
interface ShapeUpdate<T = { id: string }> {
	type: "insert" | "update" | "delete" | "initial";
	data: T | T[];
}

function handleShapeUpdate<T extends { id: string }>(
	update: ShapeUpdate<T>,
	setData: React.Dispatch<React.SetStateAction<T[]>>,
) {
	if (update.type === "insert") {
		setData((prev) => [...prev, update.data as T]);
	} else if (update.type === "update") {
		const updateData = update.data as T;
		setData((prev) =>
			prev.map((item) =>
				item.id === updateData.id ? { ...item, ...updateData } : item,
			),
		);
	} else if (update.type === "delete") {
		const deleteData = update.data as T;
		setData((prev) => prev.filter((item) => item.id !== deleteData.id));
	} else if (update.type === "initial") {
		setData((update.data as T[]) || []);
	}
}

/**
 * Hook for using ElectricSQL shapes with real-time updates
 */
export function useElectricShape<T extends { id: string } = { id: string }>(
	config: ShapeConfig,
) {
	const [data, setData] = useState<T[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState(false);

	// Fetch initial data
	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const result = await fetchShape(config);
			setData(result as T[]);
			setIsConnected(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setIsConnected(false);
		} finally {
			setLoading(false);
		}
	}, [config]);

	// Set up real-time updates
	useEffect(() => {
		let eventSource: EventSource | null = null;

		const setupStream = async () => {
			try {
				// First fetch initial data
				await fetchData();

				// Then set up real-time stream
				eventSource = createShapeStream(config);

				eventSource.onopen = () => {
					setIsConnected(true);
					setError(null);
				};

				eventSource.onmessage = (event) => {
					try {
						const update = JSON.parse(event.data);
						handleShapeUpdate(update, setData);
					} catch (err) {
						console.error("Error parsing shape update:", err);
					}
				};

				eventSource.onerror = (event) => {
					console.error("Shape stream error:", event);
					setError("Connection to Electric service lost");
					setIsConnected(false);
				};
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
				setIsConnected(false);
			}
		};

		setupStream();

		// Cleanup
		return () => {
			if (eventSource) {
				eventSource.close();
			}
		};
	}, [config, fetchData]);

	// Manual refresh function
	const refresh = useCallback(async () => {
		await fetchData();
	}, [fetchData]);

	return {
		data,
		loading,
		error,
		isConnected,
		refresh,
	};
}

/**
 * Hook for fetching a shape once without real-time updates
 */
export function useElectricShapeOnce<T extends { id: string } = { id: string }>(
	config: ShapeConfig,
) {
	const [data, setData] = useState<T[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const result = await fetchShape(config);
			setData(result as T[]);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [config]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	return {
		data,
		loading,
		error,
		refetch: fetchData,
	};
}

/**
 * Hook for managing multiple shapes
 */
export function useElectricShapes<T extends { id: string } = { id: string }>(
	configs: ShapeConfig[],
) {
	const [shapes, setShapes] = useState<Record<string, T[]>>({});
	const [loading, setLoading] = useState(true);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Extract complex expression to separate variable for dependency array
	const _configsKey = configs
		.map((c) => `${c.table}-${c.where}-${c.columns?.join(",")}`)
		.join("|");

	useEffect(() => {
		const fetchAllShapes = async () => {
			setLoading(true);
			const results: Record<string, T[]> = {};
			const newErrors: Record<string, string> = {};

			await Promise.all(
				configs.map(async (config) => {
					try {
						const data = await fetchShape(config);
						results[config.table] = data as T[];
					} catch (err) {
						newErrors[config.table] =
							err instanceof Error ? err.message : String(err);
					}
				}),
			);

			setShapes(results);
			setErrors(newErrors);
			setLoading(false);
		};

		if (configs.length > 0) {
			fetchAllShapes();
		}
	}, [configs]);

	return {
		shapes,
		loading,
		errors,
	};
}
