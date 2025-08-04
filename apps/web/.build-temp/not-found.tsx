import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center">
			<div className="text-center">
				<h1 className="font-bold text-4xl text-gray-900 dark:text-gray-100">
					404
				</h1>
				<h2 className="mt-2 font-semibold text-2xl text-gray-700 dark:text-gray-300">
					Page Not Found
				</h2>
				<p className="mt-4 text-gray-600 dark:text-gray-400">
					The page you&apos;re looking for doesn&apos;t exist.
				</p>
				<Link
					href="/"
					className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					Go back home
				</Link>
			</div>
		</div>
	);
}
