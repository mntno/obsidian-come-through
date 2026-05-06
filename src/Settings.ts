import { Env } from "env";
import { deepEqual } from 'fast-equals';
import { isString } from "TypeAssistant";
import { PLUGIN_NAME } from "ui/constants";

export interface PluginSettings {
	/** Trimmed. */
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
const SCHEDULER_ID_DEFAULT = "default";
const DEFAULT_SCHEDULER: FsrsScheduler = {
	type: "fsrs",
	config: {
		enableFuzz: true,
		reviewSortOrder: "due"
	}
} satisfies FsrsScheduler;

export type SettingsChanged = (settings: PluginSettings, isExternal: boolean) => Promise<void> | void;

export type SettingsChangedInfo = "schedulerConfig";// | typeof UNARY_UNION_DEFAULT;

export class SettingsManager {

	/** For reading and writing settings. */
	public settings: PluginSettings;

	/** Saves the {@link settings} to disk. */
	public readonly save: (changedInfo?: SettingsChangedInfo) => Promise<void>;

	public static readonly DEFAULT_DATA: PluginSettings = {
		uiPrefix: PLUGIN_NAME,
		hideCardSectionMarker: false,
		hideDeclarationInReadingView: false,
		removedItemsPurgeThreshold: 24 * 60 * 60,
		defaultScheduler: SCHEDULER_ID_DEFAULT,
		schedulers: {
			[SCHEDULER_ID_DEFAULT]: DEFAULT_SCHEDULER
		}
	};

	public constructor(
		settings: PluginSettings,
		save: (settings: PluginSettings) => Promise<void>,
		onSaved: (changedInfo?: SettingsChangedInfo) => void) {
		this.settings = settings;
		this.save = async (changedInfo?: SettingsChangedInfo) => {
			await save(this.settings);
			onSaved(changedInfo);
			await this.notifyOnChangedListeners(false);
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
	public async onSettingsChangedExternally(settings: PluginSettings, changed?: (settings: PluginSettings) => void) {
		const isNotEqual = !deepEqual(settings, this.settings);
		if (isNotEqual) {
			this.settings = settings;
			changed?.(this.settings);
			await this.notifyOnChangedListeners(true);
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

	private async notifyOnChangedListeners(isExternal: boolean) {
		for (const cb of this.registeredChangedCallbacks) {
			try {
				await cb(this.settings, isExternal);
			} catch (e) {
				Env.log.e("Error executing settings changed callback:", e);
			}
		}
	}

	private registeredChangedCallbacks: SettingsChanged[] = [];

	public get defaultScheduler(): SchedulerSetting {
		const scheduler = this.settings.schedulers[isString(this.settings.defaultScheduler) ? this.settings.defaultScheduler : SCHEDULER_ID_DEFAULT];
		Env.assert(scheduler !== undefined, "Corrupt settings.");
		return scheduler !== undefined ? scheduler : DEFAULT_SCHEDULER;
	}
}
