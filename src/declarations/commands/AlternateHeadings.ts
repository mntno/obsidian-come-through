import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { CommandDeclarationParsable, CommandDeclarationParser } from "declarations/CommandDeclarationParser";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "declarations/commands/HeadingsCommandable";
import { CacheItem, HeadingCache } from "obsidian";

export interface AlternateHeadingsDeclarable extends HeadingsCommandableDeclarable { }

export class AlternateHeadingsAssistant extends HeadingsCommandableAssistant {
	public static tryCreateParser(commandable: CommandableDeclarable): CommandDeclarationParsable | null {
		return (
			AlternateHeadingsAssistant.conforms<AlternateHeadingsDeclarable>(commandable) &&
			AlternateHeadingsAssistant.isValid(commandable)
		) ? new AlternateHeadingsParser(commandable) : null;
	}
}

export class AlternateHeadingsParser extends HeadingsDeclarationParser<AlternateHeadingsDeclarable> {

	public parse(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		if (!AlternateHeadingsParser.isHeadingCache(inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
			return;

		const isFront = this.generatedDeclarations.length % 2 == 0;
		this.generateDeclaration(
			isFront ? inBetweenDelimiter.heading : this.lastID,
			isFront,
			inBetweenDelimiter,
			AlternateHeadingsParser.findNextHeading(inBetweenDelimiter.level, index, delimiters));
	}
}
