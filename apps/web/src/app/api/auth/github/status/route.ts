import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		// Get the token from httpOnly cookie
		const token = request.cookies.get("github_access_token")?.value;
		const userCookie = request.cookies.get("github_user")?.value;

		if (!token) {
			return NextResponse.json({
				isAuthenticated: false,
				user: null,
				accessToken: null,
			});
		}

		let user = null;
		try {
			user = userCookie ? JSON.parse(userCookie) : null;
		} catch {
			// Invalid user cookie
		}

		return NextResponse.json({
			isAuthenticated: true,
			user,
			accessToken: token,
		});
	} catch (error) {
		console.error("Error checking auth status:", error);
		return NextResponse.json(
			{
				isAuthenticated: false,
				user: null,
				accessToken: null,
				error: "Failed to check auth status",
			},
			{ status: 500 },
		);
	}
}
