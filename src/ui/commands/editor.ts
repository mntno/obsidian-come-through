import { UniqueID } from "#/data/UniqueID";
import { Env } from "#/env";
import { t } from "#/Localization";
import { Api } from "#/utils/obs/api";
import { Str } from "#/utils/ts";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

export const EditorCommand = {

	generateId: (): Command => ({
		id: "generate-id-cursor",
		name: t.commands.generateId.name,
		editorCallback: (editor: Editor, _ctx) => {
			editor.replaceRange(UniqueID.generateID(), editor.getCursor())
		}
	}),

	insertReviewUnit: (copyLastPage: boolean): Command => ({
		id: "insert-review-unit" + (copyLastPage ? "-copy-last-page" : ""),
		name: "Insert empty declaration under cursor " + (copyLastPage ? "(put answer side in clipboard)" : "(both sides)"),
		editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {

			const file = ctx.file;
			if (file === null)
				return;

			const cursor = editor.getCursor();
			const fileCache = ctx.app.metadataCache.getFileCache(file);
			const headings = fileCache?.headings || [];

			let headingLevel = 0;
			for (let i = headings.length - 1; i >= 0; i--) {
				if (headings[i]!.position.start.line <= cursor.line) {
					headingLevel = headings[i]!.level;
					break;
				}
			}
			headingLevel = Math.min(Math.max(headingLevel + 1, 2), 6);
			const hashes = '#'.repeat(headingLevel || 2);

			const id = UniqueID.generateID();

			const createCardPage = (isBack: boolean) => {
				const title = isBack ? "Answer heading" : "Question heading";
				const side = isBack ? "b" : "f";

				return [
					`${hashes} ${title}`,
					Str.LF,
					"```ct",
					"id: " + id,
					"side: " + side,
					"```",
					Str.LF,
					"*Add content here*",
					Str.LF,
				].join(Str.LF);
			};

			const firstPage = createCardPage(false);
			const lastPage = createCardPage(true);
			const codeBlock = copyLastPage ? firstPage : firstPage.concat(lastPage);

			editor.replaceRange(codeBlock, cursor);
			editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor) + firstPage.length - 2));

			if (copyLastPage)
				Api.App.writeToClipboard(lastPage).catch(Env.catch);
		}
	}),

};
