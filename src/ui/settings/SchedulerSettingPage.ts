import { t } from "#/Localization";
import { SchedulerModal, SchedulerModalResult } from "#/modals/SchedulerModal";
import { SettingDefaults } from "#/settings/SettingDefaults";
import { SettingsManager } from "#/settings/SettingsManager";
import { SchedulerSetting } from "#/settings/types";
import { Icon } from "#/ui/constants";
import type { App, SettingDefinitionList, SettingDefinitionPage, SettingDefinitionRender } from "obsidian";
import { ConfirmationModal, requireApiVersion } from "obsidian";

export class SchedulerSettingPage {

	public static get<K extends string>(app: App, settingsManager: SettingsManager, refresh: () => void): SettingDefinitionPage<K> {
		const settings = settingsManager.settings;

		const sortedEntries = Object.entries(settings.schedulers).sort(([a], [b]) => a.localeCompare(b));
		const sortedIds = sortedEntries.map(([id]) => id);
		const listEntries = sortedEntries.filter(([id]) => id !== SettingDefaults.forDefault.id);

		return {
			type: "page",
			name: t.settings.schedulers.name,
			desc: t.settings.schedulers.description,
			items: [
				SchedulerSettingPage.defaultSchedulerRow(settingsManager, sortedIds),
				SchedulerSettingPage.defaultRow(app, settingsManager, refresh),
				SchedulerSettingPage.schedulerList<K>(app, settingsManager, refresh, listEntries),
			],
		};
	}

	private static defaultSchedulerRow(settingsManager: SettingsManager, sortedIds: string[]): SettingDefinitionRender {
		const settings = settingsManager.settings;
		return {
			name: t.settings.schedulers.defaultScheduler.name,
			desc: t.settings.schedulers.defaultScheduler.description,
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					for (const id of sortedIds)
						dropdown.addOption(id, id);
					dropdown.setValue(settings.defaultScheduler);
					dropdown.onChange(async (id) => {
						settings.defaultScheduler = id;
						await settingsManager.save("schedulerConfig");
					});
				});
			},
		};
	}

	private static defaultRow(app: App, settingsManager: SettingsManager, refresh: () => void): SettingDefinitionRender {
		const settings = settingsManager.settings;
		const id = SettingDefaults.forDefault.id;
		const scheduler = settings.schedulers[id] ?? SettingDefaults.forDefault.scheduler;
		return {
			name: id,
			desc: SchedulerSettingPage.summarize(scheduler),
			render: (setting) => {
				setting.addExtraButton((button) => {
					button.setIcon(Icon.Action.EDIT);
					button.setTooltip(t.button.edit);
				button.onClick(() => {
					if (settings.schedulers[id] !== undefined)
						SchedulerModal.edit(
							app,
							id,
							settings.schedulers[id],
							Object.keys(settings.schedulers),
							(oldId, result) => SchedulerSettingPage.saveScheduler(settingsManager, oldId, result, refresh),
						);
				});
				});
			},
		};
	}

	private static schedulerList<K extends string>(app: App, settingsManager: SettingsManager, refresh: () => void, entries: [string, SchedulerSetting][]): SettingDefinitionList<K> {
		const settings = settingsManager.settings;
		return {
			type: "list",
			heading: "Custom schedulers",
			emptyState: t.settings.schedulers.emptyState,
			addItem: {
				name: t.settings.schedulers.addScheduler.name,
				action: () => SchedulerModal.add(
					app,
					Object.keys(settings.schedulers),
					(_oldId, result) => SchedulerSettingPage.saveScheduler(settingsManager, undefined, result, refresh),
				),
			},
			onDelete: (index) => {
				const id = entries[index]?.[0];
				if (id === undefined)
					return;
				if (requireApiVersion("1.13.0")) {
					const modal = new ConfirmationModal(app);
					modal.setTitle(t.actions.destructive.delete(id));
					modal.contentEl.createEl("p", { text: t.actions.destructive.confirmDelete(id) });
					modal.addButton((button) => button
						.setDestructive()
						.setButtonText(t.button.delete)
						.onClick(() => SchedulerSettingPage.deleteScheduler(id, settingsManager, refresh)));
					modal.addCancelButton(t.button.cancel);
					modal.open();
				}
			},
			items: entries.map(([id, scheduler]): SettingDefinitionRender => ({
				name: id,
				desc: SchedulerSettingPage.summarize(scheduler),
				render: (setting) => {
					setting.addExtraButton((button) => {
						button.setIcon(Icon.Action.EDIT);
						button.setTooltip(t.button.edit);
					button.onClick(() => {
						if (settings.schedulers[id] !== undefined)
							SchedulerModal.edit(
								app,
								id,
								settings.schedulers[id],
								Object.keys(settings.schedulers),
								(oldId, result) => SchedulerSettingPage.saveScheduler(settingsManager, oldId, result, refresh),
							);
					});
					});
				},
			})),
		};
	}

	private static saveScheduler(
		settingsManager: SettingsManager,
		oldId: string | undefined,
		result: SchedulerModalResult,
		refresh: () => void,
	): void {
		const settings = settingsManager.settings;
		if (oldId !== undefined && oldId !== result.name) {
			delete settings.schedulers[oldId];
			if (settings.defaultScheduler === oldId)
				settings.defaultScheduler = result.name;
		}
		settings.schedulers[result.name] = result.scheduler;
		void settingsManager.save("schedulerConfig").then(refresh);
	}

	private static async deleteScheduler(id: string, settingsManager: SettingsManager, refresh: () => void): Promise<void> {
		const settings = settingsManager.settings;
		if (id === SettingDefaults.forDefault.id)
			return;
		delete settings.schedulers[id];
		if (settings.defaultScheduler === id)
			settings.defaultScheduler = SettingDefaults.forDefault.id;
		await settingsManager.save("schedulerConfig");
		refresh();
	}

	private static summarize(scheduler: SchedulerSetting): string {
		if (scheduler.type === "fsrs")
			return `${t.settings.schedulers.type.fsrs}, fuzz ${scheduler.config.enableFuzz ? "on" : "off"}, sort ${scheduler.config.reviewSortOrder}`;
		return `${t.settings.schedulers.type.fixedInterval}, fuzz ${scheduler.config.enableFuzz ? "on" : "off"}, ${scheduler.config.intervalMin} min`;
	}
}
