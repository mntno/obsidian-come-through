import { CommandableDeclarable } from "declarations/CommandDeclaration";
import { CommandDeclarationParser } from "declarations/CommandDeclarationParser";
import { CacheItem, HeadingCache } from "obsidian";
import { isNumber } from "TypeAssistant";

/**
* @abstract
*/
export interface HeadingsCommandableDeclarable extends CommandableDeclarable {
	level: number;
}

export abstract class HeadingsCommandableAssistant {

	public static conforms<T extends HeadingsCommandableDeclarable>(command: CommandableDeclarable): command is T {
		return Object.hasOwn(command, "level");
	}

	/**
	 * @param command
	 * @returns `true` if the values of properties were valid or undefined, in which case default values were set.
	 */
	public static isValid(command: HeadingsCommandableDeclarable) {
		return (
			this.isLevelValid(command)
		);
	}

	private static isLevelValid(command: HeadingsCommandableDeclarable) {
		if (isNumber(command.level)) {
			return command.level >= 1;
		}

		// If `level` is not set, default to 1; if less than one it's invalid.
		if (command.level === undefined || command.level === null) {
			command.level = 1;
			return true;
		}

		return false;
	}
}

export abstract class HeadingsDeclarationParser<T extends HeadingsCommandableDeclarable>
	extends CommandDeclarationParser<T> {

	/**
		* Checks if the heading level is according to what is specified in {@link AlternateHeadingsDeclarable}.
		* @param parentHeadingLevel The level of the containing heading.
		* @param section Section to check.
		* @returns `true` if {@link section} is a {@link HeadingCache} and its level equals the {@link parentHeadingLevel} plus {@link AlternateHeadingsDeclarable.level}.
		*/
	protected isOnSpecifiedLevel(parentHeadingLevel: number, section: HeadingCache) {
		return section.level == parentHeadingLevel + this.commandable.level;
	}

	/**
		* Find the end delimiter, i.e., the next heading at the same level or lower.
		* @param headingLevel The level the heading to return must be equal or lower to.
		* @param index The index in {@link delimiters} to start searching from.
		* @param delimiters
		* @returns `null` if a next heading on the same level or lower was not found.
		*/
	protected static findNextHeading(headingLevel: number, index: number, delimiters: CacheItem[]) {
		let nextDelimiter: CacheItem | null = null;
		for (let nextIndex = index + 1; nextIndex < delimiters.length; nextIndex++) {
			nextDelimiter = delimiters[nextIndex];
			if (HeadingsDeclarationParser.isHeadingCache(nextDelimiter) && headingLevel >= nextDelimiter.level)
				return nextDelimiter;
		}
		return null;
	}
}
