import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { CommandDeclarationParsable, CommandDeclarationParser } from "declarations/CommandDeclarationParser";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "declarations/commands/HeadingsCommandable";
import { CacheItem, HeadingCache, Loc } from "obsidian";

export interface HeadingIsFrontDeclarable extends HeadingsCommandableDeclarable { }

export class HeadingIsFrontAssistant extends HeadingsCommandableAssistant {
	public static tryCreateParser(commandable: CommandableDeclarable): CommandDeclarationParsable | null {
		return (
			HeadingIsFrontAssistant.conforms<HeadingIsFrontDeclarable>(commandable) &&
			HeadingIsFrontAssistant.isValid(commandable)
		) ? new HeadingIsFrontParser(commandable) : null;
	}
}

export class HeadingIsFrontParser extends HeadingsDeclarationParser<HeadingIsFrontDeclarable> {

	public parse(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {
		if (!HeadingIsFrontParser.isHeadingCache(inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
			return;

		const id = inBetweenDelimiter.heading;
		const startLocation: Loc = {
			line: inBetweenDelimiter.position.start.line,
			col: inBetweenDelimiter.position.start.col,
			offset: inBetweenDelimiter.position.start.offset,
		};
		const endLocation: Loc = {
			line: inBetweenDelimiter.position.end.line,
			col: inBetweenDelimiter.position.end.col,
			offset: inBetweenDelimiter.position.end.offset,
		};

		this.generateDeclaration(
			id,
			true,
			{
				position: {
					start: startLocation,
					end: startLocation,
				}
			},
			{
				position: {
					start: endLocation,
					end: endLocation,
				}
			});

		this.generateDeclaration(
			id,
			false,
			{
				position: {
					start: endLocation,
					end: endLocation,
				}
			},
			HeadingIsFrontParser.findNextHeading(inBetweenDelimiter.level, index, delimiters)
		);
	}
}
