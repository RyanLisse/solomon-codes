"use client";

import { useEffect, useState } from "react";
import ClientPage from "./client-page";

// Force dynamic rendering - disable static generation
export const dynamic = "force-dynamic";

export default function Home() {
	const [isMounted, setIsMounted] = useState(false);

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

	return <ClientPage />;
}
