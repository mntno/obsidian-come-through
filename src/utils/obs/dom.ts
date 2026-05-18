import { Arr, Str } from "#/utils/ts";
import { CssClass } from "#/utils/obs/constants";

export type CreateElParam<K extends keyof HTMLElementTagNameMap> = {
	/** The tag name of the element to be created. */
	tag: K,
	/** Applies to the wrapped element. */
	o?: DomElementInfo | string,
	/** The wrapper's parent. */
	parent: HTMLElement,
	/** Wrapper classes to be added to the wrapper element. */
	wrapperClasses?: string[],
	/** If `true`, the default CSS class for wrappers will not be added to the wrapper's class list. */
	skipWrapperClass?: boolean,
	/** Callback to be executed after the element is created. */
	createdCallback?: (el: HTMLElementTagNameMap[K]) => void,
};

export function createWrappedEl<K extends keyof HTMLElementTagNameMap>(options: CreateElParam<K>): HTMLElementTagNameMap[K] {

	const {
		tag,
		o,
		parent,
		wrapperClasses,
		skipWrapperClass = false,
		createdCallback,
	} = options;

	const opt: DomElementInfo | undefined = Arr.isNonEmpty(wrapperClasses) ? { cls: wrapperClasses } : undefined;

	const wrappedEl = skipWrapperClass ? parent.createDiv(opt) : createElWrapper(
		parent,
		tag,
		opt,
	);
	return El.create(wrappedEl, tag, o, createdCallback);
}

/**
	* Mimics how Obsidian/CodeMirror adds wrapper elements. For example, a `<p>` is wrapped with `<div class="el-p">`.
	*
	* @param appendPara Sometimes a `<p>` is added as an additional child; for example, if the second starting tag after the first is on the same line as the first. This param serves as documentation of this behavior, which is considered abnormal.
	* @returns A created wrapper element for the given {@link tag} (the actual wrapped element needs to be created separately).
	*/
export function createElWrapper<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, o?: DomElementInfo, appendPara = false) {
	const clsToAdd = CssClass.wrapperClassForEl(appendPara ? "p" : tag);
	const finalOptions: DomElementInfo = o ? { ...o } : {};

	if (Str.isNonEmpty(finalOptions.cls))
		finalOptions.cls = `${clsToAdd} ${finalOptions.cls}`;
	else if (Arr.isNonEmpty(finalOptions.cls))
		finalOptions.cls = [clsToAdd, ...finalOptions.cls];
	else
		finalOptions.cls = clsToAdd;


	if (appendPara) {
		// If the second starting tag after the first is on the same line as the first (e.g., <audio ..></audio> or <audio ..><source ..>\n</audio>),
		// it's wrapped `<div class="el-p"><p dir="auto">`;
		// otherwise `<div class="el-tagname">`.
		//
		// Nevertheless, it's always wrapped in a div.
		// - audio, video, blockquote, p, pre, details, ...
		return parent.createDiv(finalOptions).createEl("p", { attr: { dir: "auto" } });
	} else {
		return parent.createDiv(finalOptions);
	}
}

export const Doc = {
	/** Returns the document that the given element is located in. */
	from: (el: HTMLElement) => el.doc,
}

export const El = {

	/**
	 * This is the string-based version of {@link createElWrapper}. It mimics how
	 * Obsidian/CodeMirror wraps elements in a classed `<div>`. For example, an
	 * `<audio>` tag string would be returned wrapped in a `<div class="el-audio">`.
	 *
	 * @param tag The tag name at the root of {@link html}.
	 * @param html The HTML string to wrap.
	 * @param appendPara See {@link createElWrapper}.
	 * @returns The wrapped HTML string.
	 */
	createWrapper: {
		html: <K extends keyof HTMLElementTagNameMap>(tag: K, html: string, appendPara = false) => {
			if (appendPara)
				return `<div class="${CssClass.wrapperClassForEl("p")}"><p>${html}</p></div>`;
			else
				return `<div class="${CssClass.wrapperClassForEl(tag)}">${html}</div>`;
		},
	},

	/**
	 * Uses Obsidian methods for 'div', 'span', and 'svg'
	 *
	 * ```
	 * interface Node {
	 *    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
	 *    createDiv(o?: DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
	 *    createSpan(o?: DomElementInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
	 *    createSvg<K extends keyof SVGElementTagNameMap>(tag: K, o?: SvgElementInfo | string, callback?: (el: SVGElementTagNameMap[K]) => void): SVGElementTagNameMap[K];
	 * }
	 * ```
	 */
	create: <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, o?: DomElementInfo | string, createdCallback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] => {
		let el: HTMLElement;

		if (tag === "div") {
			el = parent.createDiv(o, createdCallback as (el: HTMLDivElement) => void);
		} else if (tag === "span") {
			el = parent.createSpan(o, createdCallback as (el: HTMLSpanElement) => void);
		} else if (tag as string === "svg") {
			throw new Error("SVG is not implemented");
		} else {
			el = parent.createEl(tag, o, createdCallback);
		}

		return el as HTMLElementTagNameMap[K];
	},

	/**
	 * Provided by Obsidian:
	 * On `Element`: `addClass`, `doc`, `removeClass`, `hasClass`, `toggleClass`, `win`
	 */
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
	},
};

declare global {
	interface Window {
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
		//createDiv(o?: DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
		//createSpan(o?: DomElementInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
		//createSvg<K extends keyof SVGElementTagNameMap>(tag: K, o?: SvgElementInfo | string, callback?: (el: SVGElementTagNameMap[K]) => void): SVGElementTagNameMap[K];
		createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment;
	}
}

export const Win = {
	/**
		* Use `element.win` and `element.doc` to get the window/document that your Dom element is located in.
		*
		* `activeWindow`/`Document` refers to the current focused window which might not be the same one your element is in.
		*/
	from: (elOrDoc: HTMLElement | Document) => elOrDoc.win,

	/** warning  Use 'doc.win.createFragment()' instead of 'doc.createDocumentFragment()' obsidianmd/prefer-create-el */
	createFragment: (elOrDoc: HTMLElement | Document) => Win.from(elOrDoc).createFragment(),

	/** obsidianmd/prefer-create-el */
	createEl: <K extends keyof HTMLElementTagNameMap>(elOrDoc: HTMLElement | Document, tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void) => Win.from(elOrDoc).createEl(tag, o, callback),
}
