
export class TableCreator {
	public static create(parent: HTMLElement, o?: DomElementInfo | string, cb?: (el: HTMLTableElement) => void): TableSectionCreator {
		return new TableSectionCreator(parent.createEl("table", o, cb));
	}
}

export class TableSectionCreator {
	public readonly tableEl: HTMLTableElement;

	constructor(tableEl: HTMLTableElement) {
		this.tableEl = tableEl;
	}

	public setHeader(cb?: (rowCreator: TableRowCreator) => void): TableRowCreator {
		return this.create("thead", cb);
	}

	/** It is possible to have multiple <tbody> elements in the same table. */
	public addBody(cb?: (rowCreator: TableRowCreator) => void): TableRowCreator {
		return this.create("tbody", cb);
	}

	public setFooter(cb?: (rowCreator: TableRowCreator) => void): TableRowCreator {
		return this.create("tfoot", cb);
	}

	private create(tag: "thead" | "tbody" | "tfoot", cb?: (rowCreator: TableRowCreator) => void) {
		const r = new TableRowCreator(this.tableEl.createEl(tag), tag === "thead");
		cb?.(r);
		return r;
	}
}

export class TableRowCreator {
	public readonly sectionEl: HTMLTableSectionElement;
	/** Whether this row is a header row. */
	public readonly isHeader: boolean;

	constructor(sectionEl: HTMLTableSectionElement, isHeader = false) {
		this.sectionEl = sectionEl;
		this.isHeader = isHeader;
	}

	public add(cb?: (colCreator: TableColCreator) => void) {
		return this.create(this.isHeader ? "th" : "td", cb);
	}

	private create(tag: "th" | "td", cb?: (colCreator: TableColCreator) => void): TableColCreator {
		const colCreator = new TableColCreator(this.sectionEl.createEl("tr"), tag);
		cb?.(colCreator);
		return colCreator;
	}
}

export class TableColCreator {
	public readonly rowEl: HTMLTableRowElement;
	public readonly tag: "th" | "td";

	constructor(rowEl: HTMLTableRowElement, tag: "th" | "td") {
		this.rowEl = rowEl;
		this.tag = tag;
	}

	public add(o?: DomElementInfo | string, cb?: (cellEl: HTMLTableCellElement) => void) {
		return this.rowEl.createEl(this.tag, o, cb);
	}

	/** If this instance creates table header cells (`th`), calling this is equal to calling {@link add}. */
	public addHeader(o?: DomElementInfo | string, cb?: (cellEl: HTMLTableCellElement) => void) {
		return this.rowEl.createEl("th", o, cb);
	}
};
