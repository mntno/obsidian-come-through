import { DeckableDeclarable, Declarable, Declaration, DeclarationRange, YamlParseErrorCallback } from "declarations/Declaration";
import { isString } from "TypeAssistant";
import { UniqueID } from "UniqueID";

export const enum IDScope {
	UNIQUE,
	NOTE,
};

export type DeclarationSide = "front" | "back";

/**
* A {@link DefaultableCardDeclarable} where all default values are set.
*/
export interface CardDeclarable extends DefaultableCardDeclarable {
	id: string;
}

/**
 * The minimum required propertes that need to be specified before
 * default values and/or generated values can be applied
 * to turn it into a {@link CardDeclarable}.
 *
 * See also: {@link CardDeclarationAssistant.conformsToDefaultable}.
 */
export interface DefaultableCardDeclarable extends DeckableDeclarable {
	side: DeclarationSide;
}

const DeclarationInterfacePropertyName = {
	ID: "id",
	SIDE: "side",
};

export class CardDeclaration implements CardDeclarable {

	public readonly id: string;
	public readonly side: DeclarationSide;
	public deckID: string | null;
	[key: string]: unknown;

	public readonly isAutoGenerated: boolean = false;
	public readonly idScope: IDScope;

	public constructor(id: string, side: DeclarationSide, idScope: IDScope, deckID: string | null = null, isAutoGenerated = false) {
		this.id = id;
		this.side = side.trim().toLowerCase() as DeclarationSide;
		this.idScope = idScope;
		this.deckID = deckID;
		this.isAutoGenerated = isAutoGenerated;
	}

	public get isFrontSide(): boolean {
		return CardDeclarationAssistant.isFrontSide(this);
	}
}

export class CardDeclarationAssistant extends Declaration {

	//#region

	public static fromFrontmatter(maybeDeclaration: Record<string, unknown>, incompleteCallback?: (incomplete: DefaultableCardDeclarable, position: DeclarationRange) => void) {
		if (this.conformsToDeclarable(maybeDeclaration))
			return new CardDeclaration(maybeDeclaration.id, maybeDeclaration.side, IDScope.UNIQUE, maybeDeclaration.deckID);
		if (this.conformsToDefaultable(maybeDeclaration) && incompleteCallback)
			// This position should really be the position in the front matter YAML where the declaration is.
			// But, since this is the frontmatter, there's no need slice strings as editing is done with `obsidian` `FileManager.processFrontMatter`.
			incompleteCallback(maybeDeclaration, { start: 0, end: 0 });
		return null;
	}

	/**
	 * @param source The code block including the three ticks at the beginning and end.
	 * @param onParseError
	 * @param incompleteCallback Invoked if content of {@link source} is recognized but is missing required properties.
	 * @returns `null` if this block is unknown or it contains invalid YAML.
	*/
	public static parseCodeBlock(
		source: string,
		onParseError?: YamlParseErrorCallback,
		incompleteCallback?: (incomplete: DefaultableCardDeclarable, position: DeclarationRange) => void) {

		const location = this.contentOfCodeBlock(source);
		if (!location)
			return null;

		const maybeDeclaration = this.tryParseYaml(this.slice(source, location), onParseError);
		if (!maybeDeclaration)
			return null;

		if (this.conformsToDeclarable(maybeDeclaration)) // Doesn't need to be valid here.
			return new CardDeclaration(maybeDeclaration.id, maybeDeclaration.side, IDScope.UNIQUE, maybeDeclaration.deckID);

		if (CardDeclarationAssistant.conformsToDefaultable(maybeDeclaration) && incompleteCallback)
			incompleteCallback(maybeDeclaration, location);

		return null;
	}

	//#endregion

	//#region

	public static canMakeValidCardDeclarable(decl: unknown): decl is DefaultableCardDeclarable {
		// Cannot complete if its not the correct object.
		if (!CardDeclarationAssistant.conformsToDefaultable(decl))
			return false;

		// Already valid
		if (CardDeclarationAssistant.isValidCardDeclarable(decl))
			return false;

		return true;
	}

	/**
	* Checks if all values of the given {@link CardDeclarable} are valid.
	* @param decl
	* @returns
	*/
	public static isValidCardDeclarable(decl: Declarable): decl is CardDeclarable {
		return (
			CardDeclarationAssistant.conformsToDeclarable(decl) &&

			// Check all values
			CardDeclarationAssistant.isIDValid(decl.id) &&
			CardDeclarationAssistant.isSideValid(decl.side) &&
			CardDeclarationAssistant.isDeckIDValid(decl.deckID)
		);
	}

	/**
	 * Completes a {@link DefaultableCardDeclarable} by assigning default and generated values
	 * to non-required properties.
	 *
	 * @param decl
	 * @param preventIDs See {@link UniqueID.generateID}
	 * @returns `null` if {@link canMakeValidCardDeclarable} returns `false`.
	 */
	private static tryToMakeValid(decl: DefaultableCardDeclarable, preventIDs?: Set<string>) {
		if (this.canMakeValidCardDeclarable(decl)) {
			const declWithDefaultValues = {
				...decl,
				...{
					// Add all default values
					id: UniqueID.generateID(preventIDs)
				}
			} satisfies CardDeclarable;
			return declWithDefaultValues as CardDeclarable;
		}
		return null;
	}

	/**
	 * May use if already checked with {@link canMakeValidCardDeclarable}.
	 * @param decl
	 * @param preventIDs See {@link UniqueID.generateID}
	 * @returns Result of calling {@link tryToMakeValid}.
	 */
	public static makeValidOrThrow(decl: DefaultableCardDeclarable, preventIDs?: Set<string>) {
		const maybeCompleted = this.tryToMakeValid(decl, preventIDs);
		if (maybeCompleted === null)
			throw new Error("Could not complete given declaration block.");
		return maybeCompleted;
	}

	//#endregion

	//#region

	/**
		* Check if {@link value} conforms to {@link CardDeclarable};
		* i.e., if the former can be cast to the latter.
		*
		* @param value
		* @returns `false` if {@link value} is `null`.
		*/
	public static conformsToDeclarable(value: unknown): value is CardDeclarable {
		if (!CardDeclarationAssistant.conformsToDefaultable(value))
			return false;

		const id = value[DeclarationInterfacePropertyName.ID];
		if (id === undefined)
			value[DeclarationInterfacePropertyName.ID] = "";
		if (isString(id))
			return true;

		return false; // e.g. id is a number
	}

	/**
		* Check if {@link value} conforms to {@link DefaultableCardDeclarable};
		* i.e., if the former can be cast to the latter.
		*
		* @param value
		* @returns `false` if {@link value} is `null`.
		*/
	public static conformsToDefaultable(value: unknown): value is DefaultableCardDeclarable {
		if (!CardDeclarationAssistant.conformsToDeckable(value))
			return false;

		if (!Object.hasOwn(value, DeclarationInterfacePropertyName.SIDE))
			return false;

		return true;
	}

	private static isIDValid(id: string) {
		return UniqueID.isValid(id);
	}

	/**
	 * @returns `true` if {@link side} is one of the allowed values for {@link DefaultableCardDeclarable.side}
	 */
	private static isSideValid(side: string) {
		return [
			...this.frontSideValues,
			...this.backSideValues
		].includes(side.trim().toLowerCase());
	}

	public static isFrontSide(decl: DefaultableCardDeclarable, throwIfNotValid = false) {
		if (throwIfNotValid && !this.isSideValid(decl.side))
			throw new Error(`Side is not valid: ${decl.side}`);
		return CardDeclarationAssistant.frontSideValues.includes(decl.side);
	}

	private static readonly frontSideValues = ["f", "front"];
	private static readonly backSideValues = ["b", "back"];

	//#endregion
}
