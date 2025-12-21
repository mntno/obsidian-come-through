import { DataStore } from "data/DataStore";
import { DeclarationParser } from "declarations/DeclarationParser";
import t from "Localization";
import { SelectDeckModal } from "modals/SelectDeckModal";
import { App, Command, Keymap, MarkdownView, PaneType, TFile } from "obsidian";
import { DecksView } from "views/DecksView";
import { DefinedContentView } from "views/DefinedContentView";
import { ReviewView } from "views/review/ReviewView";


export const OpenView = {

	collections: async (app: App, paneType?: PaneType | boolean) => {
		const leaf = app.workspace.getLeaf(paneType);
		await leaf.setViewState({
			type: DecksView.TYPE,
			state: DecksView.createViewState(),
			active: true,
		});
	},

	definedContent: async (app: App, file: TFile, paneType: PaneType | boolean) => {
		await app.workspace.getLeaf(paneType).setViewState({
			type: DefinedContentView.TYPE,
			state: DefinedContentView.createViewState(file),
			active: true,
			pinned: undefined,
			group: undefined,
		});
	},

	review: async (app: App, dataStore: DataStore, paneType?: PaneType | boolean) => {

		const openView = async (state: Record<string, unknown> | undefined, paneType?: PaneType | boolean) => {

			const leaf = app.workspace.getLeaf(paneType);

			await leaf.setViewState({
				type: ReviewView.TYPE,
				state: state,
				active: true,
				pinned: undefined,
				group: undefined,
			});
		};

		const allDecks = dataStore.getAllDecks();
		if (allDecks.length > 0) {
			const modal = new SelectDeckModal(
				app,
				dataStore,
				allDecks,
				(deck, evt) => {
					openView(
						ReviewView.createViewState(deck === null ? null : deck.id),
						Keymap.isModEvent(evt)
					).catch(console.error);
				});
			modal.setPlaceholder(t.modals.selectDeck.placeholder);
			modal.open();
		}
		else {
			await openView(ReviewView.createViewState(null), paneType);
		}
	}
};

export const OpenViewCommand = {

	collections: (app: App): Command => {
		return {
			id: DecksView.TYPE + '-open',
			name: t.commands.openDecks.name,
			callback: () => OpenView.collections(app)
		};
	},

	definedContent: (app: App): Command => {
		return {
			id: 'view-defined-content-in-current-note',
			name: t.commands.openDeclarations.name,
			checkCallback: (checking: boolean) => {
				const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.file && DeclarationParser.containsDeclarations(markdownView.file, app)) {
					if (!checking)
						OpenView.definedContent(app, markdownView.file, false);
					return true;
				}
				return false;
			}
		};
	},

	review: (app: App, dataStore: DataStore): Command => {
		return {
			id: ReviewView.TYPE + "-open",
			name: t.commands.openReview.name,
			callback: () => OpenView.review(app, dataStore)
		};
	},
};
