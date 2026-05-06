// Provided by Obsidian:
// On `Element`: `addClass`, `doc`, `removeClass`, `hasClass`, `toggleClass`, `win`


export const Doc = {
	/** Returns the document that the given element is located in. */
	from: (el: HTMLElement) => el.doc,
}

export const El = {
	setAttribute: (el: HTMLElement, name: string, value: string) => {
		//If the attribute already exists, the value is updated; otherwise a new attribute is added with the specified name and value.
		el.setAttribute(name, value);
	},
	removeAttribute: (el: HTMLElement, name: string) => {
		el.removeAttribute(name);
	},

	Cls: {
		add: (el: HTMLElement | undefined, className: string) => {
			if (el !== undefined && !el.hasClass(className))
				el.addClass(className);
		},
		remove: (el: HTMLElement | undefined, className: string) => {
			if (el !== undefined && el.hasClass(className))
				el.removeClass(className);
		},
		has: (el: HTMLElement | undefined, className: string) => {
			return el !== undefined && el.hasClass(className);
		},
		toggle: (el: HTMLElement | undefined, className: string, value: boolean) => {
			el?.toggleClass(className, value);
		},
	} as const,
} as const;

export const Win = {
	/**
		* Use `element.win` and `element.doc` to get the window/document that your Dom element is located in.
		*
		* `activeWindow`/`Document` refers to the current focused window which might not be the same one your element is in.
		*/
	from: (elOrDoc: HTMLElement | Document) => elOrDoc.win,

	Timeout: {
		/**
		 * @param elOrDoc The element or document to set the timeout on.
		 * @param delay The delay in milliseconds before the callback is invoked.
		 * @param cb The callback function to invoke after the delay.
		 * @param args Additional arguments to pass to the callback.
		 * @returns The timeout ID.
		 */
		set: (elOrDoc: HTMLElement | Document, delay: number, cb: (win: Window) => void, ...args: unknown[]): number => {
			const win = Win.from(elOrDoc);
			return win.setTimeout(cb, delay, win, ...args);
		},
		clear: (elOrDoc: HTMLElement | Document, id: number) => Win.from(elOrDoc).clearTimeout(id),
	},
}
