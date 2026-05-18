import { Arr } from "#/utils/ts";
import { Env } from "#/env";
import { t } from "#/Localization";
import { SettingsManager } from "#/settings/SettingsManager";
import type { BracketId, PluginSettings, ProcessorSettings } from "#/settings/types";
import { El } from "#/utils/obs/dom";
import { Setting, SettingDefinitionGroup, /* SettingDefinitionItem, */ SettingDefinitionPage, SettingDefinitionRender } from "obsidian";

const _PROCESSOR_KEY = "processors" satisfies keyof PluginSettings;
//const key = (name: keyof ProcessorSettings): ProcessorControlKey => `${_PROCESSOR_KEY}.${name}`;
export type ProcessorControlKey = `${typeof _PROCESSOR_KEY}.${keyof ProcessorSettings}`;

const ProcessorSetting = {
	Bracket: {
		ID: [
			"parentheses",
			"curlyBraces",
			"squareBrackets",
			"angleBrackets",
			...(Env.isDev ? ([
				"doubleParentheses",
				"doubleCurly",
				"doubleAngle"
			] as const) : Arr.empty),
		] as readonly BracketId[],
	}
};

export class ProcessingSettingPage {

	public static get(settingsManager: SettingsManager): SettingDefinitionPage<ProcessorControlKey> {
		return {
			type: "page",
			name: t.settings.processor.name,
			desc: t.settings.processor.description,
			items: [
				ProcessingSettingPage.bracketEnabledGroup(settingsManager),
				// ProcessingSettingPage.preventMultiplePlaybackRow(),
				// ProcessingSettingPage.applyLangTagsToNonLatinScriptsRow(),
			],
		};
	}

	// private static preventMultiplePlaybackRow(): SettingDefinitionItem<ProcessorControlKey> {
	// 	return {
	// 		name: t.settings.processor.preventMultiplePlayback.name,
	// 		desc: t.settings.processor.preventMultiplePlayback.description,
	// 		control: { type: "toggle", key: key("preventMultiplePlayback") },
	// 	};
	// }

	// private static applyLangTagsToNonLatinScriptsRow(): SettingDefinitionItem<ProcessorControlKey> {
	// 	return {
	// 		name: t.settings.processor.applyLangTagsToNonLatinScripts.name,
	// 		desc: t.settings.processor.applyLangTagsToNonLatinScripts.description,
	// 		control: { type: "toggle", key: key("applyLangTagsToNonLatinScripts") },
	// 	};
	// }

	private static bracketEnabledGroup(settingsManager: SettingsManager): SettingDefinitionGroup<ProcessorControlKey> {
		return {
			type: "group",
			heading: t.settings.processor.brackets.name,
			items: [
				{
					name: t.settings.processor.brackets.description,
					render: (setting) => {
						setting.nameEl.empty();
						setting.setDesc(t.settings.processor.brackets.description);
					},
				},
				...ProcessorSetting.Bracket.ID.map((id): SettingDefinitionRender => ({
					name: t.settings.processor.brackets.brackets[id].name,
					desc: t.settings.processor.brackets.brackets[id].description,
					render: (setting) => {
						setting.addToggle((toggle) => {
							toggle.setValue(settingsManager.settings.processors.brackets[id]?.enabled ?? false);
							toggle.onChange(async (value) => {
								const raw = settingsManager.settings.processors.brackets;
								settingsManager.settings.processors.brackets = {
									...raw,
									[id]: {
										...raw[id],
										enabled: value
									},
								};
								await settingsManager.save();
							});
						});
					},
				})),
			],
		};
	}

	/** For Obsidian < 1.13 */
	public static display(settingsManager: SettingsManager, containerEl: HTMLElement): void {
		const settings = settingsManager.settings;

		new Setting(containerEl)
			.setName(t.settings.processor.name)
			.setHeading();

		const bracketSetting = new Setting(containerEl)
			.setName(t.settings.processor.brackets.name)
			.setDesc(t.settings.processor.brackets.description);

		const chipGroup = El.create(bracketSetting.descEl, "div", { cls: "bracket-checkbox-list" });

		for (const id of ProcessorSetting.Bracket.ID) {
			const label = El.create(chipGroup, "label");
			const cb = El.create(label, "input", { attr: { type: "checkbox" } });
			cb.checked = settings.processors.brackets[id]?.enabled ?? false;
			cb.addEventListener("change", () => {
				void (async () => {
					const raw = settings.processors.brackets;
					settings.processors.brackets = {
						...raw,
						[id]: {
							...raw[id],
							enabled: cb.checked
						}
					};
					await settingsManager.save();
				})();
			});
			label.append(` ${t.settings.processor.brackets.brackets[id].name}`);
		}

		// new Setting(containerEl)
		// 	.setName(t.settings.processor.preventMultiplePlayback.name)
		// 	.setDesc(t.settings.processor.preventMultiplePlayback.description)
		// 	.addToggle((c) => {
		// 		c.setValue(settings.processor.preventMultiplePlayback);
		// 		c.onChange(async (v) => {
		// 			settings.processor.preventMultiplePlayback = v;
		// 			await settingsManager.save();
		// 		});
		// 	});

		// new Setting(containerEl)
		// 	.setName(t.settings.processor.applyLangTagsToNonLatinScripts.name)
		// 	.setDesc(t.settings.processor.applyLangTagsToNonLatinScripts.description)
		// 	.addToggle((c) => {
		// 		c.setValue(settings.processor.applyLangTagsToNonLatinScripts);
		// 		c.onChange(async (v) => {
		// 			settings.processor.applyLangTagsToNonLatinScripts = v;
		// 			await settingsManager.save();
		// 		});
		// 	});
	}
}
