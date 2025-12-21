import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable } from "#/declarations/CommandDeclarationParser";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "#/declarations/commands/HeadingsCommandable";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { CacheItem, Loc } from "obsidian";

export interface HeadingIsFrontDeclarable extends HeadingsCommandableDeclarable { // eslint-disable-line @typescript-eslint/no-empty-object-type
}

/** Helpers related to {@link HeadingIsFrontDeclarable}. */
export class HeadingIsFrontAssistant extends HeadingsCommandableAssistant {

	public static override is(value: unknown): value is HeadingIsFrontDeclarable {
		if (!HeadingsCommandableAssistant.is(value))
			return false;

		return (Commands.Name.HeadingIsFront as readonly CommandName[]).includes(value.name);
	}
}
const ThisAssistant = HeadingIsFrontAssistant;

export class HeadingIsFrontParser extends HeadingsDeclarationParser<HeadingIsFrontDeclarable> {

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable);
		return null;
	}

	public parse(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {
		if (!HeadingIsFrontParser.isHeadingCache(inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
			return;

		let id = inBetweenDelimiter.heading;
		let idScope: IDScope = IDScope.Note;

		const uniqueID = this.tryParseUniqueID(inBetweenDelimiter.heading);
		if (uniqueID !== null) {
			id = uniqueID;
			idScope = IDScope.Unique;
		}

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
			},
			idScope,
		);

		this.generateDeclaration(
			id,
			false,
			{
				position: {
					start: endLocation,
					end: endLocation,
				}
			},
			HeadingsDeclarationParser.findNextHeading(inBetweenDelimiter.level, index, delimiters),
			idScope,
		);
	}
}
