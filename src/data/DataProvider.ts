import { DataStore } from "#/data/DataStore";
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

	public constructor(store: DataStore) {
		this.store = store;
	}

	public get item() { return this.store.item; }
	public get collection() { return this.store.collection; }
	public get note() { return this.store.note; }

	public readonly stats = {

		/** Check if {@link fileOrFolder} contains notes with items. */
		exists: (fileOrFolder: TAbstractFile | TAbstractFile[]): boolean => {
			Env.log.data("DataProvider:stats.exists:", fileOrFolder);

			const hasItems: (file: TFile) => boolean = (file) =>
				this.store.noteHasItems(asNoteID(file));

			if (Api.File.is(fileOrFolder))
				return hasItems(fileOrFolder);

			// Abort as soon as soon as possible
			return Arr.isNonEmpty(Api.File.getMarkdownFilesRecursive(fileOrFolder, (f) => {
				const has = hasItems(f);
				return { include: has, stop: has };
			}));
		},

		/** Filters the given files and folders to those that contain items. */
		filter: (fileOrFolder: TAbstractFile | TAbstractFile[]): TFile[] => {
			Env.log.data("DataProvider:stats.filter:", fileOrFolder);
			return Api.File.getMarkdownFilesRecursive(fileOrFolder, (f) => this.stats.exists(f));
		},
	};

}
