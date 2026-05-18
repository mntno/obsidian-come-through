import { CommandableAssistant, CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable, CommandDeclarationParser, CommandDeclarationParserParam, ContentSectionProvider } from "#/declarations/CommandDeclarationParser";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { ExplicitDeclarationAssistant, IDScope } from "#/declarations/ExplicitDeclaration";
import { Env } from "#/env";
import { MarkdownTable } from "#/utils/md/MarkdownTable";
import { OffsetRange, SectionRange, SectionType } from "#/utils/obs/FileParser";
import { Bln, Num, Arr, Str } from "#/utils/ts";

export interface TablesDeclarable extends CommandableDeclarable /*HeadingsCommandableDeclarable*/ { // eslint-disable-line @typescript-eslint/no-empty-object-type -- Intentionally left empty to document a distinct abstraction and facilitate future extension.
}

/** Helpers related to {@link TablesDeclarable}. */
export class TablesAssistant extends CommandableAssistant {
	public static override is(value: unknown): value is TablesDeclarable {
		if (!CommandableAssistant.is(value))
			return false;

		return (Commands.Name.Table as readonly CommandName[]).includes(value.name);
	}
}

/** Meta information about the table header. */
type HeaderData = {
	/** Column index containing the ID. */
	idIndex: number;
	/** Sorted list of unique page numbers found. */
	pageNums: number[];
};

/** A range of row indices. */
type RowRange = {
	/** The row index where the range starts. */
	start: number;
	/** The row index where the range ends. */
	end: number;
};

/** The range of rows associated with a specific ID. */
type IDRowRange = {
	/** The unique ID for the row range. */
	id: string;
	/** The rows belonging to this ID. */
	rows: RowRange;
};

/** Data defining the boundaries for content extraction from a table. */
type TableExtractionBounds = {
	/** Column index containing the ID. */
	idIndex: number;
	/** The page number to extract content for. */
	pageNum: number;
	/** The rows to extract content from. */
	rows: RowRange;
};

/** Parses card declarations from Markdown tables. */
export class TablesDeclarationParser extends CommandDeclarationParser<TablesDeclarable> {

	private rtl = false;

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		Env.log.p("TablesDeclarationParser:tryCreate", declarable, ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable);

		return null;
	}

	public parse(param: CommandDeclarationParserParam) {
		Env.log.p("TablesDeclarationParser:parse: ", param);

		if (!ThisParser.isSectionCacheWithType(param.inBetweenDelimiter, SectionType.Table)) {
			Env.log.p(Str.TAB, "Abort: not a table.");
			return;
		}

		const mdTable = ThisParser.content.fromSection(param.inBetweenDelimiter, param.content)
		const table = MarkdownTable.parse(mdTable);

		if (table === null) {
			Env.log.p(Str.TAB, "Failed to parse", mdTable);
			return;
		}
		if (table.rowCount <= 1) {
			Env.log.p(Str.TAB, "Table needs header plus at least one row", mdTable);
			return;
		}

		const header = this.parseHeader(table);
		if (header.idIndex === -1) {
			Env.log.p(Str.TAB, "Table needs an ID column");
			return;
		}

		const headings = ThisParser.find.previousAndNextHeading(param.index, param.delimiters);
		const containerRange = ThisParser.create.sectionRange(headings.previous, headings.next);
		const tableRange = ThisParser.create.offsetRangeFromSection(param.inBetweenDelimiter);
		const useProvider = Bln.isTrue(param.options?.useProvider);

		for (const range of this.getRowRanges(header, table))
			this.emitGroup(range, header, containerRange, tableRange, table, useProvider);
	}

	private getRowRanges(header: HeaderData, table: MarkdownTable): IDRowRange[] {
		Env.log.p("TablesDeclarationParser:getRowRanges: body rows:", table.rowCount - 1);
		const ranges: IDRowRange[] = [];

		for (let rowIndex = 1; rowIndex <= table.rowCount; rowIndex++) {
			const idCell = rowIndex < table.rowCount ? Str.trimmedNonEmpty(table.getCell(rowIndex, header.idIndex)) : undefined;
			const id = idCell !== undefined ? this.tryParseUniqueID(idCell) : null;

			if (id !== null || rowIndex === table.rowCount) {
				const last = Arr.last(ranges);
				if (last !== undefined) {
					last.rows.end = rowIndex - 1;
				}
				if (id !== null) {
					ranges.push({
						id: id,
						rows: {
							start: rowIndex,
							end: -1
						}
					});
				}
			}
		}

		Env.log.p(Str.TAB, ranges);
		return ranges;
	}

	/** Emits declarations for the ID row range, optionally with content providers. */
	private emitGroup(range: IDRowRange, header: HeaderData, containerRange: SectionRange, tableRange: OffsetRange, table: MarkdownTable, useProvider: boolean) {
		header.pageNums.slice(0, 2).forEach((pageNum, i) => {
			const isFront = i === 0;

			const bounds: TableExtractionBounds = {
				idIndex: header.idIndex,
				pageNum,
				rows: range.rows
			};

			this.generateDeclaration(range.id, isFront, containerRange, IDScope.Note,
				useProvider ? new TableDeclarationContentProvider(tableRange, table, bounds, this.rtl) : undefined);
		});
	}

	/** Extracts ID index and unique page numbers from the header row. */
	private parseHeader(table: MarkdownTable): HeaderData {
		let idIndex = -1;
		const pageNumsSet = new Set<number>();

		for (let i = 0; i < table.columnCount; i++) {
			const cell = Str.trimmedNonEmpty(table.getCell(0, i));
			if (cell !== undefined && ThisParser.Header.isID(cell)) {
				idIndex = i;
				break;
			}
		}

		if (idIndex !== -1) {
			let currentPage: number | null = null;
			const start = this.rtl ? table.columnCount - 1 : 0;
			const end = this.rtl ? -1 : table.columnCount;
			const step = this.rtl ? -1 : 1;

			for (let i = start; i !== end; i += step) {
				if (i === idIndex) continue;
				const cell = Str.trimmedNonEmpty(table.getCell(0, i));
				const pageNum = cell !== undefined ? Num.fromStr(cell) : null;

				if (pageNum !== null) {
					currentPage = pageNum;
				}
				if (currentPage !== null) {
					pageNumsSet.add(currentPage);
				}
			}
		}

		return {
			idIndex,
			pageNums: Array.from(pageNumsSet).sort((a, b) => a - b)
		};
	}

	/** Static helpers for header cell identification. */
	private static readonly Header = {
		/** @returns `true` if {@link value} indicates an ID column. */
		isID(value: string) {
			return value.toLowerCase() === "id"
		},
		/** @returns `true` for front, `false` for back, or `null` if side cannot be determined. */
		isFront(value: string): boolean | null {
			switch (ExplicitDeclarationAssistant.tryGetSide(value)) {
				case "front":
					return true;
				case "back":
					return false
				case null: {
					const num = Num.fromStr(value);
					if (num === 1)
						return true;
					if (num === 2)
						return false;
				}
					break;
			}
			return null;
		}
	};
}

/** Provides content from specified table columns and rows. */
class TableDeclarationContentProvider implements ContentSectionProvider {

	private readonly range: OffsetRange;
	private readonly table: MarkdownTable;
	private readonly bounds: TableExtractionBounds;
	private readonly rtl: boolean;

	constructor(
		range: OffsetRange,
		table: MarkdownTable,
		bounds: TableExtractionBounds,
		rtl: boolean
	) {
		this.range = range;
		this.table = table;
		this.bounds = bounds;
		this.rtl = rtl;
	}

	/** @returns Ranges to exclude from the section when including this provider's content. */
	public rangesToExclude(s: OffsetRange): OffsetRange[] {
		return [
			{ start: s.start + 1, end: this.range.start },
			{ start: this.range.end, end: s.end }
		];
	}

	/** @returns The range within the file where this content is located. */
	public rangeToInclude(): OffsetRange {
		return this.range;
	}

	/** Extracts and joins cell contents into paragraphs. */
	public text() {
		const colIdxs = TableDeclarationContentProvider.getColumnIndexes(this.table, this.bounds.pageNum, this.bounds.idIndex, this.rtl);
		const parts: string[] = [];
		for (const colIdx of colIdxs) {
			for (let r = this.bounds.rows.start; r <= this.bounds.rows.end; r++) {
				const cell = Str.trimmedNonEmpty(this.table.getCell(r, colIdx));
				if (cell !== undefined) {
					parts.push(cell);
				}
			}
		}
		return parts.join("\n\n");
	}

	/** Identifies column indices belonging to a specific page number. */
	public static getColumnIndexes(table: MarkdownTable, targetPageNum: number, idIndex: number, rtl: boolean): number[] {
		const cols: number[] = [];
		let currentPage: number | null = null;
		const start = rtl ? table.columnCount - 1 : 0;
		const end = rtl ? -1 : table.columnCount;
		const step = rtl ? -1 : 1;

		for (let i = start; i !== end; i += step) {
			if (i === idIndex) continue;
			const cell = Str.trimmedNonEmpty(table.getCell(0, i));
			const p = cell !== undefined ? Num.fromStr(cell) : null;
			if (p !== null) currentPage = p;
			if (currentPage !== null && currentPage === targetPageNum) {
				cols.push(i);
			}
		}
		return cols;
	}
}

const ThisAssistant = TablesAssistant;
const ThisParser = TablesDeclarationParser;
