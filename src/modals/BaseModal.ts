import { CssClass } from "#/constants";
import { Env } from "#/env";
import { CssClass as ObsCssClass } from "#/utils/obs/constants";
import { App, Modal, Setting } from "obsidian";

/**
 * - Adds a plugin specific class to all modals for styling purposes.
 * - Adds mobile hacks.
 */
export class BaseModal extends Modal {
	constructor(app: App, options?: {
		fullscreenOnLimitedScreenSpace: boolean,
	}) {
		super(app);

		// DOM when opening the "Show debug info" modal:
		//
		// <div class="modal-container mod-dim">  			<-- this.containerEl
		// 	<div class="modal-bg" style="opacity: 0.85;"></div>
		// 	<div class="modal mod-lg" style="">					<-- this.modalEl
		// 		<div class="modal-close-button"></div>
		// 		<div class="modal-header">
		// 			<div class="modal-title"></div>
		// 		</div>
		// 		<div class="modal-content"></div>					<--- this.contentEl
		// 		<div class="modal-button-container"></div>
		// 	</div>
		// </div>

		// "Show debug info" modal has this class which makes the height 100% on mobile, i.e. fullscreen.
		// If modal contains a lot of content and therefore expands in height, it will never fill the entire screen. So in those cases, it's better to force fullscreen.
		if (options?.fullscreenOnLimitedScreenSpace && Env.isPhone)
			this.modalEl.addClass(ObsCssClass.Modal.LG);

		this.contentEl.addClass(CssClass.Modal.CONTENT);
	}

	public override onOpen(): Promise<void> | void {
		const result = super.onOpen();
		if (this.focusEl !== undefined)
			this.focusEl.focus();
		return result;
	}

	public override onClose(): void {
		super.onClose();
	}

	protected setFocusEl(el: HTMLElement) {
		this.focusEl = el;
	}
	private focusEl?: HTMLElement;

	protected createSetting(name: string, o?: { styleControlElAsDesc?: boolean, isHeading?: boolean }) {
		const s = new Setting(this.contentEl).setName(name)
		if (o?.styleControlElAsDesc)
			s.controlEl.addClass(ObsCssClass.Setting.Item.DESC);
		if (o?.isHeading)
			s.setHeading();
		return s;
	}

	/** Using this you get better bottom margins on mobile than adding buttons on a `Setting`. */
	protected getButtonContainer() {
		// Try to find existing button container, or create one if it doesn't exist
		let buttonContainer = this.modalEl.querySelector<HTMLElement>("." + ObsCssClass.Modal.BUTTON_CONTAINER);
		if (buttonContainer === null)
			buttonContainer = this.contentEl.createDiv(ObsCssClass.Modal.BUTTON_CONTAINER);
		return buttonContainer;
	}

	protected addDoneButton(onMobileOnly: boolean) {
		if (onMobileOnly && !Env.isMobile)
			return;

		this.getButtonContainer().createEl("button", {
			text: "Done",
			cls: ObsCssClass.Modal.CANCEL,
		}, (button => {
			button.addEventListener("click", () => this.close());
		}))
	}
}
