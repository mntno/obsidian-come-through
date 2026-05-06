import { DataStore, DeckIDDataTuple } from "#/data/DataStore";
import { DeckID } from "#/data/FullID";
import { Env } from "#/env";
import { asNoteID } from "#/TypeAssistant";
import { Api } from "#/utils/obs/api";
import { Arr } from "#/utils/ts";
import { TAbstractFile, TFile } from "obsidian";

/** Allows for the underlying data store to be swapped out. */
export type DataProviderCreator = () => DataProvider;

/** Read-only data access. */
export class DataProvider {
	private store: DataStore;

	static creator(store: DataStore): DataProviderCreator {
		return () => new DataProvider(store);
	}

	private constructor(store: DataStore) {
		this.store = store;
	}

	public hasStatistics(file: TAbstractFile | TAbstractFile[]): boolean {
		Env.log.data("DataProvider:hasStatistics", ", file:", file);

		const hasStatistics: (file: TFile) => boolean = (file) =>
			this.store.noteHasItems(asNoteID(file));

		if (Api.File.is(file))
			return hasStatistics(file);

		// Abort as soon as soon as possible
		return Arr.isNonEmpty(Api.File.getMarkdownFilesRecursive(file, (f) => {
			const has = hasStatistics(f);
			return { include: has, stop: has };
		}));
	}

	filesWithStats(file: TAbstractFile | TAbstractFile[]): TFile[] {
		Env.log.data("DataProvider:filesWithStats", ", file:", file);
		return Api.File.getMarkdownFilesRecursive(file, (file) => this.hasStatistics(file));
	}

	public getCollection = (id: DeckID) =>
		this.store.getDeck(id);

	public getAllCollections = () =>
		this.store.getAllDecks();

	public getAllItems = () =>
		this.store.getAllCards();

	public getAllItemsInCollection = (collection: DeckIDDataTuple | DeckIDDataTuple[]) =>
		this.store.getAllCardsForDeck(Arr.from(collection).map(deck => deck.id));

	public getAllItemsInCollectionByID = (deckID: DeckID | DeckID[]) =>
		this.store.getAllCardsForDeck(deckID);

	public getAllNotes = () =>
		this.store.getAllNotes();
}
