import { SelectDeckModal } from "modals/SelectDeckModal";
import { DeclarationManager } from 'DeclarationManager';
import { FileParser } from 'FileParser';
import { FullID } from 'FullID';
import { Keymap, MarkdownPostProcessorContext, PaneType, Plugin, TFile } from 'obsidian';
import { ReviewView } from 'views/ReviewView';
import { Scheduler } from 'Scheduler';
import { PluginSettings, SettingsManager, SettingTab } from 'Settings';
import { DataStore, DataStoreRoot } from 'DataStore';
import { PLUGIN_ICON, UIAssistant } from 'UIAssistant';
import { DecksView } from "views/DecksView";
import { asNoteID } from "TypeAssistant";
import { DeclarationBase } from "declarations/Declaration";

interface PluginData {
	settings: PluginSettings;
	data: DataStoreRoot;
}

export default class ComeThroughPlugin extends Plugin {
	private data: PluginData;
	private settingsManager: SettingsManager;
	private scheduler: Scheduler;
	private ui: UIAssistant;
	private dataStore: DataStore;

	async onload() {

		//#region

		const data = await this.loadData(); // Returns `null` if file doesn't exist.
		this.data = {
			...{},
			...{
				settings: { ...SettingsManager.DEFAULT_DATA, ...data?.settings || {} },
				data: { ...DataStore.DEFAULT_DATA, ...data?.data || {} }
			} satisfies PluginData
		};

		this.settingsManager = new SettingsManager(
			this.data.settings,
			async (_settings) => await this.savePluginData()
		);
		this.addSettingTab(new SettingTab(this, this.settingsManager));

		this.ui = new UIAssistant(this.settingsManager);

		this.dataStore = new DataStore(this.data.data, async (data: DataStoreRoot) => {
			this.data.data = data;
			await this.savePluginData();
		});

		this.scheduler = new Scheduler(this.dataStore);

		//#endregion

		this.app.workspace.onLayoutReady(() => this.registerEvents());

		this.registerMarkdownCodeBlockProcessor(
			DeclarationBase.LANGUAGE,
			(source, el, ctx) => this.processCodeBlock(source, el, ctx),
			undefined
		);

		this.registerMarkdownCodeBlockProcessor(
			DeclarationBase.LANGUAGE_SHORT,
			(source, el, ctx) => this.processCodeBlock(source, el, ctx),
			undefined
		);

		this.registerView(
			ReviewView.TYPE,
			(leaf) => new ReviewView(leaf, this.settingsManager, this.scheduler, this.ui, this.dataStore)
		);

		this.registerView(
			DecksView.TYPE,
			(leaf) => new DecksView(leaf, this.dataStore)
		);

		this.addRibbonIcon(PLUGIN_ICON, this.ui.contextulize("Review"), (evt: MouseEvent) => {
			this.openReviewView(Keymap.isModEvent(evt));
		});

		//#region Commands

		this.addCommand({
			id: 'open-review',
			name: 'Review',
			callback: () => this.openReviewView(true)
		});

		this.addCommand({
			id: 'open-decks',
			name: 'Decks',
			callback: async () => this.openDecksView(true)
		});

		//#endregion
	}

	onunload() { }

	private processCodeBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		if (!this.settingsManager.settings.hideDeclarationInReadingView || UIAssistant.isInInLivePreview(this.app))
			DeclarationManager.processCodeBlock(this.app, source, el, ctx, this.dataStore);
	}

	private registerEvents() {

		this.registerEvent(this.app.workspace.on("file-open", async (file) => {
			if (file) {
				const ids = await DeclarationManager.processFile(file, this.app);
				await this.syncIDs(ids, file);
			}
		}));

		this.registerEvent(this.app.metadataCache.on("changed", async (file, data, cache) => {
			const ids = await DeclarationManager.processFileChanged(file, data, cache, this.app);
			await this.syncIDs(ids, file);
		}));

		this.registerEvent(this.app.vault.on("delete", async (file) => {
			if (file instanceof TFile && this.dataStore.removeNote(asNoteID(file.path)))
				await this.dataStore.save();
		}));

		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			if (file instanceof TFile && this.dataStore.changeNoteID(asNoteID(oldPath), asNoteID(file), false))
				await this.dataStore.save();
		}));

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source, _leaf) => {
			if (!(file instanceof TFile))
				return;

			const isFileIncluded = this.dataStore.getNote(asNoteID(file)) ? true : false;

			if (isFileIncluded && (source === "file-explorer-context-menu" || source === "more-options" || source === "tab-header")) {
				this.ui.addMenuItem(menu, "View flashcard info", {
					onClick: async () => this.viewInfo(file)
				});
			}
		}));
	}

	private async openDecksView(paneType: PaneType | boolean) {
		const leaf = this.app.workspace.getLeaf(paneType);
		await leaf.setViewState({
			type: DecksView.TYPE,
			active: true,
		});
	}

	private async openReviewView(paneType: PaneType | boolean) {

		const openView = async (paneType: PaneType | boolean, state: Record<string, unknown> | undefined) => {

			const leaf = this.app.workspace.getLeaf(paneType);

			await leaf.setViewState({
				type: ReviewView.TYPE,
				state: state,
				active: true,
				pinned: undefined,
				group: undefined,
			});
		};

		const allDecks = this.dataStore.getAllDecks();
		if (allDecks.length) {
			const modal = new SelectDeckModal(
				this.app,
				this.dataStore,
				[...[UIAssistant.allDecksOptionItem()], ...allDecks],
				async (deck, evt) => {
					await openView(Keymap.isModEvent(evt), { deckID: deck.id });
			});
			modal.setPlaceholder("Select deck to review");
			modal.open();
		}
		else {
			await openView(paneType, undefined);
		}
	}

	private async viewInfo(file: TFile) {

		const { ids } = await FileParser.getAllIDsInFile(file, this.app);

		let info: string = `${file.basename} defines ${ids.length} card sides\n\n`;
		info += ids.map(id => this.dataStore.cardInfo(id)).join("\n\n");
		this.ui.displayNotice(info, { prefix: false, preventDismissal: true });
	}

	//#region

	private async savePluginData() {
		await this.saveData(this.data);
	}

	private async syncIDs(ids: FullID[], file: TFile) {
		try {
			this.dataStore.syncData(ids, file.path, () => this.scheduler.createItem());
			await this.dataStore.save();
		}
		catch (error) {
			console.error("Failed to sync", error);
			this.ui.displayErrorNotice(`${(error instanceof Error) ? `Persisting changes failed: ${error.message}` : "An unknown error occurred while persisting changes."}`);
		}
	}

	//#endregion
}
