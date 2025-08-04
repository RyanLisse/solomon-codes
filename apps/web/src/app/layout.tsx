import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import "./streaming.css";

// Force dynamic rendering for all pages to prevent ReactCurrentOwner errors
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { QueryProvider } from "@/components/providers/query-provider";
import { InstallBanner } from "@/components/pwa/install-button";
import { UpdateToast } from "@/components/pwa/update-notification";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PWAProvider } from "@/lib/pwa/pwa-provider";
import Container from "./container";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Solomon Codes | Advanced Automation Platform",
	description:
		"Solomon Codes is a modern, intelligent automation platform for streamlined task management and execution.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<QueryProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<PWAProvider autoRegister={true} checkUpdateInterval={30000}>
							<SidebarProvider>
								<Container>{children}</Container>
								<UpdateToast />
								<InstallBanner />
							</SidebarProvider>
						</PWAProvider>
					</ThemeProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
