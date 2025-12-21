import { DataStore, DeckEditor, DeckIDDataTuple } from "#/data/DataStore";
import { DeckID } from "#/data/FullID";
import { BaseModal } from "#/modals/BaseModal";
import { HtmlTag } from "#/utils/dom/constants";
import { Str } from "#/utils/ts";
import { App, ButtonComponent, Setting } from "obsidian";

export type OnSubmitCallback = (deck: DeckIDDataTuple) => void;

export class DeckModal extends BaseModal {

	private nameOfDeck: string = Str.EMPTY;
	private parentDeckID: DeckID | null = null;
	private createButton!: ButtonComponent;
	private result: DeckIDDataTuple | undefined;

	private readonly data: DataStore;
	private readonly onSubmit: OnSubmitCallback | undefined;
	private readonly idToEdit: DeckID | undefined;

	public static add(
		app: App,
		data: DataStore,
		onAdded?: OnSubmitCallback) {
		new DeckModal(app, data, onAdded).open();
	}

	public static edit(
		app: App,
		data: DataStore,
		id: DeckID,
		onSubmit?: OnSubmitCallback) {
		new DeckModal(app, data, onSubmit, id).open();
	}

	private constructor(
		app: App,
		data: DataStore,
		onSubmit?: OnSubmitCallback,
		idToEdit?: DeckID
	) {
		super(app, { fullscreenOnLimitedScreenSpace: true });
		this.data = data;
		this.onSubmit = onSubmit;
		this.idToEdit = idToEdit;

		if (idToEdit) {
			const deckToEdit = data.getDeck(idToEdit, true)!;
			this.nameOfDeck = deckToEdit.n;
			this.parentDeckID = DeckEditor.parent(deckToEdit);
			this.setTitle("Edit deck");
		}
		else {
			this.setTitle("Create a new deck");
		}

		new Setting(this.contentEl)
			.setName("Name")
			.addText((component) => {
				component.setValue(this.nameOfDeck);
				component.onChange((text) => {
					this.nameOfDeck = text;
					this.createButton.setDisabled(this.nameOfDeck.trim().length == 0);
				});
			});

		new Setting(this.contentEl)
			.setName("Parent deck")
			.setDesc(idToEdit ? "" : "To make this deck a subdeck, choose a parent deck.")
			.addDropdown((component) => {

				component.addOption(HtmlTag.SELECT.OPTION.Values.NONE, "None");
				for (const deck of this.data.getAllDecks().filter(d => d.id !== this.idToEdit))
					component.addOption(deck.id, deck.data.n);
				component.setValue(this.parentDeckID ?? HtmlTag.SELECT.OPTION.Values.NONE);

				component.onChange((value) => {
					this.parentDeckID = HtmlTag.SELECT.OPTION.isNone(value) ? null : value;
				});
			});

		new Setting(this.contentEl)
			.addButton((button) => {
				this.createButton = button;
				button.setDisabled(this.nameOfDeck.trim().length == 0);
				button.setCta()
				button.setButtonText(Str.isNonEmpty(this.idToEdit) ? "Save" : "Create new deck");
				button.onClick(async () => {
					button.setDisabled(true);
					await this.submit();
					this.close();
				});
			})
			.addButton((button) => {
				button.setButtonText("Cancel");
				button.onClick(() => {
					this.close();
				});
			});
	}

	public override onClose(): void {
		super.onClose();

		if (this.onSubmit !== undefined && this.result !== undefined) {
			const result = this.result;
			const onSubmit = this.onSubmit;
			setTimeout(() => onSubmit(result), 1);
		}
	}

	private async submit() {
		const cb = (editor: DeckEditor) => {
			editor.setName(this.nameOfDeck);
			editor.setParent(this.parentDeckID);
			return true;
		};

		let deckID: DeckID;
		if (this.idToEdit !== undefined) {
			deckID = this.idToEdit;
			const edited = this.data.editDeck(this.idToEdit, cb);
			if (edited !== null)
				this.result = { id: deckID, data: edited };
		}
		else {
			const created = this.data.createDeck(cb);
			this.result = { id: created.id, data: created.data };
		}
		await this.data.save();
	}
}
