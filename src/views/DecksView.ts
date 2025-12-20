import { DataStore } from "data/DataStore";
import { DeckModal } from "modals/DeckModal";
import { IconName, Menu, setIcon, setTooltip, ViewStateResult, WorkspaceLeaf } from "obsidian";
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

	public override getIcon(): IconName {
		return "file-stack";
	}

	public override getViewType(): string {
		return DecksView.TYPE;
	}

	public override getDisplayText(): string {
		return "Decks";
	}

	protected override onSetState(state: BaseViewState, result: ViewStateResult): void {
	}

	protected override onGetState(): BaseViewState {
		return {};
	}

	public override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string): void {
		super.onPaneMenu(menu, source);
		if (source === "tab-header")
			return;

		menu.addItem(item => {
			item.setTitle("Reload");
			item.setSection("pane");
			item.setIcon("refresh-cw");
			item.onClick(this.render);
		});
	}

	protected override async onRender(): Promise<void> {

		const allCards = this.data.getAllCards();
		const decks = this.data.getAllDecks();
		const numberOfCardsInDefaultDeck = allCards.filter(this.data.filter.cardsWithoutDeck).length;

		//this.dom.create.el("h1", { text: "Decks" });

		this.dom.create.para({
			text: `There are ${allCards.length - numberOfCardsInDefaultDeck} cards in a total of ${decks.length} decks.`
		});

		if (numberOfCardsInDefaultDeck > 0) {
			this.dom.create.para({
				text: `${(numberOfCardsInDefaultDeck == 1 ? "1 card is" : `${numberOfCardsInDefaultDeck} cards are`)} not assigned to any deck.`
			});
		}

		this.dom.create.table((section) => {

			section.setHeader((row) => {
				row.add((col) => {
					col.add({ text: "Name" });
					col.add({ text: "Cards" });
					col.add({ text: "Parent deck" });
					col.add(undefined, (el) => {
						el.createEl("button", { text: "Add" }, (button) => {
							setIcon(button, "plus");
							setTooltip(button, "Add new deck");
							this.contentRenderer.registerDomEvent(button, "click", () => new DeckModal(this.app, this.data, () => { }).open());
						});
					});
				});
			});

			section.addBody((row) => {
				for (const deck of decks) {
					const numberOfCardsInDeck = allCards.filter(card => this.data.filter.cardsInDeck(deck.id, card)).length;
					row.add((col) => {
						col.add({ text: deck.data.n });
						col.add({ text: numberOfCardsInDeck.toString() });
						col.add({
							text: deck.data.p.length == 0 ? "None" : deck.data.p
								.map(parentID => this.data.getDeck(parentID))
								.filter(d => d !== null)
								.map(d => d.n)
								.join(", ")
						});
						col.add(undefined, (el) => {
							const ellipsisButton = el.createEl("button", undefined, (button) => {

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
					});
				}
			});
		});
	}
}
