import { FileParser } from "FileParser";
import { parseYaml, stringifyYaml } from "obsidian";
import { isObject, isString } from "TypeAssistant";
import { UniqueID } from "UniqueID";

export interface Declarable {
	[key: string]: unknown;
}

export interface DeckableDeclarable extends Declarable {
	deckID: string | null;
}

const DeckableUserKeyName = {
	DECK: "deck"
};

const DeckablePropertyName = {
	DECK_ID: "deckID",
};

/**
	* Locates the portion of a string that contains the raw declaration string.
	* @todo Remove. See types in {@link FileParser}
	*/
export interface DeclarationRange {
	start: number,
	end: number,
}

export type YamlParseErrorCallback = (error: Error) => void;

export abstract class Declaration {

	private static readonly LANGUAGE = "comethrough";
	private static readonly LANGUAGE_SHORT = "ct";

	public static get supportedCodeBlockLanguages() {
		return [Declaration.LANGUAGE, Declaration.LANGUAGE_SHORT];
	}

	public static get supportedFrontmatterKeys() {
		return [Declaration.LANGUAGE, Declaration.LANGUAGE_SHORT, "come through"];
	}

	protected static slice(source: string, location: DeclarationRange) {
		return source.slice(location.start, location.end);
	}

	/**
	 	* Checks if this a code block with one of the expected languages; if so, parses it.
		* @param source The code block including the three ticks at the beginning and end.
		* @returns `null` is {@link source} is not a code block or if the block's language is unexpected.
		*/
	protected static parseAndCheckCodeBlock(source: string) {
		const info = FileParser.parseCodeBlock(source);

		if (info && !this.supportedCodeBlockLanguages.includes(info.language))
			return null;

		return info;
	}
	private static readonly CODE_BLOCK_MARKER_LENGTH = 3;

	/**
		* Case insensitive.
		*
		* @param yaml Will be converted to lower case before parsing.
		* @param onParseError
		* @returns `null` if YAML parsing failed, in which case {@link onParseError} will be invoked.
		*/
	public static tryParseYaml(yaml: string, onParseError?: YamlParseErrorCallback) {
		let parsedObject: Record<string, any> | null = null;

		try {
			parsedObject = parseYaml(yaml.toLowerCase());
			if (parsedObject)
				this.fromUserFriendlyKeys(parsedObject);
		}
		catch (error) {
			if (error instanceof Error && error.name === "YAMLParseError")
				onParseError?.(error);
			else
				throw error;
		}

		return parsedObject;
	}

	public static toString(declaration: Declarable) {
		this.toUserFriendlyKeys(declaration);
		return stringifyYaml(declaration);
	}

	/**
	 * Transform user friendly YAML keys to interface/class properties.
	 * Opposite of {@link toUserFriendlyKeys}.
	 *
	 * @param obj
	 */
	private static fromUserFriendlyKeys(obj: Record<string, any>) {
		if (Object.hasOwn(obj, DeckableUserKeyName.DECK)) {
			const deckID = obj[DeckableUserKeyName.DECK];
			delete obj[DeckableUserKeyName.DECK];
			obj[DeckablePropertyName.DECK_ID] = deckID;
		}
	}

	private static toUserFriendlyKeys(obj: Declarable) {
		if (Object.hasOwn(obj, DeckablePropertyName.DECK_ID)) {
			const deckID = obj[DeckablePropertyName.DECK_ID];
			delete obj[DeckablePropertyName.DECK_ID];
			// Only include if specific deck set.
			if (deckID)
				obj[DeckableUserKeyName.DECK] = deckID;
		}
	}

	protected static conformsToDeclarableBase(value: unknown): value is Declarable {
		return isObject(value);
	}

	protected static conformsToDeckable(value: unknown): value is DeckableDeclarable {
		if (!Declaration.conformsToDeclarableBase(value))
			return false;
		if (!Object.hasOwn(value, DeckablePropertyName.DECK_ID))
			value[DeckablePropertyName.DECK_ID] = null;
		return true;
	}

	public static copyWithDeck<T extends DeckableDeclarable>(declaration: T, deckID: string | null): T {
		return {
			...declaration,
			...{
				deckID: deckID,
			} satisfies DeckableDeclarable
		}
	}

	protected static isDeckIDValid(id: string | null) {
		return id === null || (isString(id) && UniqueID.isValid(id));
	}
}
