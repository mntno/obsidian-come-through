import { DeckModal } from "modals/DeckModal";
import { ItemView, Menu, setIcon, setTooltip, WorkspaceLeaf } from "obsidian";
import { DataStore } from "DataStore";
import { ViewAssistant } from "views/ViewAssistant";
import { DeckID } from "FullID";


export class DecksView extends ItemView {

	public static readonly TYPE = "come-through-view-decks";
	private readonly viewAssistant = new ViewAssistant();

	constructor(
		leaf: WorkspaceLeaf,
		private readonly data: DataStore) {
		super(leaf);

		this.navigation = true;
	}

	//#region

	getIcon() {
		return "file-stack";
	}

	getViewType(): string {
		return DecksView.TYPE;
	}

	getDisplayText(): string {
		return "Decks";
	}

	protected async onOpen() {
		this.data.registerOnChangedCallback(this.onDataChangedCallback);
		this.addAction("refresh-cw", "Reload", () => {
			this.refreshView();
		});

		this.contentEl.empty();
		this.viewAssistant.init(this.contentEl);

		await this.refreshView();
	}

	protected async onClose() {
		this.data.unregisterOnChangedCallback(this.onDataChangedCallback);
		this.viewAssistant.deinit();
	}

	//#endregion

	private onDataChangedCallback = () => this.refreshView();

	private async refreshView() {

		this.viewAssistant.empty();

		const allCards = this.data.getAllCards();
		const decks = this.data.getAllDecks();
		const numberOfCardsInDefaultDeck = allCards.filter(this.data.filter.cardsWithoutDeck).length;

		//this.viewAssistant.createH1({ text: "Decks" });

		this.viewAssistant.createPara({
			text: `There are ${allCards.length - numberOfCardsInDefaultDeck} cards in a total of ${decks.length} decks.`
		});

		if (numberOfCardsInDefaultDeck > 0) {
			this.viewAssistant.createPara({
				text: `${(numberOfCardsInDefaultDeck == 1 ? "1 card is" : `${numberOfCardsInDefaultDeck} cards are`)} not assigned to any deck.`
			});
		}

		const table = this.viewAssistant.createTable()
		const header = table.createEl("thead");
		header.createEl("tr", {}, (headerRow) => {
			headerRow.createEl("th", { text: "Name" });
			headerRow.createEl("th", { text: "Cards" });
			headerRow.createEl("th", { text: "Parent deck" });
			headerRow.createEl("th", { text: "" }, (th) => {
				th.createEl("button", { text: "Add" }, (button) => {
					setIcon(button, "plus");
					setTooltip(button, "Add new deck");
					this.registerDomEvent(button, "click", this.add.bind(this));
				});
			});
		});

		const body = table.createEl("tbody");

		for (const deck of decks) {
			const numberOfCardsInDeck = allCards.filter(card => this.data.filter.cardsInDeck(deck.id, card)).length;
			const rowID = body.createEl("tr");

			rowID.createEl("td", { text: deck.data.n });
			rowID.createEl("td", {
				text: numberOfCardsInDeck.toString()
			});
			rowID.createEl("td", {
				text: deck.data.p.length == 0 ? "None" : deck.data.p
					.map(parentID => this.data.getDeck(parentID))
					.filter(d => d !== null)
					.map(d => d.n)
					.join(", ")
			});
			rowID.createEl("td", {}, (td) => {
				const ellipsisButton = td.createEl("button", {}, (button) => {

					this.registerDomEvent(button, 'click', (evt: MouseEvent) => {
						const menu = new Menu();
						menu.addItem((item) => {
							item.setTitle("Edit");
							item.setIcon("pen");
							item.onClick(this.edit.bind(this, deck.id));
						});

						menu.addItem((item) => {
							item.setTitle("Delete")
							item.setIcon("trash")
							item.setDisabled(numberOfCardsInDeck > 0)
							item.onClick(this.delete.bind(this, deck.id));
						});

						menu.showAtMouseEvent(evt);
					});
				});
				setIcon(ellipsisButton, "ellipsis-vertical");
			});
		}
	}

	private add() {
		new DeckModal(this.app, this.data, (_) => {
			this.refreshView();
		}).open();
	}

	private edit(deckID: DeckID) {
		new DeckModal(this.app, this.data, (_) => {
			this.refreshView();
		}, deckID).open();
	}

	private async delete(deckID: DeckID) {
		this.data.deleteDeck(deckID, undefined, true);
		await this.data.save();
		this.refreshView();
	}
}
