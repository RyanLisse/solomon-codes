"use client";

import { useState } from "react";
import { useElectricShape } from "../hooks/use-electric-shape";

/**
 * Demo component showing ElectricSQL integration with Railway PostgreSQL
 */
export function ElectricDemo() {
	const [tableName, setTableName] = useState("tasks");

	// Use ElectricSQL shape to sync data from Railway PostgreSQL
	const { data, loading, error, isConnected, refresh } = useElectricShape({
		table: tableName,
		// Optional: Add where clause for filtering
		// where: "status = 'active'",
		// Optional: Select specific columns
		// columns: ["id", "title", "status", "created_at"],
	});

	const handleTableChange = (newTable: string) => {
		setTableName(newTable);
	};

	return (
		<div className="mx-auto max-w-4xl p-6">
			<div className="mb-6">
				<h1 className="mb-2 font-bold text-2xl">
					ElectricSQL + Railway PostgreSQL Demo
				</h1>
				<p className="text-gray-600">
					Real-time sync between your Railway PostgreSQL database and this React
					component
				</p>
			</div>

			{/* Connection Status */}
			<div className="mb-4 rounded-lg border p-3">
				<div className="flex items-center gap-2">
					<div
						className={`h-3 w-3 rounded-full ${
							isConnected ? "bg-green-500" : "bg-red-500"
						}`}
					/>
					<span className="font-medium">
						{isConnected ? "Connected to Electric" : "Disconnected"}
					</span>
					<button
						type="button"
						onClick={refresh}
						className="ml-auto rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
					>
						Refresh
					</button>
				</div>
			</div>

			{/* Table Selector */}
			<div className="mb-4">
				<label
					htmlFor="table-selector"
					className="mb-2 block font-medium text-sm"
				>
					Select Table to Sync:
				</label>
				<select
					id="table-selector"
					value={tableName}
					onChange={(e) => handleTableChange(e.target.value)}
					className="rounded-md border px-3 py-2"
				>
					<option value="tasks">Tasks</option>
					<option value="environments">Environments</option>
					<option value="users">Users</option>
					<option value="projects">Projects</option>
				</select>
			</div>

			{/* Error Display */}
			{error && (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
					<h3 className="font-medium text-red-800">Error</h3>
					<p className="text-red-600 text-sm">{error}</p>
					<details className="mt-2">
						<summary className="cursor-pointer text-red-700 text-sm">
							Troubleshooting
						</summary>
						<div className="mt-2 text-red-600 text-sm">
							<p>Common issues:</p>
							<ul className="mt-1 list-inside list-disc">
								<li>Electric service not running</li>
								<li>Table doesn&apos;t exist in PostgreSQL</li>
								<li>Network connectivity issues</li>
								<li>CORS configuration</li>
							</ul>
						</div>
					</details>
				</div>
			)}

			{/* Loading State */}
			{loading && (
				<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
					<div className="flex items-center gap-2">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
						<span>Loading data from {tableName}...</span>
					</div>
				</div>
			)}

			{/* Data Display */}
			<div className="rounded-lg border">
				<div className="border-b bg-gray-50 p-3">
					<h2 className="font-medium">
						Data from &quot;{tableName}&quot; table ({data.length} records)
					</h2>
				</div>
				<div className="p-3">
					{data.length === 0 ? (
						<p className="py-8 text-center text-gray-500">
							No data found in &quot;{tableName}&quot; table
						</p>
					) : (
						<div className="overflow-x-auto">
							<pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 text-sm">
								{JSON.stringify(data, null, 2)}
							</pre>
						</div>
					)}
				</div>
			</div>

			{/* Instructions */}
			<div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
				<h3 className="mb-2 font-medium text-blue-800">
					How to test real-time sync:
				</h3>
				<ol className="list-inside list-decimal space-y-1 text-blue-700 text-sm">
					<li>Connect to your Railway PostgreSQL database</li>
					<li>
						Insert, update, or delete records in the &quot;{tableName}&quot;
						table
					</li>
					<li>Watch this component update in real-time!</li>
				</ol>
				<div className="mt-3 rounded bg-blue-100 p-2 text-xs">
					<strong>Database Connection:</strong>
					<br />
					<code>railway connect postgres</code>
					<br />
					<strong>Example SQL:</strong>
					<br />
					<code>
						INSERT INTO {tableName} (title, status) VALUES (&apos;Test
						Task&apos;, &apos;active&apos;);
					</code>
				</div>
			</div>

			{/* Configuration Info */}
			<div className="mt-4 rounded-lg border bg-gray-50 p-4">
				<h3 className="mb-2 font-medium">Configuration</h3>
				<div className="space-y-1 text-sm">
					<div>
						<strong>Electric URL:</strong>{" "}
						{process.env.NEXT_PUBLIC_ELECTRIC_URL || "Not configured"}
					</div>
					<div>
						<strong>Database:</strong> Railway PostgreSQL
					</div>
					<div>
						<strong>Table:</strong> {tableName}
					</div>
					<div>
						<strong>Real-time:</strong>{" "}
						{isConnected ? "✅ Active" : "❌ Inactive"}
					</div>
				</div>
			</div>
		</div>
	);
}

export default ElectricDemo;
