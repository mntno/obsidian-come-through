import { t } from "#/Localization";
import { UIContext } from "#/ui/types";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { Menu, TAbstractFile, WorkspaceLeaf } from "obsidian";

const Section = Api.Menu.Section;

export const MenuActions = {

	fileMenu: (ctx: UIContext, menu: Menu, file: TAbstractFile, source: string, _leaf?: WorkspaceLeaf) => {

		const data = ctx.createDataProvider();
		const hasStatistics = data.stats.exists(file)

		if (!hasStatistics) // DeclarationParser.containsDeclarations(file, ctx.app);
			return;

		if (source === Api.Menu.Source.FileExplorer || source === Api.Menu.Source.MoreOptions || source === Api.Menu.Source.TabHeader) {

			ctx.ui.addMenuItem(menu, t.actions.viewContentInFile, {
				icon: ctx.icon.View.DEFINED_CONTENT,
				section: Section.View,
				onClick: (evt) => OpenView.viewContentInFile(ctx.app, ctx.createDataProvider().stats.filter(file), Api.Event.paneType(evt))
			});

			ctx.ui.addMenuItem(menu, t.actions.reviewContentInFile, {
				icon: ctx.icon.Action.REVIEW,
				section: Section.View,
				onClick: (evt) => OpenView.reviewFile(ctx.app, ctx.createDataProvider().stats.filter(file), Api.Event.paneType(evt))
			});
		}
	},

	filesMenu: (ctx: UIContext, menu: Menu, files: TAbstractFile[], source: string, _leaf?: WorkspaceLeaf) => {

		if (files.length === 0)
			return;

		const data = ctx.createDataProvider();
		const hasFilesWithStats = data.stats.exists(files)

		if (!hasFilesWithStats)
			return;

		if (source === Api.Menu.Source.FileExplorer) {

			ctx.ui.addMenuItem(menu, t.actions.viewContentInFile, {
				icon: ctx.icon.View.DEFINED_CONTENT,
				section: Section.View,
				onClick: (evt) => OpenView.viewContentInFile(ctx.app, ctx.createDataProvider().stats.filter(files), Api.Event.paneType(evt))
			});

			ctx.ui.addMenuItem(menu, t.actions.reviewContentInFile, {
				icon: ctx.icon.Action.REVIEW,
				section: Section.View,
				onClick: evt => OpenView.reviewFile(ctx.app, ctx.createDataProvider().stats.filter(files), Api.Event.paneType(evt))
			});
		}
	},
}
