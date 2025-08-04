/**
 * React 19 Compatibility Types
 * Fixes type conflicts between React 19 and UI component libraries
 */

declare global {
	namespace React {
		// Ensure React.RefObject is compatible with different React versions
		interface RefObject<T> {
			readonly current: T | null;
		}

		// Ensure JSX component compatibility
		type ComponentPropsWithoutRef<
			T extends
				| keyof JSX.IntrinsicElements
				| React.JSXElementConstructor<unknown>,
		> = T extends React.JSXElementConstructor<infer P>
			? P extends React.ComponentPropsWithRef<unknown>
				? Omit<P, "ref">
				: P
			: T extends keyof JSX.IntrinsicElements
				? JSX.IntrinsicElements[T]
				: Record<string, unknown>;

		// Fix children prop for React 19
		interface PropsWithChildren<_P = Record<string, unknown>> {
			children?: React.ReactNode | undefined;
		}

		// Ensure proper component typing for forwardRef components
		type ForwardRefExoticComponent<P> = React.ForwardRefExoticComponent<
			P & React.RefAttributes<unknown>
		>;
	}

	// Fix Lucide React icon types to be compatible with React 19
	namespace LucideReact {
		interface LucideProps extends React.SVGProps<SVGSVGElement> {
			size?: string | number;
			strokeWidth?: string | number;
			absoluteStrokeWidth?: boolean;
		}

		type LucideIcon = React.ForwardRefExoticComponent<
			Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
		>;
	}
}

// Re-export to ensure module compatibility
export {};
