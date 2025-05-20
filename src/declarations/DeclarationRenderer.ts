import { DeckIDDataTuple } from "DataStore";
import { CardDeclaration, IncompleteDeclarationSpecification } from "declarations/CardDeclaration";
import { MarkdownRenderChild, setIcon } from "obsidian";
import { PLUGIN_ICON, UIAssistant } from "UIAssistant";
import { DeclarationCommandAssistant, DeclarationCommandInterface } from "./CommandDeclaration";
import { DeckableDeclaration, DeclarationBase } from "./Declaration";

export type DeclarationChangedType = "deckAdded" | "deckChanged";
export type DeclarationChangedEvent = (declaration: DeckableDeclaration, type: DeclarationChangedType, selectEl: HTMLSelectElement) => void;

interface DataProvider {
	getAllDecks: () => DeckIDDataTuple[];
};

export class DeclarationRenderer extends MarkdownRenderChild {

	public constructor(containerEl: HTMLElement, source: string, dataProvider: DataProvider) {
		super(containerEl);

		this.source = source;
		this.dataProvider = dataProvider;
	}

	private contentContainerEl: HTMLDivElement;
	private source: string;
	private dataProvider: DataProvider;

	private titleContainer: HTMLDivElement;
	private titleEl: HTMLDivElement;

	private beginRender() {
		this.containerEl.addClass("callout");

		this.titleContainer = this.containerEl.createDiv({ cls: "callout-title" });
		this.titleContainer.createDiv({ cls: "callout-icon" }, (icon) => setIcon(icon, PLUGIN_ICON));
		this.titleEl = this.titleContainer.createDiv({ cls: "callout-title-inner" });

		this.contentContainerEl = this.containerEl.createDiv({ cls: "callout-content" });
		return this.contentContainerEl;
	}

	private setError() {
		this.containerEl.addClass("error");
		this.titleContainer.addClass("error");
	}

	private setTitle(title: string) {
		this.titleEl.setText(title);
	}

	private addParagraph(text?: string) {
		if (text !== undefined)
			this.contentContainerEl.createEl("p", { text: text });
	}

	private addBulletList(texts: string[]) {
		this.contentContainerEl.createEl("ul", {}, (el) => {
			for (const text of texts)
				el.createEl("li", { text: text });
		});
	}

	private setYamlError(errorMessage?: string) {
		this.setError();
		this.setTitle("Invalid format entered");
		this.addParagraph(`Please check for the following:`);
		this.addBulletList([
			"Missing or misplaced colons after keys (e.g., `side front` instead of `side: front`).",
			"Incorrect spacing around colons (e.g., `side:front` instead of `side: front`).",
			"Pay close attention to how the information is indented. Sometimes, the alignment of the text matters.",
		]);

		if (errorMessage)
			this.contentContainerEl.createEl("p", { text: `Specific details: ${errorMessage}` });
	}

	/**
	*
	* @param onDomEvent DOM event registered with rendered elements such as buttons or select.
	*/
	public render(onDomEvent: DeclarationChangedEvent) {

		this.beginRender();

		const declaration = DeclarationBase.tryParseAsYaml(this.source, error => this.setYamlError(error.message));
		if (declaration === null)
			return;

		if (DeclarationCommandAssistant.conforms(declaration)) {

			if (!DeclarationCommandAssistant.isTypeValid(declaration)) {
				this.setError();
				this.setTitle("Invalid declaration command");
				this.addParagraph("Please check the entered values.");
				return;
			}

			this.renderCommandDeclaration(declaration, onDomEvent);
		}
		else {

			if (!CardDeclaration.conformsToIncompleteDeclarationSpecification(declaration)) {
				this.setError();
				this.setTitle("Invalid card declaration");
				this.addParagraph("Incomplete card declaration.");
				return;
			}

			this.renderCardDeclaration(declaration, onDomEvent);
		}
	}

	public renderCommandDeclaration(declaration: DeclarationCommandInterface, onDomEvent: DeclarationChangedEvent) {
		if (DeclarationCommandAssistant.conformsToAlternateHeadings(declaration)) {

			if (!DeclarationCommandAssistant.isAlternateHeadingsValid(declaration)) {
				this.setError();
				this.setTitle("Invalid alternate headings command");
				this.addParagraph("Please check the entered values.");
				return;
			}

			this.setTitle("Alternate headings");
			this.addParagraph(`Automatically generate a card for every other heading ${declaration.level} levels below this one, where the heading in between is the back side of the heading that came before.`);

			const contentContainer = this.contentContainerEl;
			const table = contentContainer.createEl("table");
			const body = table.createEl("tbody");

			const rowID = body.createEl("tr");
			rowID.createEl("td", { text: "Levels below this heading" });
			rowID.createEl("td", { text: declaration.level.toString() });

			this.createDeckRow(body, declaration, onDomEvent);
		}
		else {
			this.setError();
			this.setTitle("Unknown declaration command");
			this.addParagraph(DeclarationBase.toString(declaration));
		}
	}


	public renderCardDeclaration(
		declaration: IncompleteDeclarationSpecification,
		onDomEvent: DeclarationChangedEvent) {

		this.setTitle("Flashcard declaration");

		const contentContainer = this.contentContainerEl;
		const table = contentContainer.createEl("table");
		const body = table.createEl("tbody");

		const rowID = body.createEl("tr");
		rowID.createEl("td", { text: "ID" });
		rowID.createEl("td", { text: declaration.id });

		const rowSide = body.createEl("tr");
		rowSide.createEl("td", { text: "Side" });
		rowSide.createEl("td", { text: `${CardDeclaration.isFrontSide(declaration) ? "Front" : "Back"}` });

		if (CardDeclaration.isFrontSide(declaration)) {
			this.createDeckRow(body, declaration, onDomEvent);
		}
	}

	private createDeckRow(body: HTMLTableSectionElement, declaration: DeckableDeclaration, onDomEvent: DeclarationChangedEvent) {
		const rowDeck = body.createEl("tr");
		rowDeck.createEl("td", { text: "Deck" });
		const tdDropdown = rowDeck.createEl("td", { cls: "select-deck-cell" });

		const deckSelectEl = tdDropdown.createEl("select", { cls: "dropdown" }, (el) => {
			el.createEl("option", {
				text: "None",
				value: UIAssistant.DECK_ID_UNDEFINED,
			});
		});

		// Add new deck button
		tdDropdown.createEl("button", {}, (button) => {
			setIcon(button, "plus");
			this.registerDomEvent(button, "click", () => onDomEvent(declaration, "deckAdded", deckSelectEl));
		});

		// Deck selector
		const decks = this.dataProvider.getAllDecks();
		if (decks.length > 0) {
			decks.forEach(deck => {
				deckSelectEl.createEl("option", {
					text: deck.data.n,
					value: deck.id,
				}, (el) => {
					el.selected = declaration?.deckID === deck.id;
				});
			});
			this.registerDomEvent(deckSelectEl, "change", () => onDomEvent(declaration, "deckChanged", deckSelectEl));
		}
	}
}
