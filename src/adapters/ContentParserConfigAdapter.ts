import type { GetCardParseOptions, ParseOptions } from "#/ContentParser";
import { NoteID } from "#/data/FullID";
import { SettingsManager } from "#/settings/SettingsManager";
import { Null } from "#/utils/ts";
import { ContentParserConfigProvider } from "#/views/types";

export class ContentParserConfigAdapter implements ContentParserConfigProvider {
	private settingsManager: SettingsManager;

	constructor(sm: SettingsManager) {
		this.settingsManager = sm;
	}

	getParseOptions(): ParseOptions {
		return {
			contentRead: {
				hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker,
			},
		};
	}

	getCardParseOptions(hints?: NoteID[]): GetCardParseOptions {
		return {
			...this.getParseOptions(),
			likelyNoteIDs: Null.fromNullish(hints),
		};
	}
}
