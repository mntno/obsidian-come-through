import { Env } from "#/env";
import { SettingDefaults } from "#/settings/SettingDefaults";
import type { PluginSettings, ProcessorSettings, SchedulerSetting } from "#/settings/types";
import { Str } from "#/utils/ts";
import { deepEqual } from "fast-equals";

export type SettingsChanged = (settings: PluginSettings, isExternal: boolean) => Promise<void> | void;

export type SettingsChangedInfo = "schedulerConfig";// | typeof UNARY_UNION_DEFAULT;

export class SettingsManager {

	/** For reading and writing settings. */
	public settings: PluginSettings;

	/** Saves the {@link settings} to disk. */
	public readonly save: (changedInfo?: SettingsChangedInfo) => Promise<void>;

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
	 * Merges raw (potentially partial) settings with defaults to produce a complete {@link PluginSettings} object.
	 *
	 * @param rawSettings - Deserialized settings to handle, or `undefined` if settings have never been serialized.
	 * @returns A new {@link PluginSettings} object with all fields present.
	 */
	public static fromPartial(rawSettings: Partial<PluginSettings> | undefined): PluginSettings {
		const defaults = SettingDefaults.forInitial();

		// Prepare a temporary settings object by merging top-level properties.
		const merged = {
			...defaults,
			...rawSettings || {}
		};

		// Explicitly merge the nested `schedulers` object.
		// This combines the default schedulers with any schedulers from the loaded data.
		// This only adds the default scheduler object(s) if their keys are missing, but it doesn't go deeper than that, i.e., if a default key is there but some of that object's keys are missing, those missing keys will not be added.
		merged.schedulers = {
			...defaults.schedulers,
			...(rawSettings?.schedulers || {})
		};

		merged.processors = {
			...defaults.processors,
			...(rawSettings?.processors || {})
		} satisfies ProcessorSettings;

		return merged;
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

	/** @returns The settings of the selected default scheduler. */
	public get defaultScheduler(): SchedulerSetting {
		const defaultScheduler = this.settings.schedulers[
			Str.is(this.settings.defaultScheduler)
				? this.settings.defaultScheduler
				: SettingDefaults.forDefault.id
		];
		Env.assert(defaultScheduler !== undefined, "Corrupt settings.");

		return defaultScheduler !== undefined ? defaultScheduler : SettingDefaults.forDefault.scheduler;
	}
}
