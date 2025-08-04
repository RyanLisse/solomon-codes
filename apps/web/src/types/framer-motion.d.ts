declare module "framer-motion" {
	import { ComponentType, ReactNode } from "react";

	export type MotionValue = string | number;
	export type MotionTransition = {
		duration?: number;
		delay?: number;
		ease?: string | number[];
		type?: "spring" | "tween" | "keyframes" | "inertia";
		stiffness?: number;
		damping?: number;
		mass?: number;
		repeat?: number;
		repeatType?: "loop" | "reverse" | "mirror";
		repeatDelay?: number;
	};

	export type VariantLabels = string | string[];
	export type MotionStyleProperties = {
		x?: MotionValue;
		y?: MotionValue;
		scale?: MotionValue;
		rotate?: MotionValue;
		opacity?: MotionValue;
		backgroundColor?: string;
		backgroundPosition?: string;
		backgroundSize?: string;
		color?: string;
		width?: MotionValue;
		height?: MotionValue;
		[key: string]: MotionValue | string | MotionTransition | undefined;
	};
	export type MotionVariants = Record<
		string,
		MotionStyleProperties & {
			transition?: MotionTransition;
		}
	>;

	export interface MotionProps {
		initial?: boolean | VariantLabels | MotionStyleProperties;
		animate?: VariantLabels | MotionStyleProperties;
		exit?: VariantLabels | MotionStyleProperties;
		transition?: MotionTransition;
		className?: string;
		children?: ReactNode;
		style?: React.CSSProperties;
		variants?: MotionVariants;
		whileHover?: VariantLabels | MotionStyleProperties;
		whileTap?: VariantLabels | MotionStyleProperties;
		whileFocus?: VariantLabels | MotionStyleProperties;
		whileInView?: VariantLabels | MotionStyleProperties;
	}

	type MotionComponentProps<T> = MotionProps & T;

	export const motion: {
		div: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLDivElement>>
		>;
		span: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLSpanElement>>
		>;
		button: ComponentType<
			MotionComponentProps<React.ButtonHTMLAttributes<HTMLButtonElement>>
		>;
		a: ComponentType<
			MotionComponentProps<React.AnchorHTMLAttributes<HTMLAnchorElement>>
		>;
		img: ComponentType<
			MotionComponentProps<React.ImgHTMLAttributes<HTMLImageElement>>
		>;
		p: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLParagraphElement>>
		>;
		h1: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLHeadingElement>>
		>;
		h2: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLHeadingElement>>
		>;
		h3: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLHeadingElement>>
		>;
		ul: ComponentType<
			MotionComponentProps<React.HTMLAttributes<HTMLUListElement>>
		>;
		li: ComponentType<
			MotionComponentProps<React.LiHTMLAttributes<HTMLLIElement>>
		>;
		[key: string]: ComponentType<MotionComponentProps<Record<string, unknown>>>;
	} & (<T extends keyof JSX.IntrinsicElements | ComponentType<unknown>>(
		component: T,
	) => ComponentType<
		MotionProps &
			(T extends keyof JSX.IntrinsicElements
				? JSX.IntrinsicElements[T]
				: T extends ComponentType<infer P>
					? P
					: Record<string, unknown>)
	>);

	export const AnimatePresence: ComponentType<{
		children?: ReactNode;
		mode?: "wait" | "sync" | "popLayout";
		initial?: boolean;
		onExitComplete?: () => void;
	}>;
}
