import { Env } from "#/env";
import { ContentRendererProcessor } from "#/renderings/content/processors/bases";
import { ContentRendererPostProcessor, ContentRendererPreProcessor, PostProcessorParameter, PreProcessorParameter } from "#/renderings/content/processors/types";
import { HtmlAttribute, HtmlTag } from "#/utils/dom/constants";
import { Doc, El, Win } from "#/utils/obs/dom";


export type HtmlElementWrapperProcessorConfig = {
	applyLangTagsToNonLatinScripts: boolean;
}

/** Wraps specific HTML elements. */
export class HtmlElementWrapperProcessor extends ContentRendererProcessor<HtmlElementWrapperProcessorConfig> implements ContentRendererPreProcessor, ContentRendererPostProcessor {

	constructor(config: HtmlElementWrapperProcessorConfig) {
		Env.log.proc("HtmlElementWrapperProcessor:constructor");
		super(config);
	}

	public handleMarkdown(param: PreProcessorParameter): void {
		Env.log.proc("HtmlElementWrapperProcessor:handleMarkdown");
		let content = param.markdown;

		content = content.replace(ELEMENT_REGEX, (html, tag) => {
			return El.createWrapper.html(tag, html);
		});

		param.markdown = content;
	}

	handleHtml(param: PostProcessorParameter): void {
		Env.log.proc("HtmlElementWrapperProcessor:handleHtml");
		if (this.config.applyLangTagsToNonLatinScripts)
			HtmlElementWrapperProcessor.applyLangTagsToNonLatinScripts(param);
	}

	/**
	 * Traverses the DOM tree of a given HTML element, finds text nodes containing
	 * consecutive Thai characters, and wraps those character sequences in a
	 * `<span>` element with the `lang="th"` attribute.
	 *
	 * @param param The parameter object containing the HTML element to process.
	 */
	private static applyLangTagsToNonLatinScripts(param: PostProcessorParameter): void {
		Env.log.proc("HtmlElementWrapperProcessor:applyLangTagsToNonLatinScripts");
		const doc = Doc.from(param.el);
		const walker = doc.createTreeWalker(param.el, NodeFilter.SHOW_TEXT, null);
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
				const fragment = Win.createFragment(doc);

				let lastIndex = 0;

				matches.forEach(match => {
					const matchText = match[0];
					const matchIndex = match.index;

					if (matchIndex > lastIndex) {
						const beforeText = text.slice(lastIndex, matchIndex);
						fragment.appendChild(doc.createTextNode(beforeText));
					}

					const span = Win.createEl(doc, HtmlTag.SPAN);
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
