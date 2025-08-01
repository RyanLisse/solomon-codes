import { Dot } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Navbar() {
	return (
		<div className="flex items-center justify-between">
			<Link href="/" passHref>
				<h1 className="font-bold text-lg">VibeX</h1>
			</Link>
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-0">
					<Link
						href="/"
						className="transition-opacity duration-300 hover:opacity-45"
					>
						Home
					</Link>
					<Dot className="text-muted-foreground/40" />
					<Link
						href="/environments"
						className="transition-opacity duration-300 hover:opacity-45"
					>
						Environments
					</Link>
				</div>
				<ThemeToggle />
			</div>
		</div>
	);
}
