import { OpenView, OpenViewCommand } from "#/commands/openView";
import { ReviewViewCommand } from "#/commands/reviewView";
import { DataStore, DataStoreRoot } from "#/data/DataStore";
import { SyncManager } from "#/data/SyncManager";
import { DeclarationManager } from "#/declarations/DeclarationManager";
import { DeclarationParser } from "#/declarations/DeclarationParser";
import { Env } from "#/env";
import t from "#/Localization";
import { ConfirmationModal } from "#/modals/ConfirmationModal";
import { Scheduler } from "#/scheduling/Scheduler";
import { FsrsSchedulerConfig } from "#/scheduling/types";
import { PluginSettings, SettingsChangedInfo, SettingsManager } from "#/Settings";
import { Icon } from "#/ui/constants";
import { SettingTab } from "#/ui/SettingTab";
import { UIAssistant } from "#/ui/UIAssistant";
import { DomState } from "#/utils/obs/DomState";
import { DecksView } from "#/views/DecksView";
import { DefinedContentView } from "#/views/DefinedContentView";
import { ReviewView } from "#/views/review/ReviewView";
import { EditorCommand } from "commands/editor";
import { Keymap, MarkdownPostProcessorContext, Plugin, TFile } from "obsidian";

interface PluginData {
	settings: PluginSettings;
	data: DataStoreRoot;
}

export default class ComeThroughPlugin extends Plugin {
	private dataStore!: DataStore;
	private scheduler!: Scheduler;
	private settingsManager!: SettingsManager;
	private syncManager!: SyncManager;
	private ui!: UIAssistant;

	/** Must reference the latest data before {@link savePluginData} is called. Only needed to hold references in order to pass to {@link Plugin.saveData}, see {@link savePluginData}. */
	private latestPluginDataRef!: PluginData;

	public override async onload() {

		this.latestPluginDataRef = await ComeThroughPlugin.loadPluginData(this);

		this.settingsManager = new SettingsManager(
			this.latestPluginDataRef.settings,
			async (settings) => {
				this.latestPluginDataRef.settings = settings;
				await this.savePluginData();
			},
			this.onSettingsSaved
		);
		DomState.init(this, document);

		this.dataStore = new DataStore(this.latestPluginDataRef.data, this.latestPluginDataRef.settings.removedItemsPurgeThreshold, async (data) => {
			this.latestPluginDataRef.data = data;
			await this.savePluginData();
		});

		this.scheduler = new Scheduler(this.dataStore, this.createSchedulerConfig());
		this.syncManager = new SyncManager(this.dataStore, this.app, () => this.scheduler.createItem());
		this.ui = new UIAssistant(this.settingsManager);

		this.addSettingTab(new SettingTab(this, this.settingsManager));
		this.addRibbonIcon(Icon.PLUGIN, this.ui.contextulize("Review"), (evt: MouseEvent) => {
			OpenView.review(this.app, this.dataStore, Keymap.isModEvent(evt));
		});

		this.app.workspace.onLayoutReady(() => this.registerEvents());

		for (const language of DeclarationManager.supportedCodeBlockLanguages) {
			this.registerMarkdownCodeBlockProcessor(language, (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				if (!this.settingsManager.settings.hideDeclarationInReadingView || UIAssistant.isInInLivePreview(this.app))
					DeclarationManager.processCodeBlock(this.app, source, el, ctx, this.dataStore);
			}, -100); // Process this code block last, allowing other plugins to alter user input first.
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

		this.addCommand(OpenViewCommand.review(this.app, this.dataStore));
		this.addCommand(OpenViewCommand.collections(this.app));
		this.addCommand(OpenViewCommand.definedContent(this.app));

		for (const command of ReviewViewCommand.setSortOrder(this.app))
			this.addCommand(command);
		for (const command of ReviewViewCommand.rate(this.app))
			this.addCommand(command);
		this.addCommand(ReviewViewCommand.showInfoModal(this.app));
		this.addCommand(ReviewViewCommand.toggleInlineInfo(this.app));
		this.addCommand(ReviewViewCommand.navigateToSourceFile(this.app));

		this.addCommand(EditorCommand.generateId());
		this.addCommand(EditorCommand.insertReviewUnit(false));
		this.addCommand(EditorCommand.insertReviewUnit(true));
	}

	public override onunload() {
		DomState.deinit();
		if (this.confirmationModal !== null)
			this.confirmationModal.forceClose();
	}

	/** This is triggered when the data file is modified by an external source, such as a sync service. */
	public override async onExternalSettingsChange() {
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
						if (this.confirmationModal === null) {
							this.confirmationModal = new ConfirmationModal(this.app);
							this.confirmationModal.onClosed = () => this.confirmationModal = null;
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
	private confirmationModal: ConfirmationModal | null = null;

	// public onUserEnable(): void {}

	/**
	 * Registers the necessary event listeners for the plugin to function.
	 * This includes file events for synchronization and context menu events for user actions.
	 */
	private registerEvents() {

		this.registerEvent(this.app.workspace.on("file-open", this.syncManager.open));
		this.registerEvent(this.app.metadataCache.on("changed", this.syncManager.changed));
		this.registerEvent(this.app.vault.on("delete", this.syncManager.delete));
		this.registerEvent(this.app.vault.on("rename", this.syncManager.rename));

		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source, _leaf) => {
			if (!(file instanceof TFile))
				return;

			const isFileIncluded = DeclarationParser.containsDeclarations(file, this.app);

			if (isFileIncluded && (/*source === "file-explorer-context-menu" ||*/ source === "more-options" || source === "tab-header")) {
				this.ui.addMenuItem(menu, t.actions.viewDeclarationsInFile, {
					onClick: async (evt) => OpenView.definedContent(this.app, file, Keymap.isModEvent(evt)),
					section: "open",
				});
			}
		}));
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

	private onSettingsSaved = (changedInfo?: SettingsChangedInfo) => {
		switch (changedInfo) {
			case "schedulerConfig":
				this.scheduler.reconfigure(this.createSchedulerConfig());
				break;
			case undefined:
				break;
		}
	};

	private createSchedulerConfig() {
		const config = this.settingsManager.defaultScheduler.config;
		return {
			enableFuzz: config.enableFuzz,
		} satisfies FsrsSchedulerConfig;
	}
}
