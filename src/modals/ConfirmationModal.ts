import t from "Localization";
import { BaseModal } from "modals/BaseModal";
import { App, Platform, Setting } from "obsidian";

export class ConfirmationModal extends BaseModal {
	public onButton1Click?: () => void;
	public onButton2Click?: () => void;
	public onClosed?: () => void;
	private canClose = false;

	constructor(app: App) {
		super(app, { fullscreenOnLimitedScreenSpace: true });

		this.setTitle(t.modals.confirmation.title);

		new Setting(this.contentEl).setDesc(createFragment((f) => {
			f.createEl("i", { text: t.modals.confirmation.pluginName });
			f.createEl("p").appendText(t.modals.confirmation.description);

			f.createEl("p").createEl("b", { text: t.modals.confirmation.acceptChangesTitle });
			f.createEl("p").appendText(t.modals.confirmation.acceptChangesDescription);

			f.createEl("p").createEl("b", { text: t.modals.confirmation.rejectChangesTitle });
			f.createEl("p").appendText(t.modals.confirmation.rejectChangesDescription);
		}));

		new Setting(this.contentEl)
			.addButton((button) => {
				button.buttonEl.tabIndex = -1;
				button.setButtonText(Platform.isMobile ? t.modals.confirmation.acceptChangesTitle : t.modals.confirmation.acceptChangesButton);
				button.onClick(() => {
					button.setDisabled(true);
					this.onButton1Click?.();
					this.forceClose();
				});
			})
			.addButton((button) => {
				button.buttonEl.tabIndex = -1;
				button.setButtonText(Platform.isMobile ? t.modals.confirmation.rejectChangesTitle : t.modals.confirmation.rejectChangesButton);
				button.onClick(() => {
					button.setDisabled(true);
					this.onButton2Click?.();
					this.forceClose();
				});
			});
	}

	public override close() {
		if (this.canClose)
			super.close();
		this.onClosed?.();
	}

	public forceClose() {
		this.canClose = true;
		this.close();
	}
}
