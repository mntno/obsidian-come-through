import { DataStore, DataStoreRoot } from "DataStore";
import { DeclarationManager } from "declarations/DeclarationManager";
import { DeclarationParser } from "declarations/DeclarationParser";
import { ConfirmationModal } from "modals/ConfirmationModal";
import { SelectDeckModal } from "modals/SelectDeckModal";
import { Keymap, MarkdownPostProcessorContext, PaneType, Plugin, TFile } from "obsidian";
import { Scheduler } from "Scheduler";
import { PluginSettings, SettingsManager, SettingTab } from "Settings";
import { SyncManager } from "SyncManager";
import { asNoteID } from "TypeAssistant";
import { PLUGIN_ICON, UIAssistant } from "UIAssistant";
import { DecksView } from "views/DecksView";
import { ReviewView } from "views/ReviewView";

interface PluginData {
	settings: PluginSettings;
	data: DataStoreRoot;
}

export default class ComeThroughPlugin extends Plugin {
	private pluginData: PluginData;
	private settingsManager: SettingsManager;
	private scheduler: Scheduler;
	private ui: UIAssistant;
	private dataStore: DataStore;
	private syncManager: SyncManager;

	public async onload() {
		//#region

		this.pluginData = await ComeThroughPlugin.loadPluginData(this);
		this.settingsManager = new SettingsManager(this.pluginData.settings, async (_settings) => await this.savePluginData());
		this.ui = new UIAssistant(this.settingsManager);
		this.dataStore = new DataStore(this.pluginData.data, async (_data) => await this.savePluginData());
		this.scheduler = new Scheduler(this.dataStore);
		this.syncManager = new SyncManager(this.dataStore, this.app, () => this.scheduler.createItem());

		//#endregion

		this.addSettingTab(new SettingTab(this, this.settingsManager));
		this.app.workspace.onLayoutReady(() => this.registerEvents());

		for (const language of DeclarationManager.supportedCodeBlockLanguages) {
			this.registerMarkdownCodeBlockProcessor(language, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				if (!this.settingsManager.settings.hideDeclarationInReadingView || UIAssistant.isInInLivePreview(this.app))
					DeclarationManager.processCodeBlock(this.app, source, el, ctx, this.dataStore);
			}, undefined);
		}

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
			callback: () => this.openDecksView(true)
		});

		//#endregion
	}

	//public onunload() { }

	public async onExternalSettingsChange() {
		if (!this.pluginData)
			return;

		this.pluginData = await ComeThroughPlugin.loadPluginData(this);
		this.settingsManager.onSettingsChangedExternally(this.pluginData.settings);

		this.dataStore.onDataChangedExternally(this.pluginData.data, (currentData: DataStoreRoot, commit: () => void) => {

			// Prevent multiple modals opening.
			if (!this.confirmationModal) {
				this.confirmationModal = new ConfirmationModal(this.app);
				this.confirmationModal.open();
			}

			// If the data is changed externally several times before the user takes action, the intermediate external change are ignored.
			this.confirmationModal.onClosed = () => this.confirmationModal = undefined;
			this.confirmationModal.onButton1Click = commit;
			this.confirmationModal.onButton2Click = () => {
				this.pluginData.data = currentData;
				this.savePluginData();
			};
		});
	}
	private confirmationModal?: ConfirmationModal;

	// public onUserEnable(): void {}

	private registerEvents() {

		this.registerEvent(this.app.workspace.on("file-open", this.syncManager.open.bind(this.syncManager)));
		this.registerEvent(this.app.metadataCache.on("changed", this.syncManager.changed.bind(this.syncManager)));
		this.registerEvent(this.app.vault.on("delete", this.syncManager.delete.bind(this.syncManager)));
		this.registerEvent(this.app.vault.on("rename", this.syncManager.rename.bind(this.syncManager)));

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

		const { ids } = await DeclarationParser.getAllIDsInFile(file, this.app);

		let info: string = `${file.basename} defines ${ids.length} card sides\n\n`;
		info += ids.map(id => this.dataStore.cardInfo(id)).join("\n\n");
		this.ui.displayNotice(info, { prefix: false, preventDismissal: true });
	}

	private static async loadPluginData(plugin: Plugin): Promise<PluginData> {
		const data = await plugin.loadData(); // Returns `null` if file doesn't exist.
		return {
			...{},
			...{
				settings: { ...SettingsManager.DEFAULT_DATA, ...data?.settings || {} },
				data: { ...DataStore.DEFAULT_DATA, ...data?.data || {} }
			} satisfies PluginData
		};
	}

	private async savePluginData() {
		await this.saveData(this.pluginData);
	}

}
