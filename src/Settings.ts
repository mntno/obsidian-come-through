import { PluginSettingTab, Setting, Plugin, Platform } from "obsidian";
import { PLUGIN_NAME } from "UIAssistant";

export interface PluginSettings {
	uiPrefix: string;
	hideCardSectionMarker: boolean;
	hideDeclarationInReadingView: boolean;
}

type SettingsChanged = (settings: PluginSettings) => void;

export class SettingsManager {
	public settings: PluginSettings;

	/** Saves the {@link settings} to disk. */
	public save: () => Promise<void>;

	public static readonly DEFAULT_DATA: PluginSettings = {
		uiPrefix: PLUGIN_NAME,
		hideCardSectionMarker: false,
		hideDeclarationInReadingView: false,
	};

	public constructor(settings: PluginSettings, save: (settings: PluginSettings) => Promise<void>) {
		this.settings = settings;
		this.save = () => save(this.settings);
	}

	public onSettingsChangedExternally(settings: PluginSettings) {
		this.settings = settings;
		this.registeredChangedCallbacks.forEach(cb => cb(this.settings));
	}

	public registerOnChangedCallback(evt: SettingsChanged) {
		if (!this.registeredChangedCallbacks.includes(evt))
			this.registeredChangedCallbacks.push(evt);
	}

	public unregisterOnChangedCallback(evt: SettingsChanged) {
		this.registeredChangedCallbacks = this.registeredChangedCallbacks.filter(callback => callback !== evt);
	}

	private registeredChangedCallbacks: SettingsChanged[] = [];
}

export class SettingTab extends PluginSettingTab {
	private settingsManager: SettingsManager;

	public constructor(plugin: Plugin, settingsManager: SettingsManager) {
		super(plugin.app, plugin);
		this.settingsManager = settingsManager;
	}

	private onChangedCallback = () => this.display();

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
