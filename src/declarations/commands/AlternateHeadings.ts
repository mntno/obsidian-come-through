import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable } from "#/declarations/CommandDeclarationParser";
import { Commands, CommandName } from "#/declarations/CommandNames";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "#/declarations/commands/HeadingsCommandable";

import { FileParser } from "#/utils/obs/FileParser";
import { CacheItem } from "obsidian";

export interface AlternateHeadingsDeclarable extends HeadingsCommandableDeclarable { // eslint-disable-line @typescript-eslint/no-empty-object-type
}

/** Helpers related to {@link AlternateHeadingsDeclarable}. */
export class AlternateHeadingsAssistant extends HeadingsCommandableAssistant {

	public static override is(value: unknown): value is AlternateHeadingsDeclarable {
		if (!HeadingsCommandableAssistant.is(value))
			return false;

		return (Commands.Name.AlternateHeadings as readonly CommandName[]).includes(value.name);
	}
}
const ThisAssistant = AlternateHeadingsAssistant;

export class AlternateHeadingsParser extends HeadingsDeclarationParser<AlternateHeadingsDeclarable> {

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable);
		return null;
	}

	public parse(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		if (!FileParser.isHeadingCache(inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
			return;

		const isFront = this.generatedDeclarations.length % 2 == 0;
		let id: string;
		let idScope: IDScope;

		if (isFront) {
			const uniqueID = this.tryParseUniqueID(inBetweenDelimiter.heading);
			if (uniqueID !== null) {
				id = uniqueID;
				idScope = IDScope.Unique;
			} else {
				id = inBetweenDelimiter.heading;
				idScope = IDScope.Note;
			}
		}
		else {
			const decl = this.lastDeclaration().declaration;
			id = decl.id;
			idScope = decl.idScope;
		}

		this.generateDeclaration(
			id,
			isFront,
			inBetweenDelimiter,
			HeadingsDeclarationParser.findNextHeading(inBetweenDelimiter.level, index, delimiters),
			idScope
		);
	}
}
