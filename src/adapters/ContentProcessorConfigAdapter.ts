import { ProcessorConfigProvider as AbstractProcessorConfigProvider } from "#/renderings/content/ProcessorConfigProvider";
import type { AudioProcessorConfig } from "#/renderings/content/processors/AudioProcessor";
import type { BracketProcessorConfig } from "#/renderings/content/processors/BracketProcessor";
import { type BracketToken } from "#/renderings/content/processors/BracketProcessor";
import type { HeadingProcessorConfig } from "#/renderings/content/processors/HeadingProcessor";
import type { HtmlElementWrapperProcessorConfig } from "#/renderings/content/processors/HtmlElementWrapperProcessor";
import { SettingsManager } from "#/settings/SettingsManager";
import { BracketId } from "#/settings/types";
import { Arr } from "#/utils/ts";

const Processor = {
	Bracket: {
		ID_BY_TOKEN: {
			"[": "squareBrackets",
			"<<": "doubleAngle",
			"<": "angleBrackets",
			"((": "doubleParentheses",
			"{{": "doubleCurly",
			"(": "parentheses",
			"{": "curlyBraces",
		} as const satisfies Record<BracketToken, BracketId>,
	},
};

export class ContentProcessorConfigAdapter implements AbstractProcessorConfigProvider {

	private readonly settingsManager: SettingsManager;

	public constructor(settingsManager: SettingsManager) {
		this.settingsManager = settingsManager;
	}

	public audio(): AudioProcessorConfig {
		// this.settingsManager.settings.processor.preventMultiplePlayback
		return { preventMultiplePlayback: true };
	}

	public bracket(): BracketProcessorConfig | null {
		const raw = this.settingsManager.settings.processors.brackets;
		const enabled = Arr.nonEmpty<BracketToken>(
			(Object.keys(Processor.Bracket.ID_BY_TOKEN) as BracketToken[]).filter((token) => raw[Processor.Bracket.ID_BY_TOKEN[token]]?.enabled === true),
		);
		return enabled !== undefined ? { enabled } : null;
	}

	public heading(baseHeadingLevel?: number): HeadingProcessorConfig {
		return {
			baseHeadingLevel: baseHeadingLevel !== undefined ? baseHeadingLevel : (this.settingsManager.settings.hideCardSectionMarker ? 2 : 1),
			allowNonConsecutiveLevels: false,
		};
	}

	public htmlElementWrapper(): HtmlElementWrapperProcessorConfig {
		// this.settingsManager.settings.processor.applyLangTagsToNonLatinScripts
		return { applyLangTagsToNonLatinScripts: true };
	}
}
