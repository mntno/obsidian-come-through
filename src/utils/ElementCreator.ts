import { TableSectionCreator } from "utils/dom/table";
import { CreateElParam, createElWrapper, createWrappedEl } from "utils/obs/dom";

export type ElementCreatorOptions<K extends keyof HTMLElementTagNameMap> = Omit<CreateElParam<K>, "tag" | "parent"> & {
	parent?: HTMLElement
};

/**
 * Convenience facade to reduce code in views.
 */
export class ElementCreator {
	private readonly defaultParent: HTMLDivElement;

	constructor(defaultParent: HTMLDivElement) {
		this.defaultParent = defaultParent;
	}

	public appendChild<T extends HTMLElement>(el: T): T {
		return this.defaultParent.appendChild(el);
	}

	public para(o?: DomElementInfo | string, parent?: HTMLElement) {
		return createWrappedEl({
			parent: parent ?? this.defaultParent,
			tag: "p",
			o: o,
		});
	}

	public paraWrapper(parent?: HTMLElement) {
		return createElWrapper(parent ?? this.defaultParent, "p");
	}

	public table(builder?: (section: TableSectionCreator) => void, options?: ElementCreatorOptions<"table">) {
		const table = createWrappedEl(this.toCreateParam("table", options));
		if (builder !== undefined)
			builder(new TableSectionCreator(table));
		return table;
	}

	public el<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		o?: DomElementInfo | string,
		createdCallback?: (el: HTMLElementTagNameMap[K]) => void,
		parent?: HTMLElement): HTMLElementTagNameMap[K] {
		return createWrappedEl({
			tag: tag,
			parent: parent ?? this.defaultParent,
			o: o,
			createdCallback: createdCallback,
		});
	}

	/** Converts {@link ElementCreatorOptions} to {@link CreateElParam}. */
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
