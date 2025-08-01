import { NextResponse } from "next/server";
import { githubAuth } from "@/lib/github";

export async function GET() {
	try {
		const authUrl = githubAuth.getAuthUrl();

		return NextResponse.json({ url: authUrl });
	} catch (error) {
		console.error("Error generating auth URL:", error);
		return NextResponse.json(
			{ error: "Failed to generate auth URL" },
			{ status: 500 },
		);
	}
}
