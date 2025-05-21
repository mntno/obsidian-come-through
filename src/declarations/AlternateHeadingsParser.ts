import { AlternateHeadingsDeclarable } from "declarations/AlternateHeadings";
import { CardDeclaration, IDScope } from "declarations/CardDeclaration";
import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { FileParser, SectionRange } from "FileParser";
import { CacheItem, HeadingCache } from "obsidian";

export interface CommandDeclarationParsable {
	parse(sectionLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]): void;
	generatedDeclarations: GeneratedContentDeclaration[];
}

/**
	* Represents one side of a card that was implicitly declared together with the location of its content.
	*/
export type GeneratedContentDeclaration = {
	declaration: CardDeclaration,
	range: SectionRange,
};

export abstract class CommandDeclarationParser<T extends CommandableDeclarable>
	extends FileParser
	implements CommandDeclarationParsable {

	abstract parse(sectionLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]): void;
	abstract generatedDeclarations: GeneratedContentDeclaration[];

	public readonly commandable: T;

	protected constructor(commandable: T) {
		super();
		this.commandable = commandable;
	}
}

export class AlternateHeadingsParser extends CommandDeclarationParser<AlternateHeadingsDeclarable> {

	public constructor(commandable: AlternateHeadingsDeclarable) {
		super(commandable);
	}

	public parse(sectionLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		let internalParse: (...args: Parameters<typeof this.parse>) => void;

		if (this.commandable.delimiter === "heading")
			internalParse = this.parseHeadings.bind(this);
		else if (this.commandable.delimiter === "horizontal rule")
			internalParse = this.parseThematicBreak.bind(this);
		else
			return;

		internalParse(sectionLevel, inBetweenDelimiter, index, delimiters);
	}

	public generatedDeclarations: GeneratedContentDeclaration[] = [];

	private parseHeadings(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		if (!FileParser.isHeadingCache(inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
			return;

		// Find the end delimiter, i.e., the next heading at the same level or lower.
		let nextDelimiter: CacheItem | null = null;
		for (let nextIndex = index + 1; nextIndex < delimiters.length; nextIndex++) {
			nextDelimiter = delimiters[nextIndex];
			if (FileParser.isHeadingCache(nextDelimiter) && inBetweenDelimiter.level >= nextDelimiter.level)
				break;
		}

		const isFront = this.generatedDeclarations.length % 2 == 0;
		this.generateDeclaration(
			isFront ? inBetweenDelimiter.heading : this.lastID,
			isFront,
			inBetweenDelimiter,
			nextDelimiter);
	}

	private parseThematicBreak(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		const isDelimiterHeading = FileParser.isHeadingCache(inBetweenDelimiter);

		// Abort if this is a heading that is on the wrong level.
		if (isDelimiterHeading) {
			if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
				return;
		}


		let isFront: boolean;
		let id: string;

		if (isDelimiterHeading) {
			id = inBetweenDelimiter.heading;
			isFront = true;
		}
		else if (FileParser.isSectionType(inBetweenDelimiter, FileParser.SECTION_TYPE_THEMATICBREAK)) {
			id = this.lastID;
			isFront = false;
		}
		else
			return;

		// Find the end delimiter
		let nextDelimiter: CacheItem | null = null;
		for (let nextIndex = index + 1; nextIndex < delimiters.length; nextIndex++) {
			const maybeNextDelimiter = delimiters[nextIndex];

			if (isFront && FileParser.isSectionType(maybeNextDelimiter, FileParser.SECTION_TYPE_THEMATICBREAK))
				nextDelimiter = maybeNextDelimiter;
			else if (!isFront && FileParser.isHeadingCache(maybeNextDelimiter))
				nextDelimiter = maybeNextDelimiter;

			if (nextDelimiter)
				break;
		}

		this.generateDeclaration(id, isFront, inBetweenDelimiter, nextDelimiter);
	}

	/**
	* Checks if the heading level is according to what is specified in {@link AlternateHeadingsDeclarable}.
	* @param parentHeadingLevel The level of the containing heading.
	* @param section Section to check.
	* @returns `true` if {@link section} is a {@link HeadingCache} and its level equals the {@link parentHeadingLevel} plus {@link AlternateHeadingsDeclarable.level}.
	*/
	private isOnSpecifiedLevel(parentHeadingLevel: number, section: HeadingCache) {
		return section.level == parentHeadingLevel + this.commandable.level;
	}

	private get lastID() {
		const last = this.generatedDeclarations.last();
		if (!last)
			throw new Error(`Expected at least one generated declaration.`);
		return last!.declaration.id;
	}

	private generateDeclaration(id: string, isFront: boolean, startDelimiter: CacheItem | null, endDelimiter: CacheItem | null) {
		this.generatedDeclarations.push({
			declaration: new CardDeclaration(
				id,
				isFront ? "front" : "back",
				IDScope.NOTE,
				this.commandable.deckID,
				true),
			range: {
				start: startDelimiter,
				end: endDelimiter,
			},
		});
	}
}
