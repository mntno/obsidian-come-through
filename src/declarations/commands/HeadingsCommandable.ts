import { CommandableAssistant, CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParser } from "#/declarations/CommandDeclarationParser";
import { NumberDeclarableProperty, OptionalNullableNumberDeclarableProperty } from "#/declarations/Declarable";
import { LocalStrictKeys } from "#/types";
import { Obj } from "#/utils/ts";
import { HeadingCache } from "obsidian";

/**
	* A command declaration that uses headings as dividers.
	* @abstract
	*/
export interface HeadingsCommandableDeclarable extends DefaultableHeadingsCommandableDeclarable {
	level: NumberDeclarableProperty;
}

export interface DefaultableHeadingsCommandableDeclarable extends CommandableDeclarable {
	level: OptionalNullableNumberDeclarableProperty;
}

type PropertyNames = LocalStrictKeys<DefaultableHeadingsCommandableDeclarable, CommandableDeclarable>;


export abstract class HeadingsCommandableAssistant extends CommandableAssistant {

	public static override is(value: unknown): value is HeadingsCommandableDeclarable {
		if (!ThisAssistant.Defaultable.is(value))
			return false;

		if (!ThisAssistant.PropertyType.isNum(Obj.getKey<DefaultableHeadingsCommandableDeclarable, PropertyNames>(value, "level")))
			return false;

		return true;
	}

	public static override isValid(declarable: HeadingsCommandableDeclarable) {
		if (!ThisAssistant.Defaultable.isValid(declarable))
			return false;

		if (declarable.level < 1)
			return false;

		return true;
	}

	public static readonly Defaultable = {

		is(value: unknown): value is DefaultableHeadingsCommandableDeclarable {
			if (!CommandableAssistant.is(value))
				return false;

			// Add optional properties with default values.
			if (!Obj.hasKey<DefaultableHeadingsCommandableDeclarable, PropertyNames>(value, "level"))
				Obj.setKey<DefaultableHeadingsCommandableDeclarable, PropertyNames>(value, "level", ThisAssistant.PropertyValue.OPTIONAL_NOT_ADDED);

			if (!ThisAssistant.PropertyType.isOptionalNullableNumber(Obj.getKey<DefaultableHeadingsCommandableDeclarable, PropertyNames>(value, "level")))
				return false;

			return true;
		},

		isValid(declarable: HeadingsCommandableDeclarable) {
			if (!CommandableAssistant.isValid(declarable))
				return false;

			if (!ThisAssistant.PropertyEq.optionalNullOrNumber(declarable.level))
				return false;

			return true;
		}
	}
}

/**
	* @abstract
	*/
export abstract class HeadingsDeclarationParser<T extends HeadingsCommandableDeclarable>
	extends CommandDeclarationParser<T> {

	/**
		* Checks if the heading level is according to what is specified in {@link AlternateHeadingsDeclarable}.
		* @param parentHeadingLevel The level of the containing heading.
		* @param section Section to check.
		* @returns `true` if {@link section} is a {@link HeadingCache} and its level equals the {@link parentHeadingLevel} plus {@link AlternateHeadingsDeclarable.level}.
		*/
	protected isOnSpecifiedLevel(parentHeadingLevel: number, section: HeadingCache) {
		return section.level == parentHeadingLevel + this.commandable.level;
	}
}

const ThisAssistant = HeadingsCommandableAssistant;
