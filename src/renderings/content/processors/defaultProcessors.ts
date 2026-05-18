import { AudioProcessor } from "#/renderings/content/processors/AudioProcessor";
import { BracketProcessor } from "#/renderings/content/processors/BracketProcessor";
import { HtmlElementWrapperProcessor } from "#/renderings/content/processors/HtmlElementWrapperProcessor";
import { LinkProcessor } from "#/renderings/content/processors/LinkProcessor";
import { VideoProcessor } from "#/renderings/content/processors/VideoProcessor";
import type { ContentRendererProcessor } from "#/renderings/content/processors/bases";
import type { ProcessorConfigProvider } from "#/renderings/content/ProcessorConfigProvider";

export function defaultProcessors(provider: ProcessorConfigProvider): ContentRendererProcessor[] {
	const result: ContentRendererProcessor[] = [
		new HtmlElementWrapperProcessor(provider.htmlElementWrapper()),
		new LinkProcessor(),
		new AudioProcessor(provider.audio()),
		new VideoProcessor(),
	];

	const bracketConfig = provider.bracket();
	if (bracketConfig !== null)
		result.push(new BracketProcessor(bracketConfig));

	return result;
}
