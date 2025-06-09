import { DataStore } from "DataStore";
import { DeckModal } from "modals/DeckModal";
import { Menu, setIcon, setTooltip, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { SettingsManager } from "Settings";
import { BaseView, BaseViewState } from "views/BaseView";


export class DecksView extends BaseView<BaseViewState> {

	public static readonly TYPE = "come-through-view-decks";

	private readonly data: DataStore;

	constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, data: DataStore) {
		super(leaf, settingsManager, { data: data });
		this.data = data;

		this.navigation = true;
	}

	public override getIcon() {
		return "file-stack";
	}

	public getViewType(): string {
		return DecksView.TYPE;
	}

	public getDisplayText(): string {
		return "Decks";
	}

	protected onSetState(state: BaseViewState, result: ViewStateResult): void {
	}

	protected onGetState(): BaseViewState {
		return {};
	}

	public override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string) {
		super.onPaneMenu(menu, source);
		if (source === "tab-header")
			return;

		menu.addItem(item => {
			item.setTitle("Reload");
			item.setSection("pane");
			item.setIcon("refresh-cw");
			item.onClick(this.refreshView);
		});
	}

	protected async onRender() {

		const allCards = this.data.getAllCards();
		const decks = this.data.getAllDecks();
		const numberOfCardsInDefaultDeck = allCards.filter(this.data.filter.cardsWithoutDeck).length;

		//this.viewAssistant.createEl("h1", { text: "Decks" });

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
					this.contentRenderer.registerDomEvent(button, "click", () => new DeckModal(this.app, this.data, () => { }).open());
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

					this.contentRenderer.registerDomEvent(button, 'click', (evt: MouseEvent) => {
						const menu = new Menu();
						menu.addItem((item) => {
							item.setTitle("Edit");
							item.setIcon("pen");
							item.onClick(() => new DeckModal(this.app, this.data, () => { }, deck.id).open());
						});

						menu.addItem((item) => {
							item.setTitle("Delete")
							item.setIcon("trash")
							item.setDisabled(numberOfCardsInDeck > 0)
							item.onClick(async () => {
								this.data.deleteDeck(deck.id, undefined, true);
								await this.data.save();
							});
						});

						menu.showAtMouseEvent(evt);
					});
				});
				setIcon(ellipsisButton, "ellipsis-vertical");
			});
		}
	}
}
