import { t } from "#/Localization";
import { BaseModal } from "#/modals/BaseModal";
import { ReviewSortOrder, Scheduling } from "#/scheduling/types";
import { SettingDefaults } from "#/settings/SettingDefaults";
import { SchedulerSetting } from "#/settings/types";
import { Num, Str } from "#/utils/ts";
import { forEachWithLabel } from "#/utils/ts/iteration";
import { App, ButtonComponent, DropdownComponent, Setting, TextComponent } from "obsidian";


export interface SchedulerModalResult {
	name: string;
	scheduler: SchedulerSetting;
}

export class SchedulerModal extends BaseModal {

	public static add(
		app: App,
		existingNames: string[],
		onSubmit: (oldId: string | undefined, result: SchedulerModalResult) => void,
	): void {
		new SchedulerModal(app, existingNames, onSubmit).open();
	}

	public static edit(
		app: App,
		id: string,
		scheduler: SchedulerSetting,
		existingNames: string[],
		onSubmit: (oldId: string | undefined, result: SchedulerModalResult) => void,
	): void {
		new SchedulerModal(app, existingNames, onSubmit, id, scheduler).open();
	}

	private readonly existingNames: string[]; // TODO: Remove when using a id as unique identifier.
	private readonly onSubmit: (oldId: string | undefined, result: SchedulerModalResult) => void;
	private readonly id: string | undefined;

	private name: string = "";
	private type: SchedulerSetting["type"];
	private enableFuzz: boolean;
	private reviewSortOrder: ReviewSortOrder;
	private intervalMin: number;
	private confirmButton!: ButtonComponent;

	private constructor(
		app: App,
		existingNames: string[],
		onSubmit: (oldId: string | undefined, result: SchedulerModalResult) => void,
		id?: string,
		scheduler?: SchedulerSetting,
	) {
		super(app);
		this.existingNames = existingNames;
		this.onSubmit = onSubmit;
		this.id = id;
		this.name = id ?? Str.EMPTY;

		this.type = scheduler?.type ?? "fsrs";
		this.enableFuzz = scheduler?.config.enableFuzz ?? SettingDefaults.forScheduler(this.type).config.enableFuzz;
		this.reviewSortOrder = scheduler?.type === "fsrs" ? scheduler.config.reviewSortOrder : SettingDefaults.forScheduler("fsrs").config.reviewSortOrder;
		this.intervalMin = scheduler?.type === "fixedInterval" ? scheduler.config.intervalMin : SettingDefaults.forScheduler("fixedInterval").config.intervalMin;

		this.setTitle(id !== undefined
			? `${t.modals.scheduler.edit.title}: ${id}`
			: t.modals.scheduler.add.title)

		if (id !== SettingDefaults.forDefault.id) {
			new Setting(this.contentEl)
				.setName(t.modals.scheduler.add.nameLabel)
				.addText((text) => {
					text.setPlaceholder(t.modals.scheduler.add.namePlaceholder);
					text.setValue(this.name);
					text.onChange((value) => {
						this.name = value.trim();
						this.updateSaveButton();
					});
					this.setFocusEl(text.inputEl);
				});
		}

		new Setting(this.contentEl)
			.setName(t.settings.schedulers.type.name)
			.setDesc(t.settings.schedulers.type.description)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("fsrs", t.settings.schedulers.type.fsrs)
					.addOption("fixedInterval", t.settings.schedulers.type.fixedInterval);
				dropdown.setValue(this.type);
				dropdown.onChange((value) => {
					this.type = value as SchedulerSetting["type"];
					renderTypeSpecific();
					this.updateSaveButton();
				});
			});

		new Setting(this.contentEl)
			.setName(t.settings.schedulers.enableFuzz.name)
			.setDesc(t.settings.schedulers.enableFuzz.description)
			.addToggle((toggle) => {
				toggle.setValue(this.enableFuzz);
				toggle.onChange((value) => {
					this.enableFuzz = value;
					this.updateSaveButton();
				});
			});

		const typeSpecificSetting = new Setting(this.contentEl);
		const renderTypeSpecific = () => {
			typeSpecificSetting.controlEl.empty();
			if (this.type === "fsrs") {
				typeSpecificSetting
					.setName(t.settings.schedulers.reviewSortOrder.name)
					.setDesc(t.settings.schedulers.reviewSortOrder.description);

				const dropdown = new DropdownComponent(typeSpecificSetting.controlEl);
				forEachWithLabel(
					Scheduling.reviewSortOrder,
					(value) => t.settings.schedulers.reviewSortOrder[value],
					(value, label) => {dropdown.addOption(value, label)},
				);
				dropdown
					.setValue(this.reviewSortOrder)
					.onChange((value) => {
						this.reviewSortOrder = value as ReviewSortOrder;
						this.updateSaveButton();
					});
			}
			else {
				typeSpecificSetting
					.setName(t.settings.schedulers.intervalMin.name)
					.setDesc(t.settings.schedulers.intervalMin.description);
				const text = new TextComponent(typeSpecificSetting.controlEl);
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.setValue(String(this.intervalMin));
				text.onChange((value) => {
					this.intervalMin = Math.floor(Number(value));
					this.updateSaveButton();
				});
			}
		};
		renderTypeSpecific();

		new Setting(this.contentEl)
			.addButton((button) => {
				this.confirmButton = button;
				button.setCta();
				button.setButtonText(t.button.save);
				button.onClick(async () => {
					if (!this.submit())
						return;
					button.setDisabled(true);
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText(t.button.cancel);
				button.onClick(() => this.close());
			});

		this.updateSaveButton();
	}

	/** Validates the collected scheduler values. */
	private static validate(settings: SchedulerSetting): boolean {
		if (settings.type === "fsrs")
			return true;
		return Num.is(settings.config.intervalMin) && settings.config.intervalMin >= 1;
	}

	private validate(): boolean {
		if (this.name.length === 0 || this.name.includes("."))
			return false;
		if (this.existingNames.includes(this.name) && this.name !== this.id)
			return false;
		return SchedulerModal.validate(this.build());
	}

	private updateSaveButton(): void {
		this.confirmButton.setDisabled(!this.validate());
	}

	private submit(): boolean {
		if (!this.validate())
			return false;
		this.onSubmit(this.id, { name: this.name, scheduler: this.build() });
		return true;
	}

	private build(): SchedulerSetting {
		return this.type === "fsrs"
			? { type: "fsrs", config: { enableFuzz: this.enableFuzz, reviewSortOrder: this.reviewSortOrder } }
			: { type: "fixedInterval", config: { enableFuzz: this.enableFuzz, intervalMin: this.intervalMin } };
	}
}
