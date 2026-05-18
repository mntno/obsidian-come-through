import { DeckData, DeckIDDataTuple } from "#/data/DataStore";
import { DeckID } from "#/data/FullID";
import { DeckableDeclarable } from "#/declarations/Collectionable";
import { Declarable } from "#/declarations/Declarable";
import { HtmlTag } from "#/utils/dom/constants";
import { El } from "#/utils/obs/dom";
import { TableCreator } from "#/utils/dom/table";
import { Component, setIcon } from "obsidian";

export type DeclarationChangedType = "deckAdded" | "deckChanged";
export type DeclarationChangedEvent = (declaration: DeckableDeclarable, type: DeclarationChangedType, selectEl: HTMLSelectElement) => void;

export interface DataProvider {
	getAllDecks: () => DeckIDDataTuple[];
	getDeck: (id: DeckID) => DeckData | null;
};

export interface DeclarationRenderable {
	render(r: DeclarationRenderAssistant): void;
}

export interface FactoryRegistryEntry {
	names: readonly string[];
	create: (d: unknown) => DeclarationRenderable | null;
}

export abstract class DeclarationRenderer<T extends Declarable> {
	protected declarable: T;

	public constructor(declarable: T) { this.declarable = declarable; }

	/**
		* @abstract
		* @returns Whether the renderer can render the given value.
		*/
	public static canRender = (_value: unknown): boolean => { throw new Error("Not implemented"); }

	public static readonly Factory = {
		createEntry: <T extends Declarable>(
			names: readonly string[],
			RendererClass: {
				new(declarable: T): DeclarationRenderable;
				canRender(value: unknown): value is T;
			}): FactoryRegistryEntry => {
			return {
				names,
				create: (declarable) => RendererClass.canRender(declarable) ? new RendererClass(declarable) : null
			};
		}
	};
}

export class DeclarationRenderAssistant {

	private readonly containerEl: HTMLElement;
	private readonly contentContainerEl: HTMLDivElement;
	private readonly titleContainer: HTMLDivElement;
	private readonly titleEl: HTMLDivElement;
	private readonly component: Component;
	private readonly dataProvider: DataProvider;
	private readonly onDomEvent: DeclarationChangedEvent;

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
		El.Cls.add(this.containerEl, "error");
		El.Cls.add(this.titleContainer, "error");
	}

	public setTitle(title: string) {
		this.titleEl.setText(title);
	}

	public createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
		return El.create(this.contentContainerEl, tag, o, callback);
	}

	public addParagraph(text?: string) {
		if (text !== undefined)
			El.create(this.contentContainerEl, "p", { text: text });
	}

	public addBulletList(texts: string[]) {
		El.create(this.contentContainerEl, "ul", {}, (el) => {
			for (const text of texts)
				El.create(el, "li", { text: text });
		});
	}

	public createBulletList(liEls: (ulEL: HTMLUListElement) => HTMLLIElement[]) {
		El.create(this.contentContainerEl, "ul", {}, (el) => {
			for (const liEl of liEls(el))
				el.appendChild(liEl);
		});
	}

	public createTable() {
		return TableCreator.create(this.contentContainerEl);
	}

	public createDeckRow(body: HTMLTableSectionElement, declaration: DeckableDeclarable) {
		const rowDeck = body.createEl("tr");
		rowDeck.createEl("td", { text: "Deck" });
		const tdDropdown = rowDeck.createEl("td", { cls: "select-deck-cell" });

		const deckSelectEl = tdDropdown.createEl(HtmlTag.SELECT.NAME, { cls: "dropdown" }, (el) => {
			el.createEl(HtmlTag.SELECT.OPTION.NAME, {
				text: "None",
				value: HtmlTag.SELECT.OPTION.Values.NONE,
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
				deckSelectEl.createEl(HtmlTag.SELECT.OPTION.NAME, {
					text: deck.data.n,
					value: deck.id,
				}, (el) => {
					el.selected = declaration.deckID === deck.id;
				});
			});
			this.component.registerDomEvent(deckSelectEl, "change", () => this.onDomEvent(declaration, "deckChanged", deckSelectEl));
		}
	}
}
