import { SuggestModal, App } from "obsidian";
import { DeckIDDataTuple, DataStore } from "DataStore";


export class SelectDeckModal extends SuggestModal<DeckIDDataTuple> {

  private decks: DeckIDDataTuple[];

  constructor(
    app: App,
    private readonly data: DataStore,
    decks?: DeckIDDataTuple[],
    private readonly onChoose?: (deck: DeckIDDataTuple, evt: MouseEvent | KeyboardEvent) => void) {
    super(app);

    this.setPlaceholder("Select deck");
    this.decks = decks ?? this.data.getAllDecks();
  }

  getSuggestions(query: string): DeckIDDataTuple[] | Promise<DeckIDDataTuple[]> {
    return this.decks.filter(deck => deck.data.n.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(value: DeckIDDataTuple, el: HTMLElement): void {
    const numberOfCards = this.data.getAllCardsForDeck(value.id).length;
    el.createEl('div', { text: `${value.data.n}` }).createEl('small', { text: ` (${numberOfCards})` });
    el.createEl('small', { text: value.data.p.length > 0 ? this.descendants(value) : "" });
  }

  onChooseSuggestion(item: DeckIDDataTuple, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose?.(item, evt);
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
