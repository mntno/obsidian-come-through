import { GetCardParseOptions, ParseOptions } from "#/ContentParser";
import { DataStore } from "#/data/DataStore";
import { NoteID } from "#/data/FullID";
import { ProcessorConfigProvider } from "#/renderings/content/ProcessorConfigProvider";
import { SettingsManager } from "#/settings/SettingsManager";

export type ViewContext = {
	settingsManager: SettingsManager;
	processorConfig: ProcessorConfigProvider;
};

export type DataWriterViewContext = ViewContext & {
	data: DataStore;
};

export type ContentParserViewContext = ViewContext & {
	contentParserConfig: ContentParserConfigProvider;
};

export interface ContentParserConfigProvider {
    getParseOptions(): ParseOptions;
    getCardParseOptions(hints?: NoteID[]): GetCardParseOptions;
}
