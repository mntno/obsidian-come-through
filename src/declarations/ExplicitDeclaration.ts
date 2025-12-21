import { UniqueID } from "#/data/UniqueID";
import { CardDeclaration } from "#/declarations/CardDeclaration";
import { CollectionableAssistant, DeckableDeclarable } from "#/declarations/Collectionable";
import { Declarable, DeclarableAssistant, DeclarableProperty, OptionalNullableStringDeclarableProperty, StringDeclarableProperty } from "#/declarations/Declarable";
import { LocalStrictKeys, Obj } from "#/utils/ts";

export const IDScope = {
	Unique: "unique",
	Note: "note",
} as const;

export type IDScope = typeof IDScope[keyof typeof IDScope];

export type DeclarationSide = "front" | "back";

/**
* A {@link DefaultableCardDeclarable} where all default values are set.
*/
export interface CardDeclarable extends DefaultableCardDeclarable {
	id: StringDeclarableProperty;
}

/**
 * The minimum required propertes that need to be specified before
 * default values and/or generated values can be applied
 * to turn it into a {@link CardDeclarable}.
 *
 * See also: {@link CardDeclarationAssistant.conformsToDefaultable}.
 */
export interface DefaultableCardDeclarable extends PageDeclarable, DeckableDeclarable {
	id: OptionalNullableStringDeclarableProperty;
}

/** @abstract */
export interface PageDeclarable extends MaybePageDeclarable {
	side: DeclarationSide;
}

/** @sealed */
export interface MaybePageDeclarable extends Declarable {
	side: DeclarableProperty;
}

type DefaultablePropertyNames = LocalStrictKeys<DefaultableCardDeclarable, DeckableDeclarable>;
type PagePropertyNames = LocalStrictKeys<PageDeclarable, DeckableDeclarable>;

export class ExplicitDeclarationAssistant extends CollectionableAssistant {

	/** @returns `null` if the {@link declaration} is invalid */
	public static createWithUniqueScope(declaration: CardDeclarable) {
		if (!ExplicitDeclarationAssistant.isValid(declaration))
			return null;
		return new CardDeclaration(declaration.id, declaration.side, IDScope.Unique, declaration.deckID, false);
	}

	/** @returns `true` if {@link value} is a valid {@link DefaultableCardDeclarable} and conforms to {@link CardDeclarable}. */
	public static canComplete(value: DefaultableCardDeclarable): value is CardDeclarable {
		if (!ExplicitDeclarationAssistant.Defaultable.isValid(value))
			return false;

		// Completing the values of the top-level interface is the same as making it valid.
		// So if it conforms to the top-level interface it is ready.
		// Any additional non-completable properties should be added to sub interfaces.
		if (!ExplicitDeclarationAssistant.is(value))
			return false;

		// value is top-level interface
		// - Type of `id` is narrowed.
		return value.id === ExplicitDeclarationAssistant.PropertyValue.AWAITING_VALUE;
	}

	/**
		* Makes a {@link DefaultableCardDeclarable} valid by assigning default and generated values to non-required properties.
		* May use if already checked with {@link canComplete}.
		* @param decl
		* @param preventIDs See {@link UniqueID.generateID}
		* @returns `null` if {@link canComplete} returns `false`. If {@link declaration} is already a valid {@link CardDeclarable}, returns the same unmodified {@link declaration}. Otherwise, returns a valid {@link CardDeclarable}.
		* @throws If {@link canComplete} returns `false` or {@link declaration} is already complete/valid.
		*/
	public static completeOrThrow(declaration: DefaultableCardDeclarable, preventIDs?: Set<string>) {

		if (!ExplicitDeclarationAssistant.canComplete(declaration))
			throw new Error("Could not complete declaration.");

		if (ExplicitDeclarationAssistant.isValid(declaration))
			throw new Error("Declaration already complete.");

		return {
			...declaration,
			id: UniqueID.generateID(preventIDs)
		} satisfies CardDeclarable;
	}

	public static override isValid(declarable: CardDeclarable) {
		if (!ExplicitDeclarationAssistant.Defaultable.isValid(declarable))
			return false;

		if (!UniqueID.isValid(declarable.id))
			return false;

		return true;
	}

	public static override is(value: unknown): value is CardDeclarable {
		if (!ExplicitDeclarationAssistant.Defaultable.is(value))
			return false;

		if (ExplicitDeclarationAssistant.PropertyEq.optionalOrNull(Obj.getKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "id")))
			Obj.setKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "id", ExplicitDeclarationAssistant.PropertyValue.AWAITING_VALUE);

		return true
	}

	public static readonly Defaultable = {

		is(value: unknown): value is DefaultableCardDeclarable {
			if (!CollectionableAssistant.is(value))
				return false;

			if (!Obj.hasKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "side"))
				return false;
			if (!ExplicitDeclarationAssistant.PropertyType.isStr(Obj.getKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "side")))
				return false;

			// Make sure optional properties are added to the object.
			if (!Obj.hasKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "id"))
				Obj.setKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "id", ExplicitDeclarationAssistant.PropertyValue.OPTIONAL_NOT_ADDED);

			if (!ExplicitDeclarationAssistant.PropertyType.isOptionalNullableString(Obj.getKey<DefaultableCardDeclarable, DefaultablePropertyNames>(value, "id")))
				return false;

			return true;
		},

		isValid(declarable: DefaultableCardDeclarable) {
			if (!CollectionableAssistant.isValid(declarable))
				return false;

			if (!ExplicitDeclarationAssistant.isSideValid(declarable.side))
				return false;

			if (!ExplicitDeclarationAssistant.PropertyEq.optionalNullOrString(declarable.id))
				return false;

			return true;
		}
	};

	public static readonly MaybePage = {

		is(value: unknown): value is MaybePageDeclarable {
			if (!CollectionableAssistant.is(value))
				return false;

			if (!Obj.hasKey<MaybePageDeclarable, PagePropertyNames>(value, "side"))
				return false;

			return true;
		},

		isValid(declarable: MaybePageDeclarable): boolean {
			if (!DeclarableAssistant.isValid(declarable))
				return false;

			if (!ExplicitDeclarationAssistant.PropertyEq.any(declarable.side))
				return false;

			return true;
		}
	};

	public static isFrontSide(decl: DefaultableCardDeclarable, throwIfNotValid = false) {
		if (throwIfNotValid && !this.isSideValid(decl.side))
			throw new Error(`Side is not valid: ${decl.side}`);
		return ExplicitDeclarationAssistant.frontSideValues.includes(decl.side);
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

	private static readonly frontSideValues = ["f", "front"];
	private static readonly backSideValues = ["b", "back"];
}
