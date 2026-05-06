import { DataProviderCreator } from "#/data/DataProvider";
import { UIAssistant } from "#/ui/UIAssistant";
import { Icon } from "#/ui/constants";
import { App, Workspace } from "obsidian";

/** Bundles what is needed for UI operations. */
export type UIContext = {
	/** Prefer {@link UIContext.workspace} */
	app: App;
	workspace: Workspace;
	ui: UIAssistant;
	icon: typeof Icon;
	createDataProvider: DataProviderCreator;
};
