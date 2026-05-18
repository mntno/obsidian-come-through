import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable, CommandDeclarationParser, CommandDeclarationParserParam } from "#/declarations/CommandDeclarationParser";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable } from "#/declarations/commands/HeadingsCommandable";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { Env } from "#/env";
import { SectionType } from "#/utils/obs/FileParser";
import { Arr, Num, UNARY_UNION_SUPPRESS } from "#/utils/ts";
import { CacheItem, HeadingCache } from "obsidian";

export interface HeadingAndDelimiterDeclarable extends HeadingsCommandableDeclarable {
	delimiter: "horizontal rule" | typeof UNARY_UNION_SUPPRESS;
}

/** Helpers related to {@link HeadingAndDelimiterDeclarable}. */
export class HeadingAndDelimiterAssistant extends HeadingsCommandableAssistant {

	public static override is(value: unknown): value is HeadingAndDelimiterDeclarable {
		if (!HeadingsCommandableAssistant.is(value))
			return false;

		return (Commands.Name.HeadingAndDelimiter as readonly CommandName[]).includes(value.name);
	}

	public static override isValid(declarable: HeadingAndDelimiterDeclarable) {
		if (!HeadingsCommandableAssistant.isValid(declarable))
			return false;

		return ThisAssistant.isDelimiterValid(declarable);
	}

	private static isDelimiterValid(command: HeadingAndDelimiterDeclarable) {
		const setDefault = () => command["delimiter"] = "horizontal rule";

		if (Object.hasOwn(command, "delimiter")) {
			switch (command.delimiter as string) {
				case "hr":
					setDefault();
					return true;
				case "horizontal rule":
					return true;
			}
		}
		else {
			setDefault();
			return true;
		}

		return false;
	}
}

export class HeadingAndDelimiterParser extends CommandDeclarationParser<HeadingAndDelimiterDeclarable> {

	public static tryCreate(declarable: CommandableDeclarable): CommandDeclarationParsable | null {
		if (ThisAssistant.is(declarable) && ThisAssistant.isValid(declarable))
			return new this(declarable)
		return null;
	}

	/** If set, it means that the current iteration is the back side and that this is the expected level of the heading that marks the end of the back side. */
	private lastFrontHeadingLevel: number | undefined;

	public parse(param: CommandDeclarationParserParam) {

		const headingDelimiter = ThisParser.asHeadingCache(param.inBetweenDelimiter);

		// Abort if this is a heading that is on the wrong level.
		if (headingDelimiter !== null) {
			if (!this.isOnSpecifiedLevel(param.sectionLevel, headingDelimiter))
				return;
		}

		let id: string;
		let idScope: IDScope;

		if (headingDelimiter !== null) {
			const uniqueID = this.tryParseUniqueID(headingDelimiter.heading);
			if (uniqueID !== null) {
				id = uniqueID;
				idScope = IDScope.Unique;
			}
			else {
				id = headingDelimiter.heading;
				idScope = IDScope.Note;
			}
		}
		else if (ThisParser.isSectionCacheWithType(param.inBetweenDelimiter, SectionType.ThematicBreak)) {
			const lastDecl = this.lastDeclaration();
			id = lastDecl.declaration.id;
			idScope = lastDecl.declaration.idScope;
		}
		else
			return;

		// Find the end delimiter of this side.
		let nextDelimiter: CacheItem | null = null;
		for (let nextIndex = param.index + 1; nextIndex < param.delimiters.length; nextIndex++) {
			const maybeNextDelimiter = Arr.expAt(param.delimiters, nextIndex);

			// Front side should end as soon as the first delimiter (as specified by the declaration) is found.
			if (this.lastFrontHeadingLevel === undefined && ThisParser.isSectionCacheWithType(maybeNextDelimiter, SectionType.ThematicBreak))
				nextDelimiter = maybeNextDelimiter;
			// Back side ends when a heading of same or lower level as the heading that begain the front side is found, or when nothing is found.
			else if (Num.is(this.lastFrontHeadingLevel) && ThisParser.isHeadingCache(maybeNextDelimiter) && this.lastFrontHeadingLevel >= maybeNextDelimiter.level)
				nextDelimiter = maybeNextDelimiter;

			if (nextDelimiter !== null)
				break;
		}

		if (headingDelimiter !== null) {
			Env.assert(this.lastFrontHeadingLevel === undefined);
			this.lastFrontHeadingLevel = headingDelimiter.level; // Next iteration is the back side. Save the level to be able to find the next heading that counts as the end of the back side.

			Env.assert(nextDelimiter !== null && ThisParser.isSectionCacheWithType(nextDelimiter, SectionType.ThematicBreak));
			if (nextDelimiter === null)
				throw new Error("No delimiter found, for back side");

			this.generateDeclaration(
				id,
				true,
				ThisParser.create.sectionRange(param.inBetweenDelimiter, ThisParser.create.cacheItem(nextDelimiter.position.start)),
				idScope
			);
		}
		else {
			this.lastFrontHeadingLevel = undefined; // Next iteration is the next front side
			this.generateDeclaration(
				id,
				false,
				ThisParser.create.sectionRange(
					ThisParser.create.cacheItem(param.inBetweenDelimiter.position.end),
					nextDelimiter // If nextDelimiter is null it's the end of the file
				),
				idScope
			);
		}
	}

	/**
	* Checks if the heading level is according to what is specified in {@link AlternateHeadingsDeclarable}.
	* @param parentHeadingLevel The level of the containing heading.
	* @param section Section to check.
	* @returns `true` if {@link section} is a {@link HeadingCache} and its level equals the {@link parentHeadingLevel} plus {@link AlternateHeadingsDeclarable.level}.
	*/
	private isOnSpecifiedLevel(parentHeadingLevel: number, section: HeadingCache) {
		return section.level == parentHeadingLevel + this.commandable.level;
	}
}

const ThisAssistant = HeadingAndDelimiterAssistant;
const ThisParser = HeadingAndDelimiterParser;
