import { MarkupAssistant } from "renderings/MarkupAssistant";
import { ContentRendererPreProcessor, ContentRendererProcessor, PreProcessorParameter } from "./ContentRendererProcessor";

/**
 * - Add `|x` to match on more elements.
 * - Matches both self-closing tags (with a <a />) and and normal closing.
 */
const ELEMENT_REGEX = /<(audio|video)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi;

/**
 * Processes inline HTML in the markdown string.
 */
export class HtmlElementWrapperProcessor extends ContentRendererProcessor implements ContentRendererPreProcessor {
	public handleMarkdown(param: PreProcessorParameter): void {
		param.markdown = param.markdown.replace(ELEMENT_REGEX, (html, tag) => {
			return MarkupAssistant.createElWrapperHtml(tag, html);
		});
	}
}
