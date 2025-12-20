import { Arr, Str } from "utils/ts";
import { CssClass } from "utils/obs/constants";

export type CreateElParam<K extends keyof HTMLElementTagNameMap> = {
	/** The tag name of the element to be created. */
	tag: K,
	/** Applies to the wrapped element. */
	o?: DomElementInfo | string,
	/** The wrappers parent. */
	parent: HTMLElement,
	/** Wrapper classes to be added to the wrapper element. */
	wrapperClasses?: string[],
	/** If `true`, the default class for wrappers will not be added to the wrapper's class list. */
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

	const opt: DomElementInfo | undefined = Arr.nonEmpty(wrapperClasses) ? { cls: wrapperClasses } : undefined;

	const wrappedEl = skipWrapperClass ? parent.createDiv(opt) : createElWrapper(
		parent,
		tag,
		opt,
	);
	return wrappedEl.createEl(tag, o, createdCallback);
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

	if (Str.nonEmpty(finalOptions.cls))
		finalOptions.cls = `${clsToAdd} ${finalOptions.cls}`;
	else if (Arr.nonEmpty(finalOptions.cls))
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
export function createElWrapperHtml<K extends keyof HTMLElementTagNameMap>(tag: K, html: string, appendPara = false) {
	if (appendPara)
		return `<div class="${CssClass.wrapperClassForEl("p")}"><p>${html}</p></div>`;
	else
		return `<div class="${CssClass.wrapperClassForEl(tag)}">${html}</div>`;
}

/**
	* Use `element.win` and `element.doc` to get the window/document that your Dom element is located in.
	*
	* `activeWindow`/`Document` refers to the current focused window which might not be the same one your element is in.
	*/
export function getDoc(el: HTMLElement) {
	return el.doc;
}

/** @see {@link getDoc} */
export function getWin(el: HTMLElement) {
	return el.win;
}
