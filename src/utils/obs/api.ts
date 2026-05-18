import { Arr, Bln, IterationCallback, Obj, St } from "#/utils/ts";
import { App, FrontMatterCache, Keymap, MetadataCache, TAbstractFile, TFile, TFolder, Vault, apiVersion, getLanguage, parseFrontMatterTags, requireApiVersion } from "obsidian";

export type FileIterationCallback = IterationCallback<TFile>;

export const Api = {

	get version(): string { return apiVersion; },

	App: {
		is: (app: unknown): app is App => app instanceof App,

		/**
		 * Returns the user's interface language. See {@link https://github.com/obsidianmd/obsidian-translations?tab=readme-ov-file#existing-languages | existing languages}.
		 * @returns The language code, or `"en"` if the language is not available.
		 */
		getLanguage(): string {
			if (requireApiVersion("1.8.7"))
				return getLanguage();
			else {
				const storage = window.localStorage; // `getLanguage()` was added in 1.8.7.
				return storage.getItem("language") || "en";
			}
		},

		async writeToClipboard(text: string): Promise<void> {
			await navigator.clipboard.writeText(text);
		},
	},

	File: {
		is: (value: unknown): value is TFile => value instanceof TFile,
		get: (vault: Vault, path: string): TFile | null => vault.getFileByPath(path),

		allInFolder: (folder: TFolder): TFile[] => {
			return folder.children.filter(Api.File.is);
		},

		markdownFiles: (vault: Vault): TFile[] => vault.getMarkdownFiles(),

		getMarkdownFilesRecursive(fileOrFolder: TAbstractFile | TAbstractFile[], callback?: FileIterationCallback): TFile[] {
			const result: TFile[] = [];
			let aborted = false;

			const collect = (current: TAbstractFile) => {
				if (aborted)
					return;

				if (Api.File.isMarkdownFile(current)) {
					const currentIndex = result.length;
					let include = true;

					if (callback) {
						const action = callback(current, currentIndex, result);
						if (Bln.is(action)) {
							include = action;
						} else {
							include = action.include;
							if (action.stop)
								aborted = true;
						}
					}

					if (include)
						result.push(current);

				} else if (Api.Folder.is(current)) {
					for (const child of current.children)
						collect(child);
				}
			};

			if (Arr.is(fileOrFolder)) {
				for (const item of fileOrFolder)
					collect(item);
			} else {
				collect(fileOrFolder);
			}

			return result;
		},

		isMarkdownFile(file: TAbstractFile): file is TFile {
			return Api.File.is(file) && file.extension === "md";
		},

		/**
		 * Returns all files that have the specified tag in their frontmatter.
		 * @param tag Normalized tag (`#abc`).
		 */
		getFilesWithFrontmatterTag: (app: App, tag: string | string[] | Set<string>): TFile[] => {

			let predicate: (tags: string[], file: TFile) => TFile | boolean;

			if (St.is(tag)) {
				predicate = (tags, f) => tags.some((t) => tag.has(t)) ? f : false;
			}
			else {
				const tagArr = Arr.from(tag);
				predicate = (tags, f) => tagArr.some(t => tags.includes(t)) ? f : false;
			}

			return St.toArr(Api.Tag.fromFrontmatter(app.metadataCache, Api.File.markdownFiles(app.vault), predicate));
		}
	},

	Frontmatter: {
		setValue: <T>(frontmatter: unknown, key: string, value: T) => {
			if (Obj.is(frontmatter))
				(frontmatter as FrontMatterCache)[key] = value;
			else
				throw new TypeError();
		},
		valueFrom: <T>(frontmatter: FrontMatterCache, key: string) => frontmatter[key] as T,
		recordFrom: (frontmatter: FrontMatterCache, key: string): Record<string, unknown> | undefined => {
			if (Obj.is(frontmatter[key]))
				return frontmatter[key] as Record<string, unknown>;
			return undefined;
		},
	},

	Folder: {
		is: (folder: TAbstractFile): folder is TFolder => folder instanceof TFolder,

		all(app: App, includeRoot: boolean): TFolder[] {
			return app.vault.getAllFolders(includeRoot);
		},

		get: (vault: Vault, path: string): TFolder | null => vault.getFolderByPath(path),

	},

	Tag: {
		toDisplay: (tag: string) => tag.startsWith("#") ? tag.substring(1) : tag,

		/**
		 * Extracts tags from the frontmatter of the given file(s).
		 * @param cache
		 * @param file
		 * @param predicate If a boolean is returned the resulting set will contain the tags; if `T` is returned, the resulting set will contain `T`.
		 * @param accumulator
		 * @returns A set of tags extracted from the frontmatter of the given file(s). Each tag is normalized, i.e. prefixed with `#`.
		 */
		fromFrontmatter: <T = string>(
			cache: MetadataCache,
			file: TFile | TFile[],
			predicate?: (tags: string[], file: TFile) => T | boolean,
			accumulator: Set<T> = new Set<T>()
		) => {
			if (Arr.is(file)) {
				for (const f of file)
					Api.Tag.fromFrontmatter<T>(cache, f, predicate, accumulator);
			}
			else {
				const c = cache.getFileCache(file);
				if (c !== null && c.frontmatter !== undefined) {
					const tags = parseFrontMatterTags(c.frontmatter);
					if (Arr.isNonEmpty(tags)) {
						const result = predicate === undefined ? true : predicate(tags, file);
						if (result !== false) {
							if (result === true)
								St.add(accumulator, tags as unknown as T[]);
							else
								accumulator.add(result);
						}
					}
				}
			}
			return accumulator;
		},
	},

	Event: {
		paneType: (evt: MouseEvent | KeyboardEvent | App) => Keymap.isModEvent(!Api.App.is(evt) ? evt : evt.lastEvent),
	},

	Menu: {

		/** To find the section IDs of an existing menu, inspect the DOM elements to see their `data-section` attribute. */
		Section: {
			/** Will be added above {@link Api.Menu.Section.Destructive}. */
			Default: undefined,

			/**
				* - {@link Api.Menu.Source.FileExplorer}: "Open in new tab", "Open to the right"
				* - {@link Api.Menu.Source.TabHeader}: "Move to new window", "Split right", "Split down"
				* - {@link Api.Menu.Source.MoreOptions}: Same as {@link Api.Menu.Source.TabHeader}.
				*/
			Open: "open",

			/**
				* - {@link Api.Menu.Source.FileExplorer}: Not used
				* - {@link Api.Menu.Source.TabHeader}: "Pin", "Link with tab", + {@link Api.Menu.Source.MoreOptions}
				* - {@link Api.Menu.Source.MoreOptions}: "Reading view", "Source mode", "Backlinks in document"
				*/
			Pane: "pane",

			/**
				* - {@link Api.Menu.Source.FileExplorer}: Not used
				* - {@link Api.Menu.Source.TabHeader}: "Find", "Replace"
				* - {@link Api.Menu.Source.MoreOptions}: "Find", "Replace"
				* - {@link Api.Menu.Source.Editor}: "Search for..."
				*/
			Find: "find",

			/**
				* For destructive actions like deleting or moving to trash. Items in this section usually appear at the bottom and are often styled differently.
				* - {@link Api.Menu.Source.FileExplorer}: "Rename", "Delete"
				* - {@link Api.Menu.Source.TabHeader}: "Delete file"
				* - {@link Api.Menu.Source.MoreOptions}: "Delete file"
				* - {@link Api.Menu.Source.Editor}: Not used
				*/
			Destructive: "danger",

			/**
				* - {@link Api.Menu.Source.FileExplorer}: "Copy path"
				* - {@link Api.Menu.Source.TabHeader}: Same as {@link Api.Menu.Source.FileExplorer}.
				* - {@link Api.Menu.Source.MoreOptions}: Same as {@link Api.Menu.Source.TabHeader}.
				* - {@link Api.Menu.Source.Editor}: Not used
				*/
			Info: "info",

			/**
				* - {@link Api.Menu.Source.FileExplorer}: "Duplicate", "Move file to…", …
				* - {@link Api.Menu.Source.TabHeader}: "Export to PDF", "Rename", "Add file property"
				* - {@link Api.Menu.Source.MoreOptions}: Same as {@link Api.Menu.Source.TabHeader}.
				* - {@link Api.Menu.Source.Editor}: "Rename this heading" (if on heading), …
				*/
			Action: "action",

			/**
				* - {@link Api.Menu.Source.FileExplorer}: Not used
				* - {@link Api.Menu.Source.TabHeader}: "Open linked view"
				* - {@link Api.Menu.Source.MoreOptions}: Same as {@link Api.Menu.Source.TabHeader}.
				* - {@link Api.Menu.Source.Editor}: Not used
				*/
			View: "view",

			/**
				* - {@link Api.Menu.Source.Editor}: "Cut", "Copy", "Paste"
				*/
			Clipboard: "clipboard",
		},

		Source: {
			/** The file explorer context menu. */
			FileExplorer: "file-explorer-context-menu",
			/** The tab header context menu. */
			TabHeader: "tab-header",
			/** The more options context menu. */
			MoreOptions: "more-options",
			/** The editor context menu. */
			Editor: "editor-menu",
		},
	},

};
