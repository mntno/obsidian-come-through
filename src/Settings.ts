import { PluginSettingTab, Setting, Plugin, Platform } from "obsidian";
import { PLUGIN_NAME } from "UIAssistant";

export interface PluginSettings {	
  uiPrefix: string;
	hideCardSectionMarker: boolean;
}

export class SettingsManager {
	public settings: PluginSettings;
	public save: () => Promise<void>;
	public onChangedCallback?: (name: string, value: any) => void;

	static readonly DEFAULT_DATA: PluginSettings = {		
    uiPrefix: PLUGIN_NAME,
		hideCardSectionMarker: false,
	};

	static readonly SETTING_NAME = {
	} as const;

	constructor(settings: any, save: (settings: PluginSettings) => Promise<void>, onChangedCallback?: (name: string, value: any) => void) {
		this.settings = settings;
		this.save = () => save(this.settings);
		this.onChangedCallback = onChangedCallback;
	}
}

export class SettingTab extends PluginSettingTab {
	private settingsManager: SettingsManager;

	constructor(plugin: Plugin, settingsManager: SettingsManager) {
		super(plugin.app, plugin);
		this.settingsManager = settingsManager;
	}

	display(): void {
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
}