import { DataProviderCreator } from "#/data/DataProvider";
import { t } from "#/Localization";
import { OpenModal } from "#/ui/modalActions";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { App, Command } from "obsidian";

const GLOBAL_VIEW_PREFIX = "global-view-";

export const OpenViewCommand = {

	collections: (app: App): Command => {
		return {
			id: GLOBAL_VIEW_PREFIX + "collections",
			name: t.commands.openDecks.name,
			callback: () => OpenView.collections(app, Api.Event.paneType(app))
		};
	},

	reviewCollection: (app: App, createDataProvider: DataProviderCreator): Command => {
		return {
			id: GLOBAL_VIEW_PREFIX + "review-collection",
			name: t.commands.global.reviewCollection,
			callback: () => OpenView.collectionSelector(app, createDataProvider, Api.Event.paneType(app))
		};
	},

	review: (app: App, createDataProvider: DataProviderCreator): Command => {
		return {
			id: GLOBAL_VIEW_PREFIX + "review",
			name: t.commands.global.review,
			callback: () => OpenModal.review(app, createDataProvider)
		};
	},
};
