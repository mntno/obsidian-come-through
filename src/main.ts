import { DataStore, DataStoreRoot } from "DataStore";
import { DeclarationManager } from "declarations/DeclarationManager";
import { DeclarationParser } from "declarations/DeclarationParser";
import { Env } from "env";
import t from "Localization";
import { ConfirmationModal } from "modals/ConfirmationModal";
import { SelectDeckModal } from "modals/SelectDeckModal";
import { Editor, Keymap, MarkdownPostProcessorContext, MarkdownView, PaneType, Plugin, TFile } from "obsidian";
import { FsrsSchedulerConfig, Scheduler } from "Scheduler";
import { PluginSettings, SettingsChangedInfo, SettingsManager, SettingTab } from "Settings";
import { SyncManager } from "SyncManager";
import { PLUGIN_ICON, UIAssistant } from "UIAssistant";
import { UniqueID } from "UniqueID";
import { DecksView } from "views/DecksView";
import { DefinedContentView } from "views/DefinedContentView";
import { ReviewView } from "views/ReviewView";

interface PluginData {
	settings: PluginSettings;
	data: DataStoreRoot;
}

export default class ComeThroughPlugin extends Plugin {
	private dataStore: DataStore;
	private scheduler: Scheduler;
	private settingsManager: SettingsManager;
	private syncManager: SyncManager;
	private ui: UIAssistant;

	/** Must referene the latest data before {@link savePluginData} is called. Only needed to hold references in order to pass to {@link Plugin.saveData}, see {@link savePluginData}. */
	private latestPluginDataRef: PluginData;

	public async onload() {

		this.latestPluginDataRef = await ComeThroughPlugin.loadPluginData(this);

		this.settingsManager = new SettingsManager(
			this.latestPluginDataRef.settings,
			async (settings) => {
				this.latestPluginDataRef.settings = settings;
				await this.savePluginData();
			},
			this.onSettingsSaved.bind(this)
		);

		this.dataStore = new DataStore(this.latestPluginDataRef.data, this.latestPluginDataRef.settings.removedItemsPurgeThreshold, async (data) => {
			this.latestPluginDataRef.data = data;
			await this.savePluginData();
		});

		this.scheduler = new Scheduler(this.dataStore, this.createSchedulerConfig());
		this.syncManager = new SyncManager(this.dataStore, this.app, () => this.scheduler.createItem());
		this.ui = new UIAssistant(this.settingsManager);

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
					return true;
				}
				return false;
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

	/** This is triggered when the data file is modified by an external source, such as a sync service. */
	public async onExternalSettingsChange() {
		Env.log.d("Plugin:onExternalSettingsChange");

		const overwrittenDataOnDisk = await ComeThroughPlugin.loadPluginData(this);
		this.settingsManager.onSettingsChangedExternally(overwrittenDataOnDisk.settings, (changed) => this.latestPluginDataRef.settings = changed);

		this.syncManager.whileSuspended(() => {

			// Four scenarios:
			// 1. Explicit user data changed -> show modal.
			// 	- If user accepts change, refresh in-memory data.
			// 	- If user rejects change, revert the changes on disk.
			// 2. Other data changed -> Accept change (as above) without user interaction.
			// 3. No changes detected -> Do nothing.

			this.dataStore.onDataChangedExternally(
				overwrittenDataOnDisk.data,
				(info, commit: () => void) => {

					// Avoid writing to disk again if not needed as this method was already called because of a modification.
					// The only time it's needed is when the user rejects the change.
					const accept = () => {
						this.latestPluginDataRef.data = info.changedData; // Update reference first because data change listeners will be called that might call `save`.
						commit();
					};

					const reject = () => {
						this.latestPluginDataRef.data = info.currentData;
						this.savePluginData(); // Note: calling `save` on `DataStore` will be a no-op because data is not dirty.
					};

					// Only show modal if data explicitly created by the user has changed. Otherwise, automatically accept the changes.
					// For example, if the modal is shown when the plugin merely has automatically purged a removed statistics item, the user will be confused because they didn't make any changes/rated.
					if (info.activeChanged || info.collectionsChanged) {

						// Prevent multiple modals opening (as external changes might occur while the modal is showing).
						if (!this.confirmationModal) {
							this.confirmationModal = new ConfirmationModal(this.app);
							this.confirmationModal.onClosed = () => this.confirmationModal = undefined;
							this.confirmationModal.open();
						}

						// Note: Several external changes might occur while the modal is showing. User accepting should apply the latest change. Therefore, overwrite events so that the latest variable values are used.
						this.confirmationModal.onButton1Click = () => accept();
						this.confirmationModal.onButton2Click = () => reject();
					}
					else {
						Env.log.d(`\tAccepting data changes without showing modal.`);
						accept();
					}
				}, () => {
					Env.log.d(`\tNo data changes detected.`)
				}
			);
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

		// Prepare a temporary settings object by merging top-level properties.
		const mergedSettings = {
			...SettingsManager.DEFAULT_DATA,
			...data?.settings || {}
		};

		// Explicitly merge the nested `schedulers` object.
		// This combines the default schedulers with any schedulers from the loaded data.
		// This only adds the default scheduler object(s) if their keys are missing, but it doesn't go deeper than that, i.e., if a defaukt key is there but some of that objects keys are missing, those missing keys will not be added.
		mergedSettings.schedulers = {
			...SettingsManager.DEFAULT_DATA.schedulers,
			...(data?.settings?.schedulers || {})
		};

		return {
			...{},
			...{
				settings: mergedSettings,
				data: {
					...DataStore.DEFAULT_DATA,
					...data?.data || {}
				}
			} satisfies PluginData
		};
	}

	/** Writes {@link latestPluginDataRef} to disk. */
	private async savePluginData() {
		await this.saveData(this.latestPluginDataRef);
	}

	private onSettingsSaved(changedInfo?: SettingsChangedInfo) {
		switch (changedInfo) {
			case "schedulerConfig":
				this.scheduler.configure(this.createSchedulerConfig());
				break;
		}
	}

	private createSchedulerConfig() {
		const config = this.settingsManager.defaultScheduler.config;
		Env.assert(config);
		return {
			enableFuzz: config.enableFuzz,
		} satisfies FsrsSchedulerConfig;
	}
}
