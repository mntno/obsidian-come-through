import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable, CommandDeclarationParserParam } from "#/declarations/CommandDeclarationParser";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable, HeadingsDeclarationParser } from "#/declarations/commands/HeadingsCommandable";
import { IDScope } from "#/declarations/ExplicitDeclaration";

export interface AlternateHeadingsDeclarable extends HeadingsCommandableDeclarable { // eslint-disable-line @typescript-eslint/no-empty-object-type -- Intentionally left empty to document a distinct abstraction and facilitate future extension.
}

/** Helpers related to {@link AlternateHeadingsDeclarable}. */
export class AlternateHeadingsAssistant extends HeadingsCommandableAssistant {

	public static override is(value: unknown): value is AlternateHeadingsDeclarable {
		if (!HeadingsCommandableAssistant.is(value))
			return false;

		return (Commands.Name.AlternateHeadings as readonly CommandName[]).includes(value.name);
	}
}

export class AlternateHeadingsParser extends HeadingsDeclarationParser<AlternateHeadingsDeclarable> {

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable);
		return null;
	}

	public parse(param: CommandDeclarationParserParam) {

		if (!ThisParser.isHeadingCache(param.inBetweenDelimiter))
			return;

		// Only interested in headings on the specified level
		if (!this.isOnSpecifiedLevel(param.sectionLevel, param.inBetweenDelimiter))
			return;

		const isFront = this.generatedDeclarations.length % 2 == 0;
		let id: string;
		let idScope: IDScope;

		if (isFront) {
			const uniqueID = this.tryParseUniqueID(param.inBetweenDelimiter.heading);
			if (uniqueID !== null) {
				id = uniqueID;
				idScope = IDScope.Unique;
			} else {
				id = param.inBetweenDelimiter.heading;
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
			ThisParser.create.sectionRange(param.inBetweenDelimiter, ThisParser.find.nextHeading(param.inBetweenDelimiter.level, param.index, param.delimiters)),
			idScope
		);
	}
}

const ThisAssistant = AlternateHeadingsAssistant;
const ThisParser = AlternateHeadingsParser;
