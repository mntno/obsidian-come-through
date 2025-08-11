import { MarkupAssistant } from "renderings/MarkupAssistant";
import { ContentRendererPreProcessor, ContentRendererProcessor, PreProcessorParameter } from "./ContentRendererProcessor";


export type HtmlElementWrapperProcessorConfig = {
	applyLangTagsToNonLatinScripts: boolean;
}

/**
 * Processes inline HTML in the markdown string.
 */
export class HtmlElementWrapperProcessor extends ContentRendererProcessor implements ContentRendererPreProcessor {

	private config: HtmlElementWrapperProcessorConfig;

	constructor(config: HtmlElementWrapperProcessorConfig) {
		super();
		this.config = config;
	}

	public handleMarkdown(param: PreProcessorParameter): void {
		let content = param.markdown;

		content = content.replace(ELEMENT_REGEX, (html, tag) => {
			return MarkupAssistant.createElWrapperHtml(tag, html);
		});

		if (this.config.applyLangTagsToNonLatinScripts)
			content = this.applyLangTagsToNonLatinScripts(content)

		param.markdown = content;
	}

	private applyLangTagsToNonLatinScripts(content: string) {
		return content.replace(THAI_REGEX, (match) => `<span lang="th">${match}</span>`);
	}
}

/**
 * - Add `|x` to match on more elements.
 * - Matches both self-closing tags (with a <a />) and and normal closing.
 */
const ELEMENT_REGEX = /<(audio|video)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi;

/**
 * - Matches consecutive Thai characters.
 */
const THAI_REGEX = /[\u0E00-\u0E7F]+/g;
