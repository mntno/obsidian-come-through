import { Component, setIcon } from "obsidian";
import { UIAssistant } from "UIAssistant";
import { DeckableDeclarable, Declarable } from "declarations/Declaration";
import { DeckIDDataTuple } from "DataStore";

export type DeclarationChangedType = "deckAdded" | "deckChanged";
export type DeclarationChangedEvent = (declaration: DeckableDeclarable, type: DeclarationChangedType, selectEl: HTMLSelectElement) => void;

export interface DataProvider {
	getAllDecks: () => DeckIDDataTuple[];
};

export interface DeclarationRenderable {
	render(r: DeclarationRenderAssistant): void;
}

export abstract class DeclarationRenderer<T extends Declarable> {
	protected declarable: T;
	public constructor(declarable: T) {
		this.declarable = declarable;
	}
}

export class DeclarationRenderAssistant {

	private containerEl: HTMLElement;
	protected contentContainerEl: HTMLDivElement;
	private titleContainer: HTMLDivElement;
	private titleEl: HTMLDivElement;
	private component: Component;
	private dataProvider: DataProvider;
	protected onDomEvent: DeclarationChangedEvent

	public constructor(
		containerEl: HTMLElement,
		contentContainerEl: HTMLDivElement,
		titleContainer: HTMLDivElement,
		titleEl: HTMLDivElement,
		component: Component,
		dataProvider: DataProvider,
		onDomEvent: DeclarationChangedEvent
	) {
		this.containerEl = containerEl;
		this.contentContainerEl = contentContainerEl;
		this.titleContainer = titleContainer;
		this.titleEl = titleEl;
		this.component = component;
		this.dataProvider = dataProvider;
		this.onDomEvent = onDomEvent;
	}

	public setError() {
		this.containerEl.addClass("error");
		this.titleContainer.addClass("error");
	}

	public setTitle(title: string) {
		this.titleEl.setText(title);
	}

	public createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
		return this.contentContainerEl.createEl(tag, o, callback);
	}

	public addParagraph(text?: string) {
		if (text !== undefined)
			this.contentContainerEl.createEl("p", { text: text });
	}

	public addBulletList(texts: string[]) {
		this.contentContainerEl.createEl("ul", {}, (el) => {
			for (const text of texts)
				el.createEl("li", { text: text });
		});
	}

	public createBulletList(liEls: (ulEL: HTMLUListElement) => HTMLLIElement[]) {
		this.contentContainerEl.createEl("ul", {}, (el) => {
			for (const liEl of liEls(el))
				el.appendChild(liEl);
		});
	}

	public createDeckRow(body: HTMLTableSectionElement, declaration: DeckableDeclarable) {
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
			this.component.registerDomEvent(button, "click", () => this.onDomEvent(declaration, "deckAdded", deckSelectEl));
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
			this.component.registerDomEvent(deckSelectEl, "change", () => this.onDomEvent(declaration, "deckChanged", deckSelectEl));
		}
	}
}
