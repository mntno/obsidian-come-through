import { DataProviderCreator } from "#/data/DataProvider";
import { ReviewModal } from "#/modals/ReviewModal";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { App } from "obsidian";

export const OpenModal = {
	review: (app: App, createDataProvider: DataProviderCreator) => {
		new ReviewModal(app, createDataProvider(), (item, dataProvider, evt) => {
			switch (item.type) {
				case "custom": {
					switch (item.text) {
						case "All":
							OpenView.reviewWithState(app, OpenView.createState.forAll(), Api.Event.paneType(evt));
							break;
						case "Deck":
							OpenView.collectionSelector(app, createDataProvider, Api.Event.paneType(evt));
							break;
					}
					break;
				}
				case "folder":
					OpenView.reviewWithState(app, OpenView.createState.fromFile(dataProvider.stats.filter(item.folder)), Api.Event.paneType(evt));
					break;
				case "file":
					OpenView.reviewWithState(app, OpenView.createState.fromFile(item.file), Api.Event.paneType(evt));
					break;
				case "tag":
					OpenView.reviewWithState(app, OpenView.createState.fromFile(Api.File.getFilesWithFrontmatterTag(app, item.tag)), Api.Event.paneType(evt));
					break;
			}
		},
		).open();
	},
};
