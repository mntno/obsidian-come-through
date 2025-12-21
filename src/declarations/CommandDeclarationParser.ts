import { CardDeclaration } from "declarations/CardDeclaration";
import { CommandableDeclarable } from "declarations/Commandable";
import { IDScope } from "declarations/ExplicitDeclaration";
import { CacheItem } from "obsidian";
import { FileParser, SectionRange } from "utils/obs/FileParser";

export interface CommandDeclarationParsable {
	/**
		* Creates a {@link CardDeclaration} and adds it to {@link generatedDeclarations}.
		* @param sectionLevel
		* @param inBetweenDelimiter
		* @param index
		* @param delimiters
		*/
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

/**
	* Provides common functionality for {@link CommandableDeclarable} parsers.
	* @abstract
	*/
export abstract class CommandDeclarationParser<T extends CommandableDeclarable>
	extends FileParser
	implements CommandDeclarationParsable {

	public static readonly Factory = {
		createEntry: <T extends CommandableDeclarable>(
			names: readonly string[],
			ParserClass: {
				new(commandable: T): CommandDeclarationParsable;
				tryCreate(value: CommandableDeclarable): CommandDeclarationParsable | null;
			}) => ({
				names,
				create: (d: CommandableDeclarable) => ParserClass.tryCreate(d)
			})
	};

	abstract parse(sectionLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]): void;
	public generatedDeclarations: GeneratedContentDeclaration[] = [];

	public readonly commandable: T;

	public constructor(commandable: T) {
		super();
		this.commandable = commandable;
	}

	protected generateDeclaration(
		id: string,
		isFront: boolean,
		startDelimiter: CacheItem | null,
		endDelimiter: CacheItem | null,
		scope: IDScope = IDScope.Note) {
		this.generatedDeclarations.push({
			declaration: new CardDeclaration(
				id,
				isFront ? "front" : "back",
				scope,
				this.commandable.deckID,
				true),
			range: {
				start: startDelimiter,
				end: endDelimiter,
			},
		});
	}

	/**
	 * Convenience method. Only call this when you know that one has been generated.
	 * @throws `Error` if no declaration has been genereated.
	 */
	protected lastDeclaration() {
		const last = this.generatedDeclarations.last();
		if (last === undefined)
			throw new Error(`Expected at least one generated declaration.`);
		return last;
	}

	protected get lastID() {
		return this.lastDeclaration().declaration.id;
	}

	protected tryParseUniqueID(text: string) {
		const match = this.FULL_ID_REGEX.exec(text);
		const result = match?.[1];
		return result !== undefined ? result.toLowerCase() : null;
	}
	protected readonly FULL_ID_REGEX = /@([^\s]+)/i;
}
