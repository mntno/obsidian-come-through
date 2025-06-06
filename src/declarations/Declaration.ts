import { parseYaml, stringifyYaml } from "obsidian";

export interface Declarable {}

export interface DeckableDeclarable extends Declarable {
	deckID: string | null;
}

const DeckableUserKeyName = {
	DECK: "deck"
};

const DeckablePropertyName = {
	DECK_ID: "deckID",
};

/** Locates the portion of a string that contains the raw declaration string. */
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
	 * @param source The code block including the three ticks at the beginning and end.
	 * @returns The location of the block's content within {@link source} or `null` if {@link source} or code "language" is unexpected.
	*/
	protected static contentOfCodeBlock(source: string): DeclarationRange | null {
		const firstLine = source.split("\n", 1).first();
		if (!firstLine)
			return null;

		const language = firstLine.slice(this.CODE_BLOCK_MARKER_LENGTH).trim();
		if (language !== this.LANGUAGE && language !== this.LANGUAGE_SHORT)
			return null;

		const secondLineOffset = firstLine.length + 1; // Add \n back
		return { start: secondLineOffset, end: source.length - this.CODE_BLOCK_MARKER_LENGTH }
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

	private static toUserFriendlyKeys(obj: Record<string, any>) {
		if (Object.hasOwn(obj, DeckablePropertyName.DECK_ID)) {
			const deckID = obj[DeckablePropertyName.DECK_ID];
			delete obj[DeckablePropertyName.DECK_ID];
			obj[DeckableUserKeyName.DECK] = deckID;
		}
	}

	public static copyWithDeck<T extends DeckableDeclarable>(declaration: T, deckID: string | null): T {
		return {
			...declaration,
			...{
				deckID: deckID,
			} satisfies DeckableDeclarable
		}
	}

	protected static validateDeck(obj: Record<string, any>) {
		if (Object.hasOwn(obj, DeckablePropertyName.DECK_ID)) {
			const value = obj[DeckablePropertyName.DECK_ID];
			if (value === undefined)
				return true;
			return typeof value === 'string' //&& UniqueID.isValid(<string>value);
		}
		else {
			return true;
		}
	}
}
