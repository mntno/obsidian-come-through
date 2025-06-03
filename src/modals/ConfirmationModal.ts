import { App, Modal, Setting } from "obsidian";
import { Platform } from 'obsidian';

/** @todo Make general */
export class ConfirmationModal extends Modal {
	public onButton1Click?: () => void;
	public onButton2Click?: () => void;
	public onClosed?: () => void;
	private canClose = false;

	constructor(app: App) {
		super(app);

		this.setTitle("External change detected");

		new Setting(this.contentEl).setDesc(createFragment((f) => {
			f.createEl("i", { text: "Plugin: Come Through" });
			f.createEl("p").appendText("Detected changes to data (such as cards, decks, rating statistics, etc) from an external source. If this change was expected, e.g., you created a card on another device that syncs with this one, click Accept changes.");

			f.createEl("p").createEl("b", { text: "Accept changes" });
			f.createEl("p").appendText("Allow this device’s cards, decks, rating statistics, etc, to be replaced with those from the other device.");

			f.createEl("p").createEl("b", { text: "Reject changes" });
			f.createEl("p").appendText("Keep this device’s cards, decks, rating statistics, etc. Having selected this option you should allow the other device(s) to overwrite its data.");
		}));

		new Setting(this.contentEl)
			.addButton((button) => {
				button.buttonEl.tabIndex = -1;
				button.setButtonText(Platform.isMobile ? "Accept changes" : "Accept changes by other device");
				button.onClick(() => {
					button.setDisabled(true);
					this.onButton1Click?.();
					this.forceClose();
				});
			})
			.addButton((button) => {
				button.buttonEl.tabIndex = -1;
				button.setButtonText(Platform.isMobile ? "Reject changes" : "Reject changes by other device");
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
