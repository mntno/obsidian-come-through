import { PluginSettingTab, Setting, Plugin } from "obsidian";
import { PLUGIN_NAME } from "UIAssistant";
import { deepEqual } from 'fast-equals';
import { isString } from "TypeAssistant";

export interface PluginSettings {
	uiPrefix: string;
	hideCardSectionMarker: boolean;
	hideDeclarationInReadingView: boolean;
	/** Defines the time duration in seconds after which "removed" metadata items are eligible for permanent deletion. Items with a "removed date" property older than the current time minus this threshold will be purged. Must be a non-negative integer. */
	removedItemsPurgeThreshold: number;
	defaultScheduler: string;
  schedulers: Record<string, SchedulerSetting>;
}

export interface SchedulerConfigSettingItem {
  enableFuzz: boolean;
}

export interface FixedIntervalSchedulerConfigSettingItem extends SchedulerConfigSettingItem {
  intervalMin: number;
}

export interface FsrsSchedulerConfigSettingItem extends SchedulerConfigSettingItem {
  reviewSortOrder: string;
}

export interface FsrsScheduler {
  type: "fsrs";
  config: FsrsSchedulerConfigSettingItem;
}

export interface FixedIntervalScheduler {
  type: "fixedInterval";
  config: FixedIntervalSchedulerConfigSettingItem;
}

export type SchedulerSetting = FsrsScheduler | FixedIntervalScheduler;
const SCHEDULER_ID_DEFUALT = "default";

export type SettingsChanged = (settings: PluginSettings, isExternal: boolean) => void;

export type SettingsChangedInfo = "schedulerConfig"; // | "x"

export class SettingsManager {

	/** For reading and writing settings. */
	public settings: PluginSettings;

	/** Saves the {@link settings} to disk. */
	public save: (changedInfo?: SettingsChangedInfo) => Promise<void>;

	public static readonly DEFAULT_DATA: PluginSettings = {
		uiPrefix: PLUGIN_NAME,
		hideCardSectionMarker: false,
		hideDeclarationInReadingView: false,
		removedItemsPurgeThreshold: 24 * 60 * 60,
		defaultScheduler: SCHEDULER_ID_DEFUALT,
		schedulers: {
			[SCHEDULER_ID_DEFUALT]: {
				type: "fsrs",
				config: {
					enableFuzz: true,
					reviewSortOrder: "due"
				}
			}
		}
	};

	public constructor(settings: PluginSettings, save: (settings: PluginSettings) => Promise<void>, onSaved: (changedInfo?: SettingsChangedInfo) => void) {
		this.settings = settings;
		this.save = async (changedInfo?: SettingsChangedInfo) => {
			await save(this.settings);
			onSaved?.(changedInfo);
			this.notifyOnChangedListeners(false);
		};
	}

	/**
		* Overwrites the current settings with {@link settings} if they are not equal, in which case the change listerners are invoked.
		*
		* Note: {@link save} is not called. If method returns `true`, it's the caller's responsibility to persist the new values.
		*
		* @param settings
		* @returns `true` if {@link settings} is not equal to the current settings.
		*/
	public onSettingsChangedExternally(settings: PluginSettings, changed?: (settings: PluginSettings) => void) {
		const isNotEqual = !deepEqual(settings, this.settings);
		if (isNotEqual) {
			this.settings = settings;
			changed?.(this.settings);
			this.notifyOnChangedListeners(true);
		}
		return isNotEqual;
	}

	public registerOnChangedCallback(evt: SettingsChanged) {
		if (!this.registeredChangedCallbacks.includes(evt))
			this.registeredChangedCallbacks.push(evt);
	}

	public unregisterOnChangedCallback(evt: SettingsChanged) {
		this.registeredChangedCallbacks = this.registeredChangedCallbacks.filter(callback => callback !== evt);
	}

	private notifyOnChangedListeners(isExternal: boolean) {
		this.registeredChangedCallbacks.forEach(cb => cb(this.settings, isExternal));
	}

	private registeredChangedCallbacks: SettingsChanged[] = [];

	public get defaultScheduler(): SchedulerSetting {
		return this.settings.schedulers[isString(this.settings.defaultScheduler) ? this.settings.defaultScheduler : SCHEDULER_ID_DEFUALT];
	}
}

export class SettingTab extends PluginSettingTab {
	private settingsManager: SettingsManager;

	public constructor(plugin: Plugin, settingsManager: SettingsManager) {
		super(plugin.app, plugin);
		this.settingsManager = settingsManager;
	}

	private onChangedCallback: SettingsChanged = (_, isExternal) => {
		if (isExternal)
			this.display();
	}

	public display(): void {
		this.settingsManager.registerOnChangedCallback(this.onChangedCallback);
		const { containerEl } = this;
		const settings = this.settingsManager.settings;

		containerEl.empty();

		new Setting(containerEl)
			.setName("UI prefix")
			.setDesc(`Adds a prefix to UI elements, such as menu items and notices, to help distinguish them from other sources when not obvious. Leave empty to disable.`)
			.addText((component) => {
				component.setValue(settings.uiPrefix);
				component.onChange(async (value) => {
					settings.uiPrefix = value;
					await this.settingsManager.save();
				});
			});

		new Setting(containerEl)
			.setName("Hide card heading in review")
			.setDesc(`Hide the headings that start the sections that contains cards’ sides.`)
			.addToggle((component) => {
				component.setValue(settings.hideCardSectionMarker);
				component.onChange(async (value) => {
					settings.hideCardSectionMarker = value;
					await this.settingsManager.save();
				});
			});
	}

	public hide(): void {
		this.settingsManager.unregisterOnChangedCallback(this.onChangedCallback);
	}
}
