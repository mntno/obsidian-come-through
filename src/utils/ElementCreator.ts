import { Doc, Win } from "#/utils/obs/dom";
import { TableCreator, TableSectionCreator } from "#/utils/dom/table";
import { Api } from "#/utils/obs/api";
import { CreateElParam, createElWrapper, createWrappedEl } from "#/utils/obs/dom";
import { Str } from "#/utils/ts";
import { App, Component, TFile } from "obsidian";

export type ElementCreatorOptions<K extends keyof HTMLElementTagNameMap> = Omit<CreateElParam<K>, "tag" | "parent"> & {
	parent?: HTMLElement
};

/**
 * Convenience facade to reduce code in views.
 */
export class ElementCreator {
	private readonly defaultParent: HTMLDivElement;
	private get defaultDocument() { return Doc.from(this.defaultParent); }

	constructor(defaultParent: HTMLDivElement) {
		this.defaultParent = defaultParent;
	}

	public readonly node = {
		fragment: () => Win.from(this.defaultParent).createFragment(),
		text: (text: string) => this.defaultDocument.createTextNode(text),
		appendText: (text: string) => this.defaultParent.appendText(text),
		appendChild: <T extends HTMLElement | DocumentFragment>(el: T) => this.defaultParent.appendChild(el),
	};

	public readonly unwrapped = {
		table: (builder?: (section: TableSectionCreator) => void) => {
			const section = TableCreator.create(this.defaultParent)
			if (builder !== undefined)
				builder(section);
			return section.tableEl;
		}
	};

	public p(o?: string | ElementCreatorOptions<"p">) {
		return this.elem("p", Str.is(o) ? { o: { text: o } } : o);
	}

	public div(o?: ElementCreatorOptions<"div">, cb?: (el: HTMLElementTagNameMap["div"]) => void) {
		return this.elem("div", { ...o, createdCallback: cb });
	}

	public btn(o?: ElementCreatorOptions<"button">, cb?: (el: HTMLElementTagNameMap["button"]) => void) {
		return this.elem("button", { ...o, createdCallback: cb });
	}

	public h<N extends 1 | 2 | 3 | 4 | 5 | 6>(tag: N, o: string | ElementCreatorOptions<`h${N}`>) {
		return this.elem(`h${tag}`, Str.is(o) ? { o: { text: o } } : o);
	}

	public fileLink(file: TFile, component: Component, app: App) {
		return this.defaultParent.createEl("a", {
			text: file.basename,
			href: "#",
			cls: "internal-link",
		}, (link) => {
			const handler = async (event: PointerEvent) => {
				event.preventDefault();
				const href = (event.currentTarget as HTMLAnchorElement).getAttribute('href');
				if (href)
					await app.workspace.openLinkText(href, file.path, Api.Event.paneType(event));
			};
			component.registerDomEvent(link, "click", handler);
		});
	}

	public paraWrapper(parent?: HTMLElement) {
		return createElWrapper(parent ?? this.defaultParent, "p");
	}

	public table(builder?: (section: TableSectionCreator) => void, options?: ElementCreatorOptions<"table">) {
		const table = this.elem("table", options);
		if (builder !== undefined)
			builder(new TableSectionCreator(table));
		return table;
	}

	public el<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		o?: DomElementInfo | string,
		createdCallback?: (el: HTMLElementTagNameMap[K]) => void,
		parent?: HTMLElement): HTMLElementTagNameMap[K] {
		return this.elem(tag, {
			parent: parent,
			o: o,
			createdCallback: createdCallback,
		});
	}

	public elem<K extends keyof HTMLElementTagNameMap>(tag: K, o?: ElementCreatorOptions<K>) {
		return createWrappedEl(this.toCreateParam(tag, o));
	}

	/** Converts {@link ElementCreatorOptions} to {@link CreateElParam} using {@link defaultParent} as the parent if not specified. */
	private toCreateParam<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		info?: ElementCreatorOptions<K>
	): CreateElParam<K> {
		return info === undefined
			? { tag: tag, parent: this.defaultParent }
			: {
				...info,
				tag: tag,
				parent: info.parent ?? this.defaultParent,
			};
	}
}
