import { HtmlAttribute, HtmlTag } from "utils/dom/constants";
import { createElWrapperHtml } from "utils/obs/dom";
import { ContentRendererPostProcessor, ContentRendererPostProcessorAssistant, ContentRendererPreProcessor, ContentRendererProcessor, PostProcessorParameter, PreProcessorParameter } from "./ContentRendererProcessor";
import { Env } from "env";


export type HtmlElementWrapperProcessorConfig = {
	applyLangTagsToNonLatinScripts: boolean;
}

/** Wraps specific HTML elements. */
export class HtmlElementWrapperProcessor extends ContentRendererProcessor implements ContentRendererPreProcessor, ContentRendererPostProcessor {

	private config: HtmlElementWrapperProcessorConfig;

	constructor(config: HtmlElementWrapperProcessorConfig) {
		Env.log.d("HtmlElementWrapperProcessor:constructor");
		super();
		this.config = config;
	}

	public handleMarkdown(param: PreProcessorParameter): void {
		Env.log.d("HtmlElementWrapperProcessor:handleMarkdown");
		let content = param.markdown;

		content = content.replace(ELEMENT_REGEX, (html, tag) => {
			return createElWrapperHtml(tag, html);
		});

		param.markdown = content;
	}

	handleHtml(param: PostProcessorParameter): void {
		Env.log.d("HtmlElementWrapperProcessor:handleHtml");
		const assistant = new ContentRendererPostProcessorAssistant(param);
		if (this.config.applyLangTagsToNonLatinScripts)
			this.applyLangTagsToNonLatinScripts(assistant);
	}

	/**
	 * Traverses the DOM tree of a given HTML element, finds text nodes containing
	 * consecutive Thai characters, and wraps those character sequences in a
	 * `<span>` element with the `lang="th"` attribute.
	 *
	 * @param element The root HTMLElement to start the traversal from.
	 */
	private applyLangTagsToNonLatinScripts(assistant: ContentRendererPostProcessorAssistant): void {
		Env.log.d("HtmlElementWrapperProcessor:applyLangTagsToNonLatinScripts");
		const doc = assistant.doc;
		const walker = doc.createTreeWalker(assistant.el, NodeFilter.SHOW_TEXT, null);
		const textNodes: Node[] = [];

		let node;
		while ((node = walker.nextNode()))
			textNodes.push(node)

		const SCRIPT = "SCRIPT";
		const STYLE = "STYLE";
		const SPAN = "SPAN";
		textNodes.forEach(textNode => {
			const parentElement = textNode.parentElement;
			if (!parentElement)
				return;

			const text = textNode.textContent;
			if (!text)
				return;

			if (parentElement.tagName === SCRIPT || parentElement.tagName === STYLE)
				return;

			if (parentElement.tagName === SPAN && parentElement.getAttribute(HtmlAttribute.Lang.NAME) === HtmlAttribute.Lang.Values.THAI)
				return;

			const matches = [...text.matchAll(THAI_REGEX)];

			if (matches.length > 0) {
				const fragment = doc.createDocumentFragment();

				let lastIndex = 0;

				matches.forEach(match => {
					const matchText = match[0];
					const matchIndex = match.index!;

					if (matchIndex > lastIndex) {
						const beforeText = text.slice(lastIndex, matchIndex);
						fragment.appendChild(doc.createTextNode(beforeText));
					}

					const span = doc.createElement(HtmlTag.SPAN);
					span.setAttribute(HtmlAttribute.Lang.NAME, HtmlAttribute.Lang.Values.THAI);
					span.textContent = matchText;
					fragment.appendChild(span);

					lastIndex = matchIndex + matchText.length;
				});

				if (lastIndex < text.length) {
					const remainingText = text.slice(lastIndex);
					fragment.appendChild(doc.createTextNode(remainingText));
				}

				parentElement.replaceChild(fragment, textNode);
			}
		});
	}
}

/**
 * - Add `|x` to match on more elements.
 * - Matches both self-closing tags (with a <a />) and and normal closing.
 */
const ELEMENT_REGEX = /<(audio|video)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi;

/** Matches consecutive Thai characters. */
const THAI_REGEX = /[\u0E00-\u0E7F]+/g;
