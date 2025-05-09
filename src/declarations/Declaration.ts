import { parseYaml, stringifyYaml } from "obsidian";

export interface DeclarationRange {
	start: number,
	end: number,
}

export interface Declaration {
}

export interface DeckableDeclaration extends Declaration {
	deckID: string | undefined;
}

const DeckableUserKeyName = {
	DECK: "deck"
};

const DeckablePropertyName = {
	DECK_ID: "deckID",
};

export type YamlParseErrorCallback = (error: Error) => void;

export abstract class DeclarationBase {

	public static readonly LANGUAGE = "comethrough";
	public static readonly LANGUAGE_SHORT = "ct";

	protected static slice(source: string, location: DeclarationRange) {
		return source.slice(location.start, location.end);
	}

	/**
	 * @param source The code block including the three ticks at the beginning and end.
	 * @returns The string inside the code block or `null` if {@link source} or code "language" is unexpected.
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
	* @param source Will be converted to lower case before parsing.
	* @param onParseError
	* @returns `null` if YAML parsing failed, in which case {@link onParseError} will be invoked.
	*/
	public static tryParseAsYaml(source: string, onParseError?: YamlParseErrorCallback) {
		let parsedObject: Record<string, any> | null = null;

		try {
			parsedObject = parseYaml(source.toLowerCase());
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

	public static toString(declaration: Declaration) {
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

	public static copyWithDeck<T extends DeckableDeclaration>(declaration: T, deckID: string | undefined): T {
		return {
			...declaration,
			...{
				deckID: deckID,
			} satisfies DeckableDeclaration
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
