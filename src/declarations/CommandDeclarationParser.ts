import { CardDeclaration } from "#/declarations/CardDeclaration";
import { CommandableDeclarable } from "#/declarations/Commandable";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { Env } from "#/env";
import { FileParser, OffsetRange, SectionRange } from "#/utils/obs/FileParser";
import { CacheItem } from "obsidian";

export interface CommandDeclarationParserOptions {
	useProvider?: boolean;
}

export interface CommandDeclarationParserParam {
	/** Parent's heading level. */
	sectionLevel: number;
	inBetweenDelimiter: CacheItem;
	index: number;
	delimiters: CacheItem[];
	/** The complete markdown content. */
	content: string;
	options?: CommandDeclarationParserOptions;
}

export interface CommandDeclarationParsable {
	/**
		* Creates a {@link CardDeclaration} and adds it to {@link generatedDeclarations}.
		*/
	parse(info: CommandDeclarationParserParam): void;
	generatedDeclarations: GeneratedContentDeclaration[];
}

export interface ContentSectionProvider {
	rangesToExclude(s: OffsetRange): OffsetRange[];
	rangeToInclude(): OffsetRange;
	text(): string;
}

/**
	* Represents one side of a card that was implicitly declared together with the location of its content.
	*/
export type GeneratedContentDeclaration = {
	declaration: CardDeclaration,
	containerRange: SectionRange,
	provider?: ContentSectionProvider,
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

	public abstract parse(info: CommandDeclarationParserParam): void;
	public generatedDeclarations: GeneratedContentDeclaration[] = [];

	public readonly commandable: T;

	public constructor(commandable: T) {
		super();
		this.commandable = commandable;
	}

	protected generateDeclaration(
		id: string,
		isFront: boolean,
		containerRange: SectionRange,
		scope: IDScope,
		provider?: ContentSectionProvider) {
		Env.log.p("CommandDeclarationParser:generateDeclaration: id: ", id, ", front:", isFront);
		this.generatedDeclarations.push({
			declaration: new CardDeclaration(
				id,
				isFront ? "front" : "back",
				scope,
				this.commandable.deckID,
				true),
			containerRange: containerRange,
			provider: provider,
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
