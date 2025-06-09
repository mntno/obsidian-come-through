export class MarkupAssistant {

	public static createWrappedPara(parent: HTMLElement, o?: DomElementInfo | string, callback?: (el: HTMLParagraphElement) => void): HTMLParagraphElement {
		return MarkupAssistant.createElWrapper(parent, "p", false).createEl("p", o, callback);
	}

	public static createWrappedEl<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
		return MarkupAssistant.createElWrapper(parent, tag).createEl(tag, o, callback);
	}

	/**
		* Mimics how Obsidian/CodeMirror adds wrapper elements. For example, a `<p>` is wrapped with `<div class="el-p">`.
		*
		* @param appendPara Sometimes a `<p>` is added as an additional child; for example, if the second starting tag after the first is on the same line as the first. This param serves as documentation of this behavior, which is considered abnormal.
		* @returns A created wrapper element for the given {@link tag}.
		*/
	public static createElWrapper<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, appendPara = false) {

		// If the second starting tag after the first is on the same line as the first (e.g., <audio ..></audio> or <audio ..><source ..>\n</audio>),
		// it's wrapped `<div class="el-p"><p dir="auto">`;
		// otherwise `<div class="el-tagname">`.
		//
		// Nevertheless, it's always wrapped in a div.
		// - audio, video, blockquote, p, pre, details, ...

		if (appendPara)
			return MarkupAssistant.createWrappedPara(parent, { attr: { dir: "auto" } });
		else
			return parent.createDiv({ cls: MarkupAssistant.classForEl(tag) });
	}

	/**
	 * @param tag The tag name at the root of {@link html}.
	 * @param html The HTML string to wrap.
	 * @param appendPara See {@link createElWrapper}.
	 * @returns
	 */
	public static createElWrapperHtml<K extends keyof HTMLElementTagNameMap>(tag: K, html: string, appendPara = false) {
		if (appendPara)
			return `<div class="${MarkupAssistant.classForEl("p")}"><p>${html}</p></div>`;
		else
			return `<div class="${MarkupAssistant.classForEl(tag)}">${html}</div>`;
	}

	public static classForEl<K extends keyof HTMLElementTagNameMap>(tag: K) {
		return "el-" + tag;
	}
}
