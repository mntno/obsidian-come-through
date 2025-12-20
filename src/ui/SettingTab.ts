import t from "Localization";
import { Plugin, PluginSettingTab, Setting } from "obsidian";
import { SettingsChanged, SettingsManager } from "Settings";


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
			.setName(t.settings.uiPrefix.name)
			.setDesc(t.settings.uiPrefix.description)
			.addText((component) => {
				component.setValue(settings.uiPrefix);
				component.onChange(async (value) => {
					settings.uiPrefix = value;
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
	}

	public hide(): void {
		this.settingsManager.unregisterOnChangedCallback(this.onChangedCallback);
	}
}
