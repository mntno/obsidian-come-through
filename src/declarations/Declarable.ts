import { Bln, Null, Num, Obj, Str } from "#/utils/ts";

/**
	* Allowable non-nullable types.
	*
	* - {@link DeclarableAssistant.PropertyType.isNullable} needs to be updated if types are added or removed.
	*/
type NonNullableDeclarableProperty = string | number | boolean;

/** Allowable types. */
export type DeclarableProperty = NonNullableDeclarableProperty | null | undefined;

export type StringDeclarableProperty = Extract<DeclarableProperty, string>;
export type NullableStringDeclarableProperty = Extract<DeclarableProperty, string | null>;
export type OptionalNullableStringDeclarableProperty = Extract<DeclarableProperty, string | null | undefined>;

export type NumberDeclarableProperty = Extract<DeclarableProperty, number>;
export type NullableNumberDeclarableProperty = Extract<DeclarableProperty, number | null>;
export type OptionalNullableNumberDeclarableProperty = Extract<DeclarableProperty, number | null | undefined>;

/**
	* @abstract
	*/
export interface Declarable {
	[key: string]: DeclarableProperty;
}

/**
	* Helpers related to {@link Declarable}.
	*/
export class DeclarableAssistant {

	public static is(value: unknown): value is Declarable {
		return Obj.is(value);
	}

	public static isValid(_value: unknown): boolean {
		return true;
	}

	protected static readonly PropertyValue = {
		/** Indicates that this optional property was not provided. */
		OPTIONAL_NOT_ADDED: undefined,
		/** "I am not providing a value, so use the system default." */
		FALLBACK_TO_SYSTEM_DEFAULT: null,
		/** "I am explicitly providing a value, and that value is 'nothing'." */
		EXPLICIT_EMPTY_STRING: Str.EMPTY,
		/** This property is of type {@link StringDeclarableProperty} and will be populated with a value programatically. Set it to this temporary value to satisfy the non-nullable type. */
		AWAITING_VALUE: Str.EMPTY,
	} as const;

	/**
	 * Some of these do exactly the same as the {@link PropertyType} equivalents, but use them anyway for "semantic clarity".
	 */
	public static readonly PropertyEq = {
		/** Property was not provided. */
		optional: (value: unknown): value is typeof DeclarableAssistant.PropertyValue.OPTIONAL_NOT_ADDED =>
			value === DeclarableAssistant.PropertyValue.OPTIONAL_NOT_ADDED,

		optionalOrNull: (value: unknown): value is typeof DeclarableAssistant.PropertyValue.OPTIONAL_NOT_ADDED | typeof DeclarableAssistant.PropertyValue.FALLBACK_TO_SYSTEM_DEFAULT =>
			value === DeclarableAssistant.PropertyValue.OPTIONAL_NOT_ADDED || value === null,

		optionalNullOrString: (value: unknown, predicate?: (str: string) => boolean): value is OptionalNullableStringDeclarableProperty =>
			Str.is(value) && (predicate === undefined || predicate(value)) || DeclarableAssistant.PropertyEq.optionalOrNull(value),

		optionalNullOrNumber: (value: unknown, predicate?: (num: number) => boolean): value is OptionalNullableNumberDeclarableProperty =>
			Num.is(value) && (predicate === undefined || predicate(value)) || DeclarableAssistant.PropertyEq.optionalOrNull(value),

		any: (value: unknown): value is DeclarableProperty =>
			Str.is(value) || Num.is(value) || Bln.is(value) || DeclarableAssistant.PropertyEq.optionalOrNull(value),
	};

	protected static readonly PropertyType = {

		isNullable: (value: unknown) => Null.is(value),

		isNullableString: (value: unknown): value is NullableStringDeclarableProperty => Str.is(value) || Null.is(value),

		isNullableNumber: (value: unknown): value is NullableNumberDeclarableProperty => Num.is(value) || Null.is(value),

		isOptionalNullableString: (value: unknown): value is OptionalNullableStringDeclarableProperty =>
			value === undefined || DeclarableAssistant.PropertyType.isNullableString(value),

		isOptionalNullableNumber: (value: unknown): value is OptionalNullableNumberDeclarableProperty =>
			value === undefined || DeclarableAssistant.PropertyType.isNullableNumber(value),

		isStr: (value: unknown): value is StringDeclarableProperty => Str.is(value),
		isNum: (value: unknown): value is NumberDeclarableProperty => Num.is(value),
	};

	/**
	 * Transform user friendly YAML keys to interface/class properties.
	 * Opposite of {@link toUserFriendlyKeys}.
	 *
	 * @param obj
	 */
	protected static fromUserFriendlyKeys(_obj: Record<string, unknown>) {
	}

	protected static toUserFriendlyKeys(_obj: Declarable) {
	}
}
