import { isObject, isString } from "TypeAssistant";
import { CommandDeclarationParsable } from "declarations/CommandDeclarationParser";
import { DeckableDeclarable, Declaration, DeclarationRange, YamlParseErrorCallback } from "declarations/Declaration";
import { AlternateHeadingsAssistant, AlternateHeadingsDeclarable } from "declarations/commands/AlternateHeadings";
import { HeadingAndDelimiterAssistant, HeadingAndDelimiterDeclarable } from "declarations/commands/HeadingAndDelimiter";
import { HeadingIsFrontAssistant, HeadingIsFrontDeclarable } from "declarations/commands/HeadingIsFront";

const AlternateHeadingsCommandNames = [
	"alternate headings", "alt headings", "ah",
] as const;

const HeadingAndDelimiterCommandNames = [
	"heading and delimiter", "hd",
] as const;

const HeadingIsFrontCommandNames = [
	"heading is front", "hf",
] as const;

const TableCommandNames = [
	"table",
] as const;

const CommandNames = [
	...AlternateHeadingsCommandNames,
	...HeadingAndDelimiterCommandNames,
	...HeadingIsFrontCommandNames,
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

		if (CommandDeclarationAssistant.isAlternateHeadings(commandable))
			parser = AlternateHeadingsAssistant.tryCreateParser(commandable);
		else if (CommandDeclarationAssistant.isHeadingAndDelimiter(commandable))
			parser = HeadingAndDelimiterAssistant.tryCreateParser(commandable);
		else if (CommandDeclarationAssistant.isHeadingIsFront(commandable))
			parser = HeadingIsFrontAssistant.tryCreateParser(commandable);

		if (!parser && onInvalidType)
			onInvalidType(commandable, range);

		return parser;
	}

	public static isAlternateHeadings(declaration: CommandableDeclarable): declaration is AlternateHeadingsDeclarable {
		return AlternateHeadingsCommandNames.includes(declaration.name as any);
	}

	public static isHeadingAndDelimiter(declaration: CommandableDeclarable): declaration is HeadingAndDelimiterDeclarable {
		return HeadingAndDelimiterCommandNames.includes(declaration.name as any);
	}

	public static isHeadingIsFront(declaration: CommandableDeclarable): declaration is HeadingIsFrontDeclarable {
		return HeadingIsFrontCommandNames.includes(declaration.name as any);
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
	public static isNameValid(command: CommandableDeclarable) {
		return CommandNames.includes(command.name);
	}
}
