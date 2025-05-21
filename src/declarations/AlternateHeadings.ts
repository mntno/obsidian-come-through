import { isNumber } from "TypeAssistant";
import { CommandableDeclarable } from "declarations/CommandDeclaration";

export interface AlternateHeadingsDeclarable extends CommandableDeclarable {
	level: number;
	delimiter: "heading" | "horizontal rule"
}

export class AlternateHeadingsAssistant {

	public static conforms(command: CommandableDeclarable): command is AlternateHeadingsDeclarable {
		return Object.hasOwn(command, "level");
	}

	/**
	 * @param command
	 * @returns `true` if the values of properties were valid or undefined, in which case default values were set.
	 */
	public static isAlternateHeadingsValid(command: AlternateHeadingsDeclarable) {
		return (
			this.isLevelValid(command) &&
			this.isDelimiterValid(command)
		);
	}

	private static isLevelValid(command: AlternateHeadingsDeclarable) {
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

	private static isDelimiterValid(command: AlternateHeadingsDeclarable) {
		if (Object.hasOwn(command, "delimiter")) {
			switch (command.delimiter) {
				case "heading":
				case "horizontal rule":
					return true;
			}
		}
		else {
			command["delimiter"] = "heading";
			return true;
		}

		return false;
	}
}
