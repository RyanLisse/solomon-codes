declare module "@testing-library/user-event" {
	interface UserEventOptions {
		delay?: number;
		skipClick?: boolean;
		skipHover?: boolean;
		initialSelectionStart?: number;
		initialSelectionEnd?: number;
	}

	interface UserEvent {
		setup(options?: UserEventOptions): UserEvent;
		click(element: Element, options?: UserEventOptions): Promise<void>;
		dblClick(element: Element, options?: UserEventOptions): Promise<void>;
		type(
			element: Element,
			text: string,
			options?: UserEventOptions,
		): Promise<void>;
		clear(element: Element): Promise<void>;
		selectOptions(element: Element, values: string | string[]): Promise<void>;
		hover(element: Element): Promise<void>;
		unhover(element: Element): Promise<void>;
		upload(element: Element, file: File | File[]): Promise<void>;
		keyboard(input: string): Promise<void>;
		tab(options?: { shift?: boolean }): Promise<void>;
	}

	const userEvent: UserEvent;
	export default userEvent;
}
