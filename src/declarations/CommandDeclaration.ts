import { DeckableDeclaration, DeclarationBase, DeclarationRange, YamlParseErrorCallback } from "declarations/Declaration";
import { isNumber, isString } from "TypeAssistant";

export type DeclarationCommandType = "alternate headings";

export interface DeclarationCommandInterface extends DeckableDeclaration {
	type: DeclarationCommandType;
}

export interface AlternateHeadingsDeclarationCommand extends DeclarationCommandInterface {
	level: number;
}

export class DeclarationCommandAssistant extends DeclarationBase {

	public readonly source: string;
	public readonly yamlRange: DeclarationRange;

	private constructor(source: string, location: DeclarationRange) {
		super();
		this.source = source;
		this.yamlRange = location;
	}

	/**
	* @param source
	* @returns `null` if {@link source} is not recognized.
	*/
	public static createFromCodeSection(source: string) {
		const location = this.contentOfCodeBlock(source);
		return location ? new this(source, location) : null;
	}

	/**
	 * @param onParseError The formatting of {@link source} invalid YAML.
	 * @returns The created instance or `null` on failure.
	 */
	public parse(onParseError?: YamlParseErrorCallback) {
		const obj = DeclarationCommandAssistant.tryParseAsYaml(
			DeclarationCommandAssistant.slice(this.source, this.yamlRange),
			onParseError);

		return obj && DeclarationCommandAssistant.conforms(obj) ? obj : null;
	}

	/**
	 * Checks if the provided object minimally conforms to the structure of a {@link DeclarationCommand}.
	 * @param obj The object to check.
	 * @returns `true` if the object has at least the minimum properties expected of a {@link DeclarationCommand}, `false` otherwise.
	 */
	public static conforms(obj: Record<string, any>): obj is DeclarationCommandInterface {
		return (
			typeof obj === 'object' && obj !== null &&
			Object.hasOwn(obj, "type") && isString(obj.type)
		);
	}

	/**
	 * Whether the type value of the provided {@link DeclarationCommandInterface} is an valid/existing type.
	 * @param command
	 * @returns
	 */
	public static isTypeValid(command: DeclarationCommandInterface) {
		return (
			command.type === "alternate headings"
		);
	}

	public static conformsToType(type: DeclarationCommandType, obj: Record<string, any>) {
		if (!this.conforms(obj))
			return false;

		if (obj.type === "alternate headings") {
			return this.conformsToAlternateHeadings(obj)
		}

		return false;
	}

	public static conformsToAlternateHeadings(command: DeclarationCommandInterface): command is AlternateHeadingsDeclarationCommand {
		return command.type === "alternate headings" && Object.hasOwn(command, "level");
	}

	/**
	 * @param command
	 * @returns `true` if the values of properties were valid or undefined, in which case default values were set.
	 */
	public static isAlternateHeadingsValid(command: AlternateHeadingsDeclarationCommand) {

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
