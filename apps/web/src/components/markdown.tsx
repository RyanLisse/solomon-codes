import { CheckIcon, CopyIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	className?: string;
	children?: ReactNode;
	[key: string]: any;
}

interface MarkdownProps {
	content?: string;
	children?: string;
	className?: string;
}

function CodeBlock({ className, children, ...props }: CodeBlockProps) {
	const { theme } = useTheme();
	const [isCopied, copyToClipboard] = useCopyToClipboard({ timeout: 2000 });
	const match = /language-(\w+)/.exec(className || "");
	const codeContent = String(children).replace(/\n$/, "");

	const handleCopy = () => {
		copyToClipboard(codeContent);
	};

	if (match) {
		return (
			<div className="group relative">
				<div className="absolute top-2 right-2 z-10">
					<Button
						size="sm"
						variant="ghost"
						onClick={handleCopy}
						className="h-8 w-8 border border-border/50 bg-background/80 p-0 backdrop-blur-sm hover:bg-background"
					>
						{isCopied ? (
							<CheckIcon className="h-4 w-4 text-green-500" />
						) : (
							<CopyIcon className="h-4 w-4" />
						)}
					</Button>
				</div>
				<ScrollArea className="max-w-full">
					<div className="px-4 py-2" style={{ maxWidth: "100%" }}>
						<div>
							{/* @ts-expect-error React 18 compatibility - known issue with react-syntax-highlighter types */}
							<SyntaxHighlighter
								language={match[1]}
								style={theme === "dark" ? oneDark : oneLight}
								customStyle={{
									fontSize: "12.5px",
									backgroundColor: "transparent",
									margin: 0,
									padding: "1rem",
									maxWidth: "100%",
									overflow: "hidden",
								}}
								wrapLines
								wrapLongLines
								{...props}
							>
								{codeContent}
							</SyntaxHighlighter>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	return (
		<code
			className={cn(
				"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-semibold text-sm",
				className,
			)}
			{...props}
		>
			{children}
		</code>
	);
}

export function Markdown({ content, children, className }: MarkdownProps) {
	const markdownContent = content || children || "";

	return (
		<Card className={cn("w-full", className)}>
			<CardContent className="p-6">
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					components={{
						code: CodeBlock,
						h1: ({ children }) => (
							<h1 className="mb-4 font-bold text-2xl text-foreground">
								{children}
							</h1>
						),
						h2: ({ children }) => (
							<h2 className="mb-3 font-semibold text-foreground text-xl">
								{children}
							</h2>
						),
						h3: ({ children }) => (
							<h3 className="mb-2 font-medium text-foreground text-lg">
								{children}
							</h3>
						),
						p: ({ children }) => (
							<p className="mb-4 text-muted-foreground text-sm leading-relaxed">
								{children}
							</p>
						),
						ul: ({ children }) => (
							<ul className="mb-4 ml-4 list-disc space-y-1">{children}</ul>
						),
						ol: ({ children }) => (
							<ol className="mb-4 ml-4 list-decimal space-y-1">{children}</ol>
						),
						li: ({ children }) => (
							<li className="text-muted-foreground text-sm">{children}</li>
						),
						blockquote: ({ children }) => (
							<blockquote className="my-4 border-border border-l-4 pl-4 text-muted-foreground italic">
								{children}
							</blockquote>
						),
						a: ({ href, children }) => (
							<a
								href={href}
								className="text-primary underline hover:no-underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{children}
							</a>
						),
						table: ({ children }) => (
							<div className="my-6 w-full overflow-y-auto">
								<table className="w-full border-collapse border border-border">
									{children}
								</table>
							</div>
						),
						thead: ({ children }) => (
							<thead className="bg-muted">{children}</thead>
						),
						tbody: ({ children }) => <tbody>{children}</tbody>,
						tr: ({ children }) => (
							<tr className="border-border border-b">{children}</tr>
						),
						th: ({ children }) => (
							<th className="border-border border-r px-4 py-2 text-left font-medium text-foreground">
								{children}
							</th>
						),
						td: ({ children }) => (
							<td className="border-border border-r px-4 py-2 text-muted-foreground text-sm">
								{children}
							</td>
						),
						strong: ({ children }) => (
							<Badge variant="secondary" className="font-medium">
								{children}
							</Badge>
						),
					}}
				>
					{markdownContent}
				</ReactMarkdown>
			</CardContent>
		</Card>
	);
}
