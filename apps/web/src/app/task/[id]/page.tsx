"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TaskClientPage from "./client-page";

// Force dynamic rendering - disable static generation
export const dynamic = "force-dynamic";

export default function TaskPage() {
	const [isMounted, setIsMounted] = useState(false);
	const params = useParams();
	const id = params?.id as string;

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-e-transparent border-solid align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite]" />
			</div>
		);
	}

	return <TaskClientPage id={id} />;
}
