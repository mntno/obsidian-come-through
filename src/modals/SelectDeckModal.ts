import { DataStore, DeckIDDataTuple } from "#/data/DataStore";
import { HtmlTag } from "#/utils/dom/constants";
import { App, SuggestModal } from "obsidian";

const ALL_DECKS = {
  id: HtmlTag.SELECT.OPTION.Values.NONE,
  data: {
    n: "All Decks",
    p: []
  }
};

function isAllDecks(deck: DeckIDDataTuple): boolean {
  return HtmlTag.SELECT.OPTION.isNone(deck.id);
}

/**
	* A `null` value indicates that the user selected "All Decks".
	*/
export type OnChooseCallback = (deck: DeckIDDataTuple | null, evt: MouseEvent | KeyboardEvent) => void;

export class SelectDeckModal extends SuggestModal<DeckIDDataTuple> {

	private decks: DeckIDDataTuple[];

	private readonly onChoose: OnChooseCallback | undefined;

	/**
		* @param decks If you already have all decks, or if you want to display a subset.
		*/
  constructor(
    app: App,
    private readonly data: DataStore,
    decks?: DeckIDDataTuple[],
    onChoose?: OnChooseCallback) {
    super(app);

    this.setPlaceholder("Select deck");
		this.decks = [...[ALL_DECKS], ...decks ?? this.data.getAllDecks()];
		this.onChoose = onChoose;
  }

  getSuggestions(query: string): DeckIDDataTuple[] | Promise<DeckIDDataTuple[]> {
    return this.decks.filter(deck => deck.data.n.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(value: DeckIDDataTuple, el: HTMLElement): void {
    const numberOfCards = this.data.getAllCardsForDeck(isAllDecks(value) ? undefined : value.id).length;
    el.createEl('div', { text: `${value.data.n}` }).createEl('small', { text: ` (${numberOfCards})` });
    el.createEl('small', { text: value.data.p.length > 0 ? this.descendants(value) : "" });
  }

  onChooseSuggestion(item: DeckIDDataTuple, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose?.(isAllDecks(item) ? null : item, evt);
  }

  private descendants(deck: DeckIDDataTuple): string {
    const parentID = deck.data.p.first();
    if (parentID) {
      const pp = this.data.getDeck(parentID);
      if (pp) {
        const a = this.descendants({ id: parentID, data: pp });
        return a.length > 0 ? `${a} > ${pp.n}` : pp.n;
      }
    }

    return "";
  }
}
