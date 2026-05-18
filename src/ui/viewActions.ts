import { DataProviderCreator } from "#/data/DataProvider";
import { Env } from "#/env";
import { t } from "#/Localization";
import { SelectDeckModal } from "#/modals/SelectDeckModal";
import { Api } from "#/utils/obs/api";
import { Arr } from "#/utils/ts";
import { BaseViewState } from "#/views/BaseView";
import { DecksView } from "#/views/DecksView";
import { DefinedContentView } from "#/views/DefinedContentView";
import { ReviewView } from "#/views/review/ReviewView";
import { DeckID, FullID } from "#/data/FullID";
import { App, PaneType, TFile } from "obsidian";


export const OpenView = {

	/** Opens the collections view. */
	collections: (app: App, paneType?: PaneType | boolean) => {
		app.workspace.getLeaf(paneType).setViewState({
			type: DecksView.TYPE,
			state: DecksView.createViewState(),
			active: true,
		}).catch(Env.catch);
	},

	/** View content defined in {@link file}. */
	viewContentInFile: (app: App, file: TFile | TFile[], paneType: PaneType | boolean) => {
		app.workspace.getLeaf(paneType).setViewState({
			type: DefinedContentView.TYPE,
			state: DefinedContentView.createViewState(file),
			active: true,
		}).catch(Env.catch);
	},

	collectionSelector: (app: App, createDataProvider: DataProviderCreator, paneType?: PaneType | boolean) => {

		const openView = (state: BaseViewState | undefined, paneType?: PaneType | boolean) => {
			app.workspace.getLeaf(paneType).setViewState({
				type: ReviewView.TYPE,
				state: state,
				active: true,
			}).catch(Env.catch);
		};

		const dataProvider = createDataProvider();
		const allDecks = dataProvider.collection.all();
		if (allDecks.length == 0) {
			openView(OpenView.createState.forCollection(null), paneType);
		}
		else {
			const modal = new SelectDeckModal(
				app,
				dataProvider,
				allDecks,
				(deck, evt) => openView(
					OpenView.createState.forCollection(deck === null ? null : deck.id),
					Api.Event.paneType(evt)
				)
			);
			modal.setPlaceholder(t.modals.selectDeck.placeholder);
			modal.open();
		}
	},

	/** Review specific collection(s). */
	reviewCollection: (app: App, id: DeckID | DeckID[] | null, paneType: PaneType | boolean) => {
		app.workspace.getLeaf(paneType).setViewState({
			type: ReviewView.TYPE,
			state: OpenView.createState.forCollection(id),
			active: true,
		}).catch(Env.catch);
	},

	/** Review content defined in {@link file}. */
	reviewFile: (app: App, file: TFile | TFile[], paneType: PaneType | boolean) => {
		Env.log.ui("OpenView:reviewFile", "\n\tfiles", file);
		app.workspace.getLeaf(paneType).setViewState({
			type: ReviewView.TYPE,
			state: ReviewView.createViewState({ type: 'file', paths: Arr.from(file).map(f => f.path) }),
			active: true,
		}).catch(Env.catch);
	},

	/** Review specific item(s). */
	reviewItem: (app: App, id: FullID | FullID[] | null, paneType: PaneType | boolean) => {
		app.workspace.getLeaf(paneType).setViewState({
			type: ReviewView.TYPE,
			state: ReviewView.createViewState(id === null ? null : { type: 'item', id: id }),
			active: true,
		}).catch(Env.catch);
	},

	reviewWithState: (app: App, state: BaseViewState, paneType: PaneType | boolean) => {
		app.workspace.getLeaf(paneType).setViewState({
			type: ReviewView.TYPE,
			state: state,
			active: true,
		}).catch(Env.catch);
	},

	createState: {
		forAll: () => ReviewView.createViewState({ type: 'all' }),
		fromFile: (file: TFile | TFile[]) => ReviewView.createViewState({ type: 'file', paths: Arr.from(file).map(f => f.path) }),
		/** @param id `null` for all items that are in a collection. */
		forCollection: (id: DeckID | DeckID[] | null) => ReviewView.createViewState({ type: 'deck', deckID: id }),
	},
};
