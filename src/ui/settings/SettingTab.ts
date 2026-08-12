import { Env } from "#/env";
import { t } from "#/Localization";
import { SettingsChanged, SettingsManager } from "#/settings/SettingsManager";
import type { PluginSettings } from "#/settings/types";
import { Icon } from "#/ui/constants";
import { ProcessingSettingPage, ProcessorControlKey } from "#/ui/settings/ProcessingSettingPage";
import { SchedulerSettingPage } from "#/ui/settings/SchedulerSettingPage";
import { Obj, Str } from "#/utils/ts";
import { Plugin, PluginSettingTab, requireApiVersion, Setting, SettingDefinitionItem } from "obsidian";

/**
 * Adding `schedulers: Record<string, SchedulerSetting>` to the union would:
 * - contribute nothing (no control keys validate against it), and
 * - break the design: `ControlKey` is a union of **string literal dot-paths**, but `SchedulerSetting` is a value type keyed by arbitrary runtime ids (`Record<string, SchedulerSetting>`), which can't be a literal dot-path.
 */
type ControlKey = keyof PluginSettings | ProcessorControlKey;

export class SettingTab extends PluginSettingTab {
	private settingsManager: SettingsManager;

	public constructor(plugin: Plugin, settingsManager: SettingsManager) {
		super(plugin.app, plugin);
		this.settingsManager = settingsManager;
		if (requireApiVersion("1.11.0"))
			this.icon = Icon.PLUGIN;

		if (requireApiVersion("1.13.0")) // https://github.com/obsidianmd/eslint-plugin/issues/151
			plugin.settings = settingsManager.settings;

		this.settingsManager.registerOnChangedCallback(this.onChangedCallback);
		plugin.register(() => {
			this.settingsManager.unregisterOnChangedCallback(this.onChangedCallback);
		});
	}

	private onChangedCallback: SettingsChanged = (_, isExternal) => {
		if (isExternal) {
			if (requireApiVersion("1.13.0"))
				this.update();
			else
				this.display(); // Legacy refresh: display() is the only way to re-render the tab on Obsidian < 1.13.0.
		}
	}

	public override getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
		return [
			{
				name: t.settings.uiPrefix.name,
				desc: t.settings.uiPrefix.description,
				control: {
					type: "text",
					key: "uiPrefix",
					placeholder: t.settings.uiPrefix.name,
					validate: (value: string) => {
						return /^[a-z0-9 ]*$/i.test(value.trim()) ? undefined : t.settings.uiPrefix.validationMessage;
					},
				},
			},
			{
				name: t.settings.hideCardHeadingInReview.name,
				desc: t.settings.hideCardHeadingInReview.description,
				control: {
					type: "toggle",
					key: "hideCardSectionMarker"
				}
			},
			{
				type: "group",
				heading: "Advanced",
				items: [
					ProcessingSettingPage.get(this.settingsManager),
					...(Env.isDev
						? [SchedulerSettingPage.get<ControlKey>(
							this.app,
							this.settingsManager,
							() => requireApiVersion("1.13.0") ? this.update() : undefined,
						)]
						: []),
				],
			},
		];
	}

	public override getControlValue(key: string): unknown {
		return SettingTab.getPath(this.settingsManager.settings as unknown as Record<string, unknown>, key);
	}

	public override async setControlValue(key: string, value: unknown): Promise<void> {
		SettingTab.setPath(this.settingsManager.settings as unknown as Record<string, unknown>, key, Str.is(value) ? value.trim() : value);
		await this.settingsManager.save();
	}

	/**
	 * Reads a value from {@link obj} using a dot-separated {@link path}.
	 *
	 * See {@link https://docs.obsidian.md/Plugins/User+interface/Settings#Advanced+nested+settings+with+dot-notation+keys | Advanced: nested settings with dot-notation keys }
	 *
	 * @param obj The object to read from.
	 * @param path The dot-separated path to the property.
	 * @returns The value at {@link path}, or `undefined` if any segment is `null`, a non-object, or missing.
	 */
	private static getPath(obj: Record<string, unknown>, path: string): unknown {
		let cursor: unknown = obj;
		for (const part of path.split(".")) {
			const next = Obj.try<Record<string, unknown>>(cursor);
			if (next === null)
				return undefined;
			cursor = (cursor as Record<string, unknown>)[part];
		}
		return cursor;
	}

	/**
	 * Sets a value on {@link obj} at a dot-separated {@link path}.
	 * Intermediate segments that are `null` or non-objects are replaced with `{}`
	 *
	 * See {@link https://docs.obsidian.md/Plugins/User+interface/Settings#Advanced+nested+settings+with+dot-notation+keys | Advanced: nested settings with dot-notation keys }
	 *
	 * @param obj The object to mutate.
	 * @param path The dot-separated path to the property. The last segment is the property to set.
	 * @param value The value to write.
	 */
	private static setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
		const parts = path.split(".");
		const last = parts.pop()!;
		let cursor: Record<string, unknown> = obj;
		for (const part of parts) {
			let next = cursor[part];
			if (!Obj.is(next)) {
				next = {};
				cursor[part] = next;
			}
			cursor = next as Record<string, unknown>;
		}
		cursor[last] = value;
	}

	public override display(): void {

		const { containerEl } = this;
		const settings = this.settingsManager.settings;

		containerEl.empty();

		new Setting(containerEl)
			.setName(t.settings.uiPrefix.name)
			.setDesc(t.settings.uiPrefix.description)
			.addText((component) => {
				component.setValue(settings.uiPrefix);
				component.onChange(async (value) => {
					settings.uiPrefix = value.trim();
					await this.settingsManager.save();
				});
			});

		new Setting(containerEl)
			.setName(t.settings.hideCardHeadingInReview.name)
			.setDesc(t.settings.hideCardHeadingInReview.description)
			.addToggle((component) => {
				component.setValue(settings.hideCardSectionMarker);
				component.onChange(async (value) => {
					settings.hideCardSectionMarker = value;
					await this.settingsManager.save();
				});
			});

		ProcessingSettingPage.display(this.settingsManager, containerEl);
	}
}
