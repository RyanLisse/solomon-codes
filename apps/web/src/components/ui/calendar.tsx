"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarProps {
	className?: string;
	selected?: Date;
	onSelect?: (date: Date) => void;
	disabled?: (date: Date) => boolean;
}

function Calendar({
	className,
	selected,
	onSelect,
	disabled,
	...props
}: CalendarProps) {
	const [currentMonth, setCurrentMonth] = React.useState(
		selected || new Date(),
	);

	const daysInMonth = new Date(
		currentMonth.getFullYear(),
		currentMonth.getMonth() + 1,
		0,
	).getDate();

	const firstDayOfMonth = new Date(
		currentMonth.getFullYear(),
		currentMonth.getMonth(),
		1,
	).getDay();

	const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
	const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

	const goToPreviousMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
		);
	};

	const goToNextMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
		);
	};

	const handleDateClick = (day: number) => {
		const date = new Date(
			currentMonth.getFullYear(),
			currentMonth.getMonth(),
			day,
		);
		if (!disabled?.(date)) {
			onSelect?.(date);
		}
	};

	const isSelected = (day: number) => {
		if (!selected) return false;
		return (
			selected.getDate() === day &&
			selected.getMonth() === currentMonth.getMonth() &&
			selected.getFullYear() === currentMonth.getFullYear()
		);
	};

	const isToday = (day: number) => {
		const today = new Date();
		return (
			today.getDate() === day &&
			today.getMonth() === currentMonth.getMonth() &&
			today.getFullYear() === currentMonth.getFullYear()
		);
	};

	return (
		<div className={cn("p-3", className)} {...props}>
			<div className="mb-4 flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					onClick={goToPreviousMonth}
					className="h-7 w-7 p-0"
				>
					<ChevronLeftIcon className="h-4 w-4" />
				</Button>
				<div className="font-medium text-sm">
					{currentMonth.toLocaleDateString("en-US", {
						month: "long",
						year: "numeric",
					})}
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={goToNextMonth}
					className="h-7 w-7 p-0"
				>
					<ChevronRightIcon className="h-4 w-4" />
				</Button>
			</div>
			<div className="mb-2 grid grid-cols-7 gap-1">
				{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
					<div
						key={day}
						className="flex h-9 w-9 items-center justify-center text-center font-medium text-muted-foreground text-sm"
					>
						{day}
					</div>
				))}
			</div>
			<div className="grid grid-cols-7 gap-1">
				{emptyDays.map((_, index) => (
					<div
						key={`empty-${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${index}`}
						className="h-9 w-9"
					/>
				))}
				{days.map((day) => {
					const date = new Date(
						currentMonth.getFullYear(),
						currentMonth.getMonth(),
						day,
					);
					const isDisabled = disabled?.(date);

					return (
						<Button
							key={day}
							variant={isSelected(day) ? "default" : "ghost"}
							size="sm"
							onClick={() => handleDateClick(day)}
							disabled={isDisabled}
							className={cn(
								"h-9 w-9 p-0 font-normal",
								isToday(day) &&
									!isSelected(day) &&
									"bg-accent text-accent-foreground",
								isSelected(day) &&
									"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
							)}
						>
							{day}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
Calendar.displayName = "Calendar";

export { Calendar };
