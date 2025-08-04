declare module "mime" {
	export function getType(path: string): string | null;
	export function getExtension(type: string): string | null;
	export function define(mimes: Record<string, string[]>): void;
}
