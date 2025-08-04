"use client";
import { formatDistanceToNow } from "date-fns";
import {
	Archive,
	ArrowLeft,
	Dot,
	GitBranchPlus,
	GithubIcon,
	Loader,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { createPullRequestAction } from "@/app/actions/vibekit";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/stores/tasks";

interface Props {
	id: string;
}

export default function TaskNavbar({ id }: Props) {
	const [isCreatingPullRequest, setIsCreatingPullRequest] = useState(false);
	const { getTaskById, updateTask } = useTaskStore();
	const task = getTaskById(id);

	const handleCreatePullRequest = useCallback(async () => {
		if (!task) return;

		setIsCreatingPullRequest(true);

		const pr = await createPullRequestAction({ task });

		updateTask(id, {
			pullRequest: pr,
		});

		setIsCreatingPullRequest(false);
	}, [task, id, updateTask]);

	const handleArchiveTask = useCallback(() => {
		if (!task) return;

		updateTask(id, {
			isArchived: !task.isArchived,
		});
	}, [task, id, updateTask]);

	return (
		<div className="flex h-14 items-center justify-between border-b px-4">
			<div className="flex items-center gap-x-2">
				<Link href="/">
					<Button variant="ghost" size="icon">
						<ArrowLeft />
					</Button>
				</Link>
				<div className="h-8 border-r" />
				<div className="ml-4 flex flex-col gap-x-2">
					<h3 className="font-medium">{task?.title}</h3>
					<div className="flex items-center gap-x-0">
						<p className="text-muted-foreground text-sm">
							{task?.createdAt
								? formatDistanceToNow(new Date(task.createdAt), {
										addSuffix: true,
									})
								: "Loading..."}
						</p>
						<Dot className="size-4 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">{task?.repository}</p>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-x-2">
				{task?.isArchived ? (
					<Button
						variant="outline"
						className="rounded-full"
						onClick={handleArchiveTask}
					>
						<Archive />
						Unarchive
					</Button>
				) : (
					<Button
						variant="outline"
						className="rounded-full"
						onClick={handleArchiveTask}
					>
						<Archive />
						Archive
					</Button>
				)}
				{task?.pullRequest?.html_url ? (
					<Link href={task.pullRequest.html_url} target="_blank">
						<Button className="rounded-full">
							<GithubIcon />
							View Pull Request
						</Button>
					</Link>
				) : (
					<Button
						className="rounded-full"
						onClick={handleCreatePullRequest}
						disabled={isCreatingPullRequest}
					>
						{isCreatingPullRequest ? (
							<Loader className="size-4 animate-spin" />
						) : (
							<GitBranchPlus />
						)}
						Create Pull Request
					</Button>
				)}
			</div>
		</div>
	);
}
