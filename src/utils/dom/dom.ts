// Provided by Obsidian:
// On `Element`: `addClass`, `doc`, `removeClass`, `hasClass`, `toggleClass`, `win`


export const Doc = {
	/** Returns the document that the given element is located in. */
	get: (el: HTMLElement) => el.doc,
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
	get: (el: HTMLElement) => el.win,
}
