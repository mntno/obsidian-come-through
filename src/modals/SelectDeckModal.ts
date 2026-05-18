import { DataProvider } from "#/data/DataProvider";
import { DeckIDDataTuple } from "#/data/DataStore";
import { HtmlTag } from "#/utils/dom/constants";
import { El } from "#/utils/obs/dom";
import { Arr, Str } from "#/utils/ts";
import { App, SuggestModal } from "obsidian";

/**
	* A `null` value indicates that the user selected "All Decks".
	*/
export type OnChooseCallback = (deck: DeckIDDataTuple | null, evt: MouseEvent | KeyboardEvent) => void;

export class SelectDeckModal extends SuggestModal<DeckIDDataTuple> {

	private readonly collections: DeckIDDataTuple[];

	private readonly dataProvider: DataProvider;
	private readonly onChoose: OnChooseCallback | undefined;

	/**
		* @param decks If you already have all decks, or if you want to display a subset.
		*/
	constructor(
		app: App,
		dataProvider: DataProvider,
		decks?: DeckIDDataTuple[],
		onChoose?: OnChooseCallback) {
		super(app);

		this.dataProvider = dataProvider;
		this.onChoose = onChoose;

		this.setPlaceholder("Select deck");
		this.collections = [...[SelectDeckModal.ALL_DECKS], ...decks ?? this.dataProvider.collection.all()];
	}

	getSuggestions(query: string): DeckIDDataTuple[] | Promise<DeckIDDataTuple[]> {
		return this.collections.filter(deck => deck.data.n.toLowerCase().includes(query.toLowerCase()));
	}

	renderSuggestion(value: DeckIDDataTuple, el: HTMLElement): void {
		const numberOfCards = this.dataProvider.item.allInCollection(
			SelectDeckModal.isAllDecks(value)
				? this.collections.map(d => d.id)
				: [value.id]
		).length;

		El.create(el, "div", { text: `${value.data.n}` }).createEl("small", { text: ` (${numberOfCards})` });
		el.createEl("small", { text: value.data.p.length > 0 ? this.descendants(value) : Str.EMPTY });
	}

	onChooseSuggestion(item: DeckIDDataTuple, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose?.(SelectDeckModal.isAllDecks(item) ? null : item, evt);
	}

	private descendants(deck: DeckIDDataTuple): string {
		const parentID = Arr.first(deck.data.p);
		if (parentID !== undefined) {
			const pp = this.dataProvider.collection.fromID(parentID);
			if (pp !== null) {
				const a = this.descendants({ id: parentID, data: pp });
				return a.length > 0 ? `${a} > ${pp.n}` : pp.n;
			}
		}

		return Str.EMPTY;
	}

	private static ALL_DECKS = {
		id: HtmlTag.SELECT.OPTION.Values.NONE,
		data: {
			n: "All",
			p: []
		}
	};

	private static isAllDecks(deck: DeckIDDataTuple): boolean {
		return HtmlTag.SELECT.OPTION.isNone(deck.id);
	}
}
