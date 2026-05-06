import { Env } from "#/env";
import { t } from "#/Localization";
import { UIContext } from "#/ui/types";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { Editor, MarkdownFileInfo, MarkdownView, Menu, TAbstractFile, WorkspaceLeaf } from "obsidian";

const Section = Api.Menu.Section;

export const MenuActions = {

	fileMenu: (ctx: UIContext, menu: Menu, file: TAbstractFile, source: string, _leaf?: WorkspaceLeaf) => {
		Private.on(ctx, menu, source);

		const data = ctx.createDataProvider();
		const hasStatistics = data.hasStatistics(file)

		if (!hasStatistics) // DeclarationParser.containsDeclarations(file, ctx.app);
			return;

		if (source === Api.Menu.Source.FileExplorer || source === Api.Menu.Source.MoreOptions || source === Api.Menu.Source.TabHeader) {

			ctx.ui.addMenuItem(menu, t.actions.viewContentInFile, {
				icon: ctx.icon.View.DEFINED_CONTENT,
				section: Section.View,
				onClick: (evt) => OpenView.viewContentInFile(ctx.app, ctx.createDataProvider().filesWithStats(file), Api.Event.paneType(evt))
			});

			ctx.ui.addMenuItem(menu, t.actions.reviewContentInFile, {
				icon: ctx.icon.Action.REVIEW,
				section: Section.View,
				onClick: (evt) => OpenView.reviewFile(ctx.app, ctx.createDataProvider().filesWithStats(file), Api.Event.paneType(evt))
			});
		}
	},

	filesMenu: (ctx: UIContext, menu: Menu, files: TAbstractFile[], source: string, _leaf?: WorkspaceLeaf) => {
		Private.on(ctx, menu, source);

		if (files.length === 0)
			return;

		const data = ctx.createDataProvider();
		const hasFilesWithStats = data.hasStatistics(files)

		if (!hasFilesWithStats)
			return;

		if (source === Api.Menu.Source.FileExplorer) {

			ctx.ui.addMenuItem(menu, t.actions.viewContentInFile, {
				icon: ctx.icon.View.DEFINED_CONTENT,
				section: Section.View,
				onClick: (evt) => OpenView.viewContentInFile(ctx.app, ctx.createDataProvider().filesWithStats(files), Api.Event.paneType(evt))
			});

			ctx.ui.addMenuItem(menu, t.actions.reviewContentInFile, {
				icon: ctx.icon.Action.REVIEW,
				section: Section.View,
				onClick: evt => OpenView.reviewFile(ctx.app, ctx.createDataProvider().filesWithStats(files), Api.Event.paneType(evt))
			});
		}
	},

	/** `editor-menu'` */
	editorMenu: (ctx: UIContext, menu: Menu, _editor: Editor, _info: MarkdownView | MarkdownFileInfo) => {
		Private.on(ctx, menu, Api.Menu.Source.Editor);
	},
}

const Private = {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	on: (ctx: UIContext, menu: Menu, source: string) => {
		Env.log.ui("Menu:on", source);
		// Env.dev?.run(() => {
		// 	// @ts-expect-error
		// 	for (const section of menu.sections)
		// 		ctx.ui.addMenuItem(menu, `Section: ${section}`, { section: section, prefix: true, });
		// });
	},
};
