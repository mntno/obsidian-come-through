import type { AudioProcessorConfig } from "#/renderings/content/processors/AudioProcessor";
import type { BracketProcessorConfig } from "#/renderings/content/processors/BracketProcessor";
import type { HeadingProcessorConfig } from "#/renderings/content/processors/HeadingProcessor";
import type { HtmlElementWrapperProcessorConfig } from "#/renderings/content/processors/HtmlElementWrapperProcessor";

export interface ProcessorConfigProvider {
	audio(): AudioProcessorConfig;
	/** @returns The bracket processor configuration, or null if disabled. */
	bracket(): BracketProcessorConfig | null;
	heading(baseHeadingLevel?: number): HeadingProcessorConfig;
	htmlElementWrapper(): HtmlElementWrapperProcessorConfig;
}
