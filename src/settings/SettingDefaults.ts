import type { FixedIntervalScheduler, FsrsScheduler, PluginSettings, ProcessorSettings, SchedulerSetting } from "#/settings/types";
import { PLUGIN_NAME } from "#/ui/constants";


export class SettingDefaults {

	/** Returns the initial plugin settings. */
	public static forInitial = (): PluginSettings => ({
		uiPrefix: PLUGIN_NAME,
		hideCardSectionMarker: false,
		hideDeclarationInReadingView: false,
		removedItemsPurgeThreshold: 24 * 60 * 60,
		defaultScheduler: SettingDefaults.forDefault.id,
		schedulers: {
			[SettingDefaults.forDefault.id]: SettingDefaults.forDefault.scheduler
		},
		processors: SettingDefaults.forProcessor(),
	});


	public static forProcessor = (): ProcessorSettings => ({
		brackets: {},
	});

	public static readonly forDefault = {
		get id() {
			return "default" as const;
		},
		/** The configuration for the default scheduler. */
		get scheduler(): SchedulerSetting {
			return SettingDefaults.forScheduler("fsrs");
		}
	};

	/**
	 * Default scheduler settings.
	 *
	 * @param type - The scheduler type.
	 * @returns The scheduler settings.
	 *
	 * Calls with literal strings still hit the first two overloads and get precise types.
	 * Passing a variable typed as the wider union SchedulerSetting["type"] matches the third.
	 */
	public static forScheduler(type: "fsrs"): FsrsScheduler;
	public static forScheduler(type: "fixedInterval"): FixedIntervalScheduler;
	public static forScheduler(type: SchedulerSetting["type"]): SchedulerSetting;
	public static forScheduler(type: SchedulerSetting["type"]): SchedulerSetting {
		switch (type) {
			case "fsrs":
				return {
					type: type,
					config: {
						enableFuzz: true,
						reviewSortOrder: "due",
					},
				} as const;
			case "fixedInterval":
				return {
					type: type,
					config: {
						enableFuzz: true,
						intervalMin: 1440,
					},
				} as const;
			default: {
				const _exhaustiveCheck: never = type;
				throw new Error(`Missing case for scheduler type: ${String(_exhaustiveCheck)}`);
			}
		}
	}
}
