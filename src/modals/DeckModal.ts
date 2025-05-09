import { App, ButtonComponent, Modal, Setting } from "obsidian";
import { DeckEditor, DeckIDDataTuple, DataStore } from "DataStore";
import { UIAssistant } from "UIAssistant";
import { DeckID } from "FullID";


export class DeckModal extends Modal {

  private nameOfDeck: string = "";
  private parentDeckID?: DeckID;
  private createButton: ButtonComponent;
  private result?: DeckIDDataTuple;

  public static add(app: App,
    data: DataStore,
    onAdded: (deck: DeckIDDataTuple) => void) {
      new DeckModal(app, data, onAdded).open();
  }

  constructor(
    readonly app: App,
    private readonly data: DataStore,
    private readonly onSubmit: (deck: DeckIDDataTuple) => void,
    private readonly idToEdit?: DeckID) {
    super(app);

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

        component.addOption(UIAssistant.DECK_ID_UNDEFINED, "None");
        for (const deck of this.data.getAllDecks().filter(d => d.id !== this.idToEdit))
            component.addOption(deck.id, deck.data.n);
        component.setValue(this.parentDeckID ?? UIAssistant.DECK_ID_UNDEFINED);

        component.onChange((value) => {
          this.parentDeckID = value === UIAssistant.DECK_ID_UNDEFINED ? undefined : value;
        });
      });

    new Setting(this.contentEl)
      .addButton((button) => {
        this.createButton = button;
        button.setDisabled(this.nameOfDeck.trim().length == 0);
        button.setCta()
        button.setButtonText(this.idToEdit ? "Save" : "Create new deck");
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

  // onOpen(): void {
  //   super.onOpen();
  // }

  onClose(): void {
    super.onClose();

    if (this.result) {
      const result = this.result;
      setTimeout(() => this.onSubmit(result), 1);
    }
  }

  private async submit() {
    const cb = (editor: DeckEditor) => {
      editor.setName(this.nameOfDeck);
      editor.setParent(this.parentDeckID);
      return true;
    };

    let deckID: DeckID;
    if (this.idToEdit) {
      deckID = this.idToEdit;
      this.data.editDeck(this.idToEdit, cb);
    }
    else {
      deckID = this.data.createDeck(cb).id;
    }
    await this.data.save();

    const deck = this.data.getDeck(deckID, true);
    this.result = { id: deckID, data: deck! };
  }
}
