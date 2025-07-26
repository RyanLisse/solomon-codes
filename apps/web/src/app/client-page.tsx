"use client";

import Navbar from "@/components/navbar";
import TaskForm from "./_components/task-form";
import TaskList from "./_components/task-list";

export default function ClientPage() {
	return (
		<div className="flex h-screen flex-col gap-y-4 px-4 py-2">
			<Navbar />
			<TaskForm />
			<TaskList />
		</div>
	);
}
