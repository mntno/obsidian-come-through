import { DeclarationManager } from "declarations/DeclarationManager";
import { DataStore, DataStoreRoot } from "DataStore";
import { DeclarationParser } from "declarations/DeclarationParser";
import { ConfirmationModal } from "modals/ConfirmationModal";
import { SelectDeckModal } from "modals/SelectDeckModal";
import { Editor, Keymap, MarkdownPostProcessorContext, MarkdownView, PaneType, Plugin, TFile } from "obsidian";
import { Scheduler } from "Scheduler";
import { PluginSettings, SettingsManager, SettingTab } from "Settings";
import { SyncManager } from "SyncManager";
import { PLUGIN_ICON, UIAssistant } from "UIAssistant";
import { UniqueID } from "UniqueID";
import { DecksView } from "views/DecksView";
import { ReviewView } from "views/ReviewView";
import t from "Localization";
import { DefinedContentView } from "views/DefinedContentView";

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

		this.pluginData = await ComeThroughPlugin.loadPluginData(this);
		this.settingsManager = new SettingsManager(this.pluginData.settings, async (_settings) => await this.savePluginData());
		this.ui = new UIAssistant(this.settingsManager);
		this.dataStore = new DataStore(this.pluginData.data, this.pluginData.settings.removedItemsPurgeThreshold, async (_data) => await this.savePluginData());
		this.scheduler = new Scheduler(this.dataStore);
		this.syncManager = new SyncManager(this.dataStore, this.app, () => this.scheduler.createItem());


		this.addSettingTab(new SettingTab(this, this.settingsManager));
		this.addRibbonIcon(PLUGIN_ICON, this.ui.contextulize("Review"), (evt: MouseEvent) => {
			this.openReviewView(Keymap.isModEvent(evt));
		});

		this.app.workspace.onLayoutReady(() => this.registerEvents());

		for (const language of DeclarationManager.supportedCodeBlockLanguages) {
			this.registerMarkdownCodeBlockProcessor(language, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				if (!this.settingsManager.settings.hideDeclarationInReadingView || UIAssistant.isInInLivePreview(this.app))
					DeclarationManager.processCodeBlock(this.app, source, el, ctx, this.dataStore);
			}, -100); // Process this code block last, allowing other plugins to alter user input first.

			// Register yaml highlighting. Seen while editing (comments, explicit strings, ...). TODO: This is CodeMirror 5 API.
			window.CodeMirror.defineMode(language, (config) => window.CodeMirror.getMode(config, "text/x-yaml"));
			this.register(() => {
				window.CodeMirror.defineMode(language, (config) => window.CodeMirror.getMode(config, "null"));
			});
		}

		// Views

		this.registerView(
			ReviewView.TYPE,
			(leaf) => new ReviewView(leaf, this.settingsManager, this.scheduler, this.ui, this.dataStore)
		);

		this.registerView(
			DecksView.TYPE,
			(leaf) => new DecksView(leaf, this.settingsManager, this.dataStore)
		);

		this.registerView(
			DefinedContentView.TYPE,
			(leaf) => new DefinedContentView(leaf, this.settingsManager, this.dataStore)
		);

		// Commands

		this.addCommand({
			id: 'open-review',
			name: t.commands.openReview.name,
			callback: () => this.openReviewView(true)
		});

		this.addCommand({
			id: 'open-decks',
			name: t.commands.openDecks.name,
			callback: () => this.openDecksView(true)
		});

		this.addCommand({
			id: 'view-defined-content-in-current-note',
			name: t.commands.openDeclarations.name,
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.file && DeclarationParser.containsDeclarations(markdownView.file, this.app)) {
					if (!checking)
						this.viewDefinedContent(markdownView.file, false);
					return true
				}
				return false
			}
		});

		this.addCommand({
			id: 'generate-id-cursor',
			name: t.commands.generateId.name,
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				editor.replaceRange(UniqueID.generateID(), editor.getCursor())
			}
		});
	}

	public onunload() {
		if (this.confirmationModal)
			this.confirmationModal.forceClose();
	}

	/**
	 * Handles external changes to the plugin's settings and data.
	 * This is triggered when the data file is modified by an external source, such as a sync service.
	 * It disables the internal sync manager, reloads the data, and prompts the user to accept the change.
	 */
	public async onExternalSettingsChange() {
		if (!this.pluginData)
			return;

		this.syncManager.setDisabled(); // Disable as soon as possible before any file events are fired.

		this.pluginData = await ComeThroughPlugin.loadPluginData(this);
		this.settingsManager.onSettingsChangedExternally(this.pluginData.settings);

		this.dataStore.onDataChangedExternally(this.pluginData.data, (currentData: DataStoreRoot, commit: () => void) => {

			// Prevent multiple modals opening.
			if (!this.confirmationModal) {
				this.confirmationModal = new ConfirmationModal(this.app);
				this.confirmationModal.open();
			}

			this.confirmationModal.onClosed = () => {
				this.confirmationModal = undefined;
			}

			this.confirmationModal.onButton1Click = () => {
				// Use new data.
				// If the data is changed externally several times before the user takes action, the intermediate external changes are ignored.
				// No need to persist to disk here because the change has already occured.
				commit();
				this.syncManager.setEnabled();
			};

			this.confirmationModal.onButton2Click = () => {
				// Reverse change, use old data.
				this.pluginData.data = currentData;
				this.syncManager.setEnabled();
				this.savePluginData();
			};

		});
	}
	private confirmationModal?: ConfirmationModal;

	// public onUserEnable(): void {}

	/**
	 * Registers the necessary event listeners for the plugin to function.
	 * This includes file events for synchronization and context menu events for user actions.
	 */
	private registerEvents() {

		this.registerEvent(this.app.workspace.on("file-open", this.syncManager.open.bind(this.syncManager)));
		this.registerEvent(this.app.metadataCache.on("changed", this.syncManager.changed.bind(this.syncManager)));
		this.registerEvent(this.app.vault.on("delete", this.syncManager.delete.bind(this.syncManager)));
		this.registerEvent(this.app.vault.on("rename", this.syncManager.rename.bind(this.syncManager)));

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source, _leaf) => {
			if (!(file instanceof TFile))
				return;

			const isFileIncluded = DeclarationParser.containsDeclarations(file, this.app);

			if (isFileIncluded && (/*source === "file-explorer-context-menu" ||*/ source === "more-options" || source === "tab-header")) {
				this.ui.addMenuItem(menu, t.actions.viewDeclarationsInFile, {
					onClick: async (evt) => this.viewDefinedContent(file, Keymap.isModEvent(evt)),
					section: "open",
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
					await openView(Keymap.isModEvent(evt), ReviewView.createViewState(deck.id));
				});
			modal.setPlaceholder(t.modals.selectDeck.placeholder);
			modal.open();
		}
		else {
			await openView(paneType, undefined);
		}
	}

	private async viewDefinedContent(file: TFile, paneType: PaneType | boolean) {
		await this.app.workspace.getLeaf(paneType).setViewState({
			type: DefinedContentView.TYPE,
			state: DefinedContentView.createViewState(file),
			active: true,
			pinned: undefined,
			group: undefined,
		});
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
