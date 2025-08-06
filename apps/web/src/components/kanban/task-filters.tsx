"use client";

import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { CalendarIcon, Filter, RotateCcw, Search, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/stores/tasks";

interface TaskFiltersProps {
	filters: {
		projectId?: string;
		labels?: string[];
		priority?: TaskPriority;
		status?: TaskStatus;
		reviewStatus?: "pending" | "approved" | "rejected" | "needs_changes";
		dateRange?: { start: string; end: string };
	};
	onFiltersChange: (filters: TaskFiltersProps["filters"]) => void;
	projectId?: string;
}

const PRIORITY_OPTIONS = [
	{ value: "low", label: "Low Priority" },
	{ value: "medium", label: "Medium Priority" },
	{ value: "high", label: "High Priority" },
	{ value: "urgent", label: "Urgent Priority" },
];

const STATUS_OPTIONS = [
	{ value: "IN_PROGRESS", label: "In Progress" },
	{ value: "DONE", label: "Done" },
	{ value: "MERGED", label: "Merged" },
];

const REVIEW_STATUS_OPTIONS = [
	{ value: "pending", label: "Pending Review" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "needs_changes", label: "Needs Changes" },
];

const DATE_PRESETS = [
	{
		label: "Today",
		value: () => ({
			start: startOfDay(new Date()).toISOString(),
			end: endOfDay(new Date()).toISOString(),
		}),
	},
	{
		label: "Last 7 days",
		value: () => ({
			start: startOfDay(subDays(new Date(), 7)).toISOString(),
			end: endOfDay(new Date()).toISOString(),
		}),
	},
	{
		label: "Last 30 days",
		value: () => ({
			start: startOfDay(subDays(new Date(), 30)).toISOString(),
			end: endOfDay(new Date()).toISOString(),
		}),
	},
	{
		label: "Last 90 days",
		value: () => ({
			start: startOfDay(subDays(new Date(), 90)).toISOString(),
			end: endOfDay(new Date()).toISOString(),
		}),
	},
];

export function TaskFilters({
	filters,
	onFiltersChange,
	_projectId,
}: TaskFiltersProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [newLabel, setNewLabel] = useState("");
	const [dateRange, setDateRange] = useState<{
		from: Date | undefined;
		to: Date | undefined;
	}>({
		from: filters.dateRange ? new Date(filters.dateRange.start) : undefined,
		to: filters.dateRange ? new Date(filters.dateRange.end) : undefined,
	});

	// Projects store not needed in current implementation

	const clearAllFilters = () => {
		onFiltersChange({});
		setSearchTerm("");
		setNewLabel("");
		setDateRange({ from: undefined, to: undefined });
	};

	const updateFilter = (key: string, value: unknown) => {
		onFiltersChange({
			...filters,
			[key]: value,
		});
	};

	const addLabel = () => {
		if (newLabel.trim() && !filters.labels?.includes(newLabel.trim())) {
			updateFilter("labels", [...(filters.labels || []), newLabel.trim()]);
			setNewLabel("");
		}
	};

	const removeLabel = (labelToRemove: string) => {
		updateFilter(
			"labels",
			filters.labels?.filter((label) => label !== labelToRemove) || [],
		);
	};

	const handleDateRangeChange = (
		range:
			| {
					from: Date | undefined;
					to: Date | undefined;
			  }
			| undefined,
	) => {
		if (!range) {
			setDateRange({ from: undefined, to: undefined });
			updateFilter("dateRange", undefined);
			return;
		}
		setDateRange(range);
		if (range.from && range.to) {
			updateFilter("dateRange", {
				start: startOfDay(range.from).toISOString(),
				end: endOfDay(range.to).toISOString(),
			});
		} else {
			updateFilter("dateRange", undefined);
		}
	};

	const applyDatePreset = (preset: { start: string; end: string }) => {
		const fromDate = new Date(preset.start);
		const toDate = new Date(preset.end);
		setDateRange({ from: fromDate, to: toDate });
		updateFilter("dateRange", preset);
	};

	const hasActiveFilters = () => {
		return (
			filters.priority ||
			filters.status ||
			filters.reviewStatus ||
			(filters.labels && filters.labels.length > 0) ||
			filters.dateRange ||
			searchTerm
		);
	};

	return (
		<div className="space-y-4">
			{/* Search and Quick Actions */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search tasks..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-9"
					/>
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={clearAllFilters}
					disabled={!hasActiveFilters()}
					className="flex items-center gap-2"
				>
					<RotateCcw className="h-4 w-4" />
					Clear All
				</Button>
			</div>

			{/* Filter Controls Grid */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{/* Priority Filter */}
				<div className="space-y-2">
					<Label className="font-medium text-sm">Priority</Label>
					<Select
						value={filters.priority || ""}
						onValueChange={(value) =>
							updateFilter("priority", value || undefined)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="All priorities" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All priorities</SelectItem>
							{PRIORITY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Status Filter */}
				<div className="space-y-2">
					<Label className="font-medium text-sm">Status</Label>
					<Select
						value={filters.status || ""}
						onValueChange={(value) =>
							updateFilter("status", value || undefined)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All statuses</SelectItem>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Review Status Filter */}
				<div className="space-y-2">
					<Label className="font-medium text-sm">Review Status</Label>
					<Select
						value={filters.reviewStatus || ""}
						onValueChange={(value) =>
							updateFilter("reviewStatus", value || undefined)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="All review statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">All review statuses</SelectItem>
							{REVIEW_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Date Range Filter */}
				<div className="space-y-2">
					<Label className="font-medium text-sm">Date Range</Label>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn(
									"w-full justify-start text-left font-normal",
									!dateRange.from && "text-muted-foreground",
								)}
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{dateRange.from ? (
									dateRange.to ? (
										<>
											{format(dateRange.from, "LLL dd, y")} -{" "}
											{format(dateRange.to, "LLL dd, y")}
										</>
									) : (
										format(dateRange.from, "LLL dd, y")
									)
								) : (
									<span>Pick a date range</span>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<div className="border-b p-3">
								<div className="space-y-2">
									<p className="font-medium text-sm">Quick presets</p>
									<div className="grid grid-cols-2 gap-2">
										{DATE_PRESETS.map((preset) => (
											<Button
												key={preset.label}
												variant="outline"
												size="sm"
												onClick={() => applyDatePreset(preset.value())}
											>
												{preset.label}
											</Button>
										))}
									</div>
								</div>
							</div>
							<div className="space-y-4">
								<div>
									<Label>From Date</Label>
									<Calendar
										selected={dateRange.from}
										onSelect={(date) =>
											handleDateRangeChange({
												from: date,
												to: dateRange.to,
											})
										}
									/>
								</div>
								<div>
									<Label>To Date</Label>
									<Calendar
										selected={dateRange.to}
										onSelect={(date) =>
											handleDateRangeChange({
												from: dateRange.from,
												to: date,
											})
										}
									/>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Labels Filter */}
			<div className="space-y-3">
				<Label className="font-medium text-sm">Labels</Label>

				{/* Existing Labels */}
				{filters.labels && filters.labels.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{filters.labels.map((label) => (
							<Badge
								key={label}
								variant="secondary"
								className="flex items-center gap-1 px-2 py-1"
							>
								<Filter className="h-3 w-3" />
								{label}
								<Button
									variant="ghost"
									size="sm"
									className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
									onClick={() => removeLabel(label)}
								>
									<X className="h-2 w-2" />
								</Button>
							</Badge>
						))}
					</div>
				)}

				{/* Add Label Input */}
				<div className="flex gap-2">
					<Input
						value={newLabel}
						onChange={(e) => setNewLabel(e.target.value)}
						onKeyPress={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addLabel();
							}
						}}
						placeholder="Add label filter..."
						className="flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={addLabel}
						disabled={!newLabel.trim()}
					>
						Add
					</Button>
				</div>
			</div>

			{/* Active Filters Summary */}
			{hasActiveFilters() && (
				<div className="border-t pt-3">
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<Filter className="h-4 w-4" />
						<span>
							{[
								filters.priority && `Priority: ${filters.priority}`,
								filters.status && `Status: ${filters.status}`,
								filters.reviewStatus && `Review: ${filters.reviewStatus}`,
								filters.labels?.length && `Labels: ${filters.labels.length}`,
								filters.dateRange && "Date range",
								searchTerm && "Search term",
							]
								.filter(Boolean)
								.join(" • ")}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
