import { CardDeclaration, IDScope } from "declarations/CardDeclaration";
import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { FileParser, SectionRange } from "FileParser";
import { CacheItem } from "obsidian";

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
	public generatedDeclarations: GeneratedContentDeclaration[] = [];

	public readonly commandable: T;

	public constructor(commandable: T) {
		super();
		this.commandable = commandable;
	}

	protected generateDeclaration(id: string, isFront: boolean, startDelimiter: CacheItem | null, endDelimiter: CacheItem | null, scope: IDScope = IDScope.NOTE) {
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
		if (!last)
			throw new Error(`Expected at least one generated declaration.`);
		return last;
	}

	protected get lastID() {
		return this.lastDeclaration().declaration.id;
	}
}
