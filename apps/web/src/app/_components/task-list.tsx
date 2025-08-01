"use client";
import { formatDistanceToNow } from "date-fns";
import { Archive, Check, Dot, Loader, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { useArchiveTask, useDeleteTask, useTasks } from "@/hooks/use-tasks";

export default function TaskList() {
	const [isHydrated, setIsHydrated] = useState(false);
	const { data: activeTasks = [], isLoading: activeLoading } = useTasks({
		archived: false,
	});
	const { data: archivedTasks = [], isLoading: archivedLoading } = useTasks({
		archived: true,
	});
	const archiveTaskMutation = useArchiveTask();
	const deleteTaskMutation = useDeleteTask();

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	return (
		<div className="mx-auto w-full max-w-3xl rounded-lg bg-muted p-1">
			<Tabs defaultValue="active">
				<TabsList>
					<TabsTrigger value="active">
						<Check />
						Tasks
					</TabsTrigger>
					<TabsTrigger value="archived">
						<Archive />
						Archive
					</TabsTrigger>
				</TabsList>
				<TabsContent value="active">
					<div className="flex flex-col gap-1">
						{!isHydrated || activeLoading ? (
							<div className="flex items-center gap-2 p-2 text-muted-foreground">
								<Loader className="h-4 w-4 animate-spin" />
								Loading tasks...
							</div>
						) : activeTasks.length === 0 ? (
							<p className="p-2 text-muted-foreground">No active tasks yet.</p>
						) : (
							activeTasks.map((task) => (
								<div
									key={task.id}
									className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-sidebar"
								>
									<Link href={`/task/${task.id}`} className="flex-1">
										<div>
											<div className="flex items-center gap-x-2">
												{task.hasChanges && (
													<div className="size-2 rounded-full bg-blue-500 " />
												)}
												<h3 className="font-medium">{task.title}</h3>
											</div>
											{task.status === "IN_PROGRESS" ? (
												<div>
													<TextShimmer className="text-sm">
														{`${
															task.statusMessage || "Working on your task"
														}...`}
													</TextShimmer>
												</div>
											) : (
												<div className="flex items-center gap-0">
													<p className="text-muted-foreground text-sm">
														{task.createdAt
															? formatDistanceToNow(new Date(task.createdAt), {
																	addSuffix: true,
																})
															: "Just now"}
													</p>
													<Dot className="size-4 text-muted-foreground" />
													<p className="text-muted-foreground text-sm">
														{task.repository}
													</p>
												</div>
											)}
										</div>
									</Link>
									{task.status === "DONE" && (
										<Button
											variant="outline"
											size="icon"
											onClick={() => archiveTaskMutation.mutate(task.id)}
											disabled={archiveTaskMutation.isPending}
										>
											{archiveTaskMutation.isPending ? (
												<Loader className="h-4 w-4 animate-spin" />
											) : (
												<Archive />
											)}
										</Button>
									)}
								</div>
							))
						)}
					</div>
				</TabsContent>
				<TabsContent value="archived">
					<div className="flex flex-col gap-1">
						{!isHydrated || archivedLoading ? (
							<div className="flex items-center gap-2 p-2 text-muted-foreground">
								<Loader className="h-4 w-4 animate-spin" />
								Loading archived tasks...
							</div>
						) : archivedTasks.length === 0 ? (
							<p className="p-2 text-muted-foreground">
								No archived tasks yet.
							</p>
						) : (
							archivedTasks.map((task) => (
								<div
									key={task.id}
									className="flex items-center justify-between rounded-lg border bg-background p-4"
								>
									<div>
										<h3 className="font-medium text-muted-foreground">
											{task.title}
										</h3>
										<p className="text-muted-foreground text-sm">
											Status: {task.status} • Branch: {task.branch}
										</p>
									</div>
									<Button
										variant="outline"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											deleteTaskMutation.mutate(task.id);
										}}
										disabled={deleteTaskMutation.isPending}
									>
										{deleteTaskMutation.isPending ? (
											<Loader className="h-4 w-4 animate-spin" />
										) : (
											<Trash2 />
										)}
									</Button>
								</div>
							))
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
