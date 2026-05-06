import { DataProviderCreator } from "#/data/DataProvider";
import { t } from "#/Localization";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { App, Command, MarkdownView, TFile } from "obsidian";

const ID_PREFIX = "markdown-view-";

/** Commands that only appear when a {@link MarkdownView} is open. */
export const MarkdownViewCommand = {

	content: (app: App, createDataProvider: DataProviderCreator): Command => ({
		id: ID_PREFIX + "content",
		name: t.commands.view.markdown.content,
		checkCallback: (checking: boolean) => handleCallbackCheck(
			app,
			checking,
			(file) => createDataProvider().hasStatistics(file),
			(file) => OpenView.viewContentInFile(app, file, Api.Event.paneType(app)),
		)
	}),

	review: (app: App, createDataProvider: DataProviderCreator): Command => ({
		id: ID_PREFIX + "review",
		name: t.commands.view.markdown.review,
		checkCallback: (checking: boolean) => handleCallbackCheck(
			app,
			checking,
			(file) => createDataProvider().hasStatistics(file),
			(file) => OpenView.reviewFile(app, file, Api.Event.paneType(app)),
		)
	}),
};

function handleCallbackCheck(app: App, checking: boolean, cont: ((file: TFile) => boolean) | undefined, callback: (file: TFile) => void) {
	const markdownView = app.workspace.getActiveViewOfType(MarkdownView);

	if (Api.File.is(markdownView?.file) && (cont === undefined || cont(markdownView.file))) {
		if (!checking)
			callback(markdownView.file);
		return true;
	}
	return false;
}
