import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable, CommandDeclarationParserParam } from "#/declarations/CommandDeclarationParser";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "#/declarations/commands/HeadingsCommandable";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { Loc } from "obsidian";

export interface HeadingIsFrontDeclarable extends HeadingsCommandableDeclarable { // eslint-disable-line @typescript-eslint/no-empty-object-type -- Intentionally left empty to document a distinct abstraction and facilitate future extension.
}

/** Helpers related to {@link HeadingIsFrontDeclarable}. */
export class HeadingIsFrontAssistant extends HeadingsCommandableAssistant {

	public static override is(value: unknown): value is HeadingIsFrontDeclarable {
		if (!HeadingsCommandableAssistant.is(value))
			return false;

		return (Commands.Name.HeadingIsFront as readonly CommandName[]).includes(value.name);
	}
}

export class HeadingIsFrontParser extends HeadingsDeclarationParser<HeadingIsFrontDeclarable> {

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable);
		return null;
	}

	public parse(param: CommandDeclarationParserParam) {
		const headingDelimiter = ThisParser.asHeadingCache(param.inBetweenDelimiter)
		if (headingDelimiter === null)
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(param.sectionLevel, headingDelimiter))
			return;

		let id = headingDelimiter.heading;
		let idScope: IDScope = IDScope.Note;

		const uniqueID = this.tryParseUniqueID(headingDelimiter.heading);
		if (uniqueID !== null) {
			id = uniqueID;
			idScope = IDScope.Unique;
		}

		const startLocation: Loc = {
			line: param.inBetweenDelimiter.position.start.line,
			col: param.inBetweenDelimiter.position.start.col,
			offset: param.inBetweenDelimiter.position.start.offset,
		};
		const endLocation: Loc = {
			line: param.inBetweenDelimiter.position.end.line,
			col: param.inBetweenDelimiter.position.end.col,
			offset: param.inBetweenDelimiter.position.end.offset,
		};

		this.generateDeclaration(
			id,
			true,
			ThisParser.create.sectionRange({ position: { start: startLocation, end: startLocation } }, { position: { start: endLocation, end: endLocation } }),
			idScope,
		);

		this.generateDeclaration(
			id,
			false,
			ThisParser.create.sectionRange({ position: { start: endLocation, end: endLocation } }, ThisParser.find.nextHeading(headingDelimiter.level, param.index, param.delimiters)),
			idScope,
		);
	}
}

const ThisAssistant = HeadingIsFrontAssistant;
const ThisParser = HeadingIsFrontParser;
