import { CollectionableAssistant, DeckableDeclarable } from "#/declarations/Collectionable";
import { CommandName, Commands } from "#/declarations/CommandNames";
import { LocalStrictKeys } from "#/types";
import { Obj, Str } from "#/utils/ts";
/**
 * @abstract All commands extend this interface.
 */
export interface CommandableDeclarable extends DeckableDeclarable {
	name: CommandName;
}

type PropertyNames = LocalStrictKeys<CommandableDeclarable, DeckableDeclarable>;

/**
	* Helpers related to {@link CommandableDeclarable}.
	*/
export class CommandableAssistant extends CollectionableAssistant {

	/**
	 * Checks if the provided object minimally conforms to the structure of a {@link CommandableDeclarable}.
	 * @param value The object to check.
	 * @returns `true` if the object has at least the minimum properties expected of a {@link CommandableDeclarable}, `false` otherwise.
	 */
	public static override is(value: unknown): value is CommandableDeclarable {
		if (!CollectionableAssistant.is(value))
			return false;

		if (!Obj.hasKey<CommandableDeclarable, PropertyNames>(value, "name", (value) => Str.is(value)))
			return false;

		return true;
	}

	public static override isValid(declaration: CommandableDeclarable): boolean {
		if (!CollectionableAssistant.isValid(declaration))
			return false;

		return Commands.Name.exists(declaration.name);
	}
}
