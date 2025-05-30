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

	protected generateDeclaration(id: string, isFront: boolean, startDelimiter: CacheItem | null, endDelimiter: CacheItem | null) {
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

	protected get lastID() {
		const last = this.generatedDeclarations.last();
		if (!last)
			throw new Error(`Expected at least one generated declaration.`);
		return last!.declaration.id;
	}
}
