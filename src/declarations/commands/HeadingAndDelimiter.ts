import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { CommandDeclarationParsable, CommandDeclarationParser } from "declarations/CommandDeclarationParser";
import { HeadingsCommandableAssistant, HeadingsCommandableDeclarable } from "declarations/commands/HeadingsCommandable";
import { CacheItem, HeadingCache } from "obsidian";

export interface HeadingAndDelimiterDeclarable extends HeadingsCommandableDeclarable {
	delimiter: "horizontal rule"
}

export class HeadingAndDelimiterAssistant extends HeadingsCommandableAssistant {

	public static tryCreateParser(commandable: CommandableDeclarable): CommandDeclarationParsable | null {
		return (
			HeadingAndDelimiterAssistant.conforms<HeadingAndDelimiterDeclarable>(commandable) &&
			HeadingAndDelimiterAssistant.isValid(commandable)
		) ? new HeadingAndDelimiterParser(commandable) : null;
	}

	public static isValid(command: HeadingAndDelimiterDeclarable) {
		return (
			super.isValid(command) &&
			this.isDelimiterValid(command)
		);
	}

	private static isDelimiterValid(command: HeadingAndDelimiterDeclarable) {
		const setDefault = () => command["delimiter"] = "horizontal rule";

		if (Object.hasOwn(command, "delimiter")) {
			switch (command.delimiter as string) {
				case "hr":
					setDefault();
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

	/**
		* If set, it means that the current iteration is the back side and that this is the expected level of the heading that marks the end of the back side.
 		*/
	private lastFrontHeadingLevel: number | undefined;

	public parse(parentHeadingLevel: number, inBetweenDelimiter: CacheItem, index: number, delimiters: CacheItem[]) {

		const isDelimiterHeading = HeadingAndDelimiterParser.isHeadingCache(inBetweenDelimiter);

		// Abort if this is a heading that is on the wrong level.
		if (isDelimiterHeading) {
			if (!this.isOnSpecifiedLevel(parentHeadingLevel, inBetweenDelimiter))
				return;
		}

		let id: string;

		if (isDelimiterHeading)
			id = inBetweenDelimiter.heading;
		else if (HeadingAndDelimiterParser.isSectionType(inBetweenDelimiter, HeadingAndDelimiterParser.SECTION_TYPE_THEMATICBREAK))
			id = this.lastID;
		else
			return;

		// Find the end delimiter of this side.
		let nextDelimiter: CacheItem | null = null;
		for (let nextIndex = index + 1; nextIndex < delimiters.length; nextIndex++) {
			const maybeNextDelimiter = delimiters[nextIndex];

			// Front side should end as soon as the first delimiter (as specified by the declaration) is found.
			if (!this.lastFrontHeadingLevel && HeadingAndDelimiterParser.isSectionType(maybeNextDelimiter, HeadingAndDelimiterParser.SECTION_TYPE_THEMATICBREAK))
				nextDelimiter = maybeNextDelimiter;
			// Back side ends when a heading of same or lower level as the heading that begain the front side.
			else if (this.lastFrontHeadingLevel && HeadingAndDelimiterParser.isHeadingCache(maybeNextDelimiter) && this.lastFrontHeadingLevel >= maybeNextDelimiter.level)
				nextDelimiter = maybeNextDelimiter;

			if (nextDelimiter)
				break;
		}

		this.generateDeclaration(id, this.lastFrontHeadingLevel ? false : true, inBetweenDelimiter, nextDelimiter);

		if (isDelimiterHeading)
			this.lastFrontHeadingLevel = inBetweenDelimiter.level; // Next iteration is the back side. Save the level to be able to find the next heading that counts as the end of the back side.
		else
			this.lastFrontHeadingLevel = undefined; // Next iteration is the next front side
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
