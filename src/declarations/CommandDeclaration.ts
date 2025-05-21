import { AlternateHeadingsAssistant } from "declarations/AlternateHeadings";
import { DeckableDeclarable, Declaration, DeclarationRange, YamlParseErrorCallback } from "declarations/Declaration";
import { isNumber, isObject, isString } from "TypeAssistant";
import { AlternateHeadingsParser, CommandDeclarationParsable, CommandDeclarationParser } from "declarations/AlternateHeadingsParser";

const AlternateHeadingsCommandNames = [
	"alternate headings", "alt headings", "ah",
] as const;

const TableCommandNames = [
	"table",
] as const;

const CommandNames = [
	...AlternateHeadingsCommandNames,
	...TableCommandNames,
] as const;

type CommandName = typeof CommandNames[number];

export interface CommandableDeclarable extends DeckableDeclarable {
	name: CommandName;
}

export class CommandDeclarationAssistant extends Declaration {

	/**
		* @param source
		* @param onParseError The formatting of {@link source} invalid YAML.
		* @param onInvalidType
		* @returns `null` if {@link source} is not recognized.
		*/
	public static createParser(
		source: string,
		onParseError?: YamlParseErrorCallback,
		onInvalidType?: (command: CommandableDeclarable, range: DeclarationRange) => void) {

		const range = this.contentOfCodeBlock(source);
		if (!range)
			return null;

		const obj = super.tryParseYaml(Declaration.slice(source, range), onParseError);
		const commandable = obj && CommandDeclarationAssistant.conforms(obj) ? obj : null;
		if (!commandable)
			return null;

		let parser: CommandDeclarationParsable | null = null;

		if (AlternateHeadingsCommandNames.includes(commandable.name as any)) {
			if (AlternateHeadingsAssistant.conforms(commandable))
				if (AlternateHeadingsAssistant.isAlternateHeadingsValid(commandable))
					parser = new AlternateHeadingsParser(commandable);
		}

		if (!parser && onInvalidType)
			onInvalidType(commandable, range);

		return parser;
	}

	/**
	 * Checks if the provided object minimally conforms to the structure of a {@link CommandableDeclarable}.
	 * @param obj The object to check.
	 * @returns `true` if the object has at least the minimum properties expected of a {@link CommandableDeclarable}, `false` otherwise.
	 */
	public static conforms(obj: Record<string, any>): obj is CommandableDeclarable {
		return (
			isObject(obj) &&
			Object.hasOwn(obj, "name") && isString(obj.name)
		);
	}

	/**
	 * Whether the type value of the provided {@link CommandableDeclarable} is an valid/existing type.
	 * @param command
	 * @returns
	 */
	public static isTypeValid(command: CommandableDeclarable) {
		return CommandNames.includes(command.name);
	}
}
