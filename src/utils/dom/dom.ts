export const El = {
	setAttribute: (el: HTMLElement, name: string, value: string) => {
		//If the attribute already exists, the value is updated; otherwise a new attribute is added with the specified name and value.
		el.setAttribute(name, value);
	},
	removeAttribute: (el: HTMLElement, name: string) => {
		el.removeAttribute(name);
	},
};

export const Win = {
	Timeout: {
		/**
		 * @param win The window to set the timeout on.
		 * @param delay The delay in milliseconds before the callback is invoked.
		 * @param cb The callback function to invoke after the delay.
		 * @param args Additional arguments to pass to the callback.
		 * @returns The timeout ID.
		 */
		set: (win: Window, delay: number, cb: (win: Window) => void, ...args: unknown[]): number => {
			return win.setTimeout(cb, delay, win, ...args);
		},
		clear: (win: Window, id: number) => win.clearTimeout(id),
	},
}
