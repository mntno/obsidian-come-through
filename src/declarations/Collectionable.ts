import { UniqueID } from "#/data/UniqueID";
import { Declarable, DeclarableAssistant, NullableStringDeclarableProperty } from "#/declarations/Declarable";
import { LocalStrictKeys } from "#/types";
import { Obj } from "#/utils/ts";

export interface DeckableDeclarable extends Declarable {
	/** Optional. */
	deckID: NullableStringDeclarableProperty;
}

const DeckableUserKeyName = {
	DECK: "deck"
};

const DeckablePropertyName = {
	DECK_ID: "deckID",
};

type PropertyNames = LocalStrictKeys<DeckableDeclarable, Declarable>;

/**
	* Helpers related to {@link DeckableDeclarable}.
	*/
export class CollectionableAssistant extends DeclarableAssistant {

	public static override is(value: unknown): value is DeckableDeclarable {
		if (!DeclarableAssistant.is(value))
			return false;

		// Optional. Add if not exists
		if (!Obj.hasKey<DeckableDeclarable, PropertyNames>(value, "deckID"))
			Obj.setKey<DeckableDeclarable, PropertyNames>(value, "deckID", CollectionableAssistant.PropertyValue.FALLBACK_TO_SYSTEM_DEFAULT);

		if (!DeclarableAssistant.PropertyType.isNullableString(Obj.getKey<DeckableDeclarable, PropertyNames>(value, "deckID")))
			return false;

		return true;
	}

	public static override isValid(declarable: DeckableDeclarable) {
		if (!DeclarableAssistant.isValid(declarable))
			return false;
		return declarable.deckID === null || UniqueID.isValid(declarable.deckID);
	}

	/**
		* Creates a copy of the declaration with the specified deck ID.
		*/
	public static copyWithDeck<T extends DeckableDeclarable>(declaration: T, deckID: string | null): T {
		return {
			...declaration,
			deckID: deckID,
		};
	}

	/**
	 * Transform user friendly YAML keys to interface/class properties.
	 * Opposite of {@link toUserFriendlyKeys}.
	 *
	 * @param obj
	 */
	public static override fromUserFriendlyKeys(obj: Record<string, unknown>) {
		DeclarableAssistant.fromUserFriendlyKeys(obj);

		if (Object.hasOwn(obj, DeckableUserKeyName.DECK)) {
			const deckID = obj[DeckableUserKeyName.DECK];
			delete obj[DeckableUserKeyName.DECK];
			obj[DeckablePropertyName.DECK_ID] = deckID;
		}
	}

	public static override toUserFriendlyKeys(obj: Declarable) {
		DeclarableAssistant.toUserFriendlyKeys(obj);

		if (Object.hasOwn(obj, DeckablePropertyName.DECK_ID)) {
			const deckID = obj[DeckablePropertyName.DECK_ID];
			delete obj[DeckablePropertyName.DECK_ID];
			// Only include if specific deck set.
			if (deckID)
				obj[DeckableUserKeyName.DECK] = deckID;
		}
	}
}
