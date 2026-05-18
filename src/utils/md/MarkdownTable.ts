import { Arr, Str } from "#/utils/ts";

/** Alignment options for a table column. */
export type ColumnAlignment = "left" | "center" | "right" | "none";

/**
 * A specialized utility for parsing, manipulating, and serializing Markdown tables.
 * Follows GitHub Flavored Markdown (GFM) specifications.
 */
export class MarkdownTable {
	private static readonly LINE_BREAK_REGEX = /\r?\n/;
	private static readonly SEPARATOR_CELL_REGEX = /^:?-+:?$/;
	private static readonly PIPE_ESCAPE_REGEX = /\|/g;
	private static readonly PIPE_UNESCAPE_REGEX = /\\\|/g;

	private readonly rows: string[][];
	private readonly alignments: ColumnAlignment[];

	private constructor(rows: string[][], alignments: ColumnAlignment[]) {
		this.rows = rows;
		this.alignments = alignments;
	}

	/** The total number of rows, including the header. */
	public get rowCount(): number {
		return this.rows.length;
	}

	/** The total number of columns. */
	public get columnCount(): number {
		return this.alignments.length;
	}

	/**
	 * Returns the content of a cell.
	 * @param rowIndex 0-indexed row index (0 is the header row).
	 * @param colIndex 0-indexed column index.
	 * @returns The cell content, or `undefined` if the coordinates are out of bounds.
	 */
	public getCell(rowIndex: number, colIndex: number): string | undefined {
		const row = this.rows[rowIndex];
		return row !== undefined ? row[colIndex] : undefined;
	}

	/**
	 * Updates the content of a cell.
	 * @param rowIndex 0-indexed row index (0 is the header row).
	 * @param colIndex 0-indexed column index.
	 * @param value The new content. Pipes will be escaped automatically during serialization.
	 */
	public setCell(rowIndex: number, colIndex: number, value: string): void {
		if (rowIndex < 0 || colIndex < 0 || colIndex >= this.columnCount)
			return;

		// Ensure the row exists
		while (this.rows.length <= rowIndex)
			this.rows.push(new Array<string>(this.columnCount).fill(Str.EMPTY));

		const row = this.rows[rowIndex];
		if (row !== undefined)
			row[colIndex] = value;
	}

	/**
	 * Returns the alignment of a column.
	 * @param colIndex 0-indexed column index.
	 */
	public getAlignment(colIndex: number): ColumnAlignment {
		const align = this.alignments[colIndex];
		return align !== undefined ? align : "none";
	}

	/**
	 * Parses a Markdown table string into a {@link MarkdownTable} instance.
	 * @param markdown The raw Markdown table content.
	 * @returns A {@link MarkdownTable} instance, or `null` if the input is not a valid GFM table.
	 */
	public static parse(markdown: string): MarkdownTable | null {
		const lines = markdown.trim().split(MarkdownTable.LINE_BREAK_REGEX);
		if (lines.length < 2)
			return null;

		const dataRows: string[][] = [];
		let alignments: ColumnAlignment[] | null = null;
		let headerFound = false;

		for (let i = 0; i < lines.length; i++) {
			const line = Str.trimmedNonEmpty(lines[i]);
			if (line === undefined)
				continue;

			const cells = MarkdownTable.splitRow(line);

			// Check if this is a separator row (e.g., |---|---|)
			const possibleAlignments = MarkdownTable.parseSeparatorRow(cells);
			if (possibleAlignments !== null) {
				// GFM requires a separator row to follow a header row
				if (headerFound && alignments === null) {
					alignments = possibleAlignments;
					continue;
				}
				// If we find a separator without a preceding header, it's not a valid table structure
				return null;
			}

			dataRows.push(cells);
			if (!headerFound)
				headerFound = true;
		}

		if (alignments === null || dataRows.length === 0)
			return null;

		// Normalize rows to have the same number of columns as defined by the separator
		const colCount = alignments.length;
		const normalizedRows = dataRows.map(row => {
			const normalized = Arr.toMutable(row);
			while (normalized.length < colCount)
				normalized.push(Str.EMPTY);

			return normalized.slice(0, colCount);
		});

		return new MarkdownTable(normalizedRows, alignments);
	}

	/**
	 * Serializes the table back to a Markdown string.
	 * @param prettify If `true` (default), column widths will be padded to align pipes.
	 */
	public toMarkdown(prettify = true): string {
		if (this.rows.length === 0)
			return Str.EMPTY;

		const colWidths = new Array<number>(this.columnCount).fill(0);
		if (prettify) {
			for (const row of this.rows) {
				for (let i = 0; i < this.columnCount; i++) {
					const cell = row[i];
					const cellStr = cell !== undefined ? cell : Str.EMPTY;
					const len = cellStr.length;
					const currentMax = colWidths[i];
					const currentMaxNum = currentMax !== undefined ? currentMax : 0;
					if (len > currentMaxNum)
						colWidths[i] = len;
				}
			}
			// Minimum width for separator readability
			for (let i = 0; i < this.columnCount; i++) {
				const current = colWidths[i];
				const currentNum = current !== undefined ? current : 0;
				if (currentNum < 3)
					colWidths[i] = 3;
			}
		}

		const lines: string[] = [];

		// Header row
		const headerRow = this.rows[0];
		if (headerRow !== undefined)
			lines.push(this.formatRow(headerRow, colWidths, prettify));

		// Separator row
		lines.push(this.formatSeparator(colWidths, prettify));

		// Data rows
		for (let i = 1; i < this.rows.length; i++) {
			const row = this.rows[i];
			if (row !== undefined)
				lines.push(this.formatRow(row, colWidths, prettify));
		}

		return lines.join(Str.LF);
	}

	private static splitRow(line: string): string[] {
		// Expects `line` to be already trimmed
		let rowText = line;
		if (rowText.startsWith("|"))
			rowText = rowText.slice(1);
		if (rowText.endsWith("|"))
			rowText = rowText.slice(0, -1);

		const cells: string[] = [];
		let currentCell = Str.EMPTY;
		let escaped = false;

		for (let i = 0; i < rowText.length; i++) {
			const char = rowText[i];
			if (char === undefined)
				continue;

			if (escaped) {
				currentCell += char;
				escaped = false;
			} else if (char === "\\") {
				currentCell += char;
				escaped = true;
			} else if (char === "|") {
				cells.push(currentCell.trim());
				currentCell = Str.EMPTY;
			} else {
				currentCell += char;
			}
		}
		cells.push(currentCell.trim());

		// Unescape pipes for internal data representation
		return cells.map(c => c.replace(MarkdownTable.PIPE_UNESCAPE_REGEX, "|"));
	}

	private static parseSeparatorRow(cells: string[]): ColumnAlignment[] | null {
		if (cells.length === 0)
			return null;

		const alignments: ColumnAlignment[] = [];
		for (const cell of cells) {
			const trimmed = cell.trim();
			// Separator cells must consist only of dashes and colons
			if (!Str.isNonEmpty(trimmed) || !MarkdownTable.SEPARATOR_CELL_REGEX.test(trimmed))
				return null;

			const left = trimmed.startsWith(":");
			const right = trimmed.endsWith(":");

			if (left && right)
				alignments.push("center");
			else if (left)
				alignments.push("left");
			else if (right)
				alignments.push("right");
			else
				alignments.push("none");
		}
		return alignments;
	}

	private formatRow(row: string[], colWidths: number[], prettify: boolean): string {
		const formattedCells = row.map((cell, i) => {
			const escaped = cell.replace(MarkdownTable.PIPE_ESCAPE_REGEX, "\\|");
			if (!prettify)
				return ` ${escaped} `;

			const width = colWidths[i];
			const widthNum = width !== undefined ? width : 0;
			const align = this.alignments[i];
			const alignVal = align !== undefined ? align : "none";
			return this.padCell(escaped, widthNum, alignVal);
		});

		return `|${formattedCells.join("|")}|`;
	}

	private padCell(content: string, width: number, align: ColumnAlignment): string {
		const totalSpaces = width - content.length;
		if (totalSpaces <= 0)
			return ` ${content} `;

		switch (align) {
			case "right":
				return ` ${Str.SPACE.repeat(totalSpaces)}${content} `;
			case "center": {
				const left = Math.floor(totalSpaces / 2);
				const right = totalSpaces - left;
				return ` ${Str.SPACE.repeat(left)}${content}${Str.SPACE.repeat(right)} `;
			}
			case "left":
			case "none":
				return ` ${content}${Str.SPACE.repeat(totalSpaces)} `;
		}
	}

	private formatSeparator(colWidths: number[], prettify: boolean): string {
		const formattedCells = this.alignments.map((align, i) => {
			const width = colWidths[i];
			const widthVal = prettify && width !== undefined ? width : 3;
			let inner = "-".repeat(widthVal);

			if (align === "left" || align === "center")
				inner = ":" + inner.slice(1);
			if (align === "right" || align === "center")
				inner = inner.slice(0, -1) + ":";

			return prettify ? ` ${inner} ` : inner;
		});

		return `|${formattedCells.join("|")}|`;
	}
}
