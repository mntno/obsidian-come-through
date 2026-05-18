import { Env } from "#/env";
import { StrictKeys, UnsignedInteger } from "#/types";
import { Win } from "#/utils/dom/dom";
import { TimeoutError, UnexpectedUndefinedError } from "#/utils/errors";

type ArrMatch<T> =
	| { kind: "empty" }
	| { kind: "one"; item: T }
	| { kind: "many"; items: T[] };

export const Arr = {

	is: <T>(v: unknown): v is T[] => Array.isArray(v),
	isReadonly: <T>(v: unknown): v is ReadonlyArray<T> => Array.isArray(v),

	from: <T>(v: T[] | T): T[] => Arr.is(v) ? v : [v],
	readonlyFrom: <T>(v: ReadonlyArray<T> | T): ReadonlyArray<T> => Arr.isReadonly(v) ? v : [v],

	firstOrThrow: <T>(a: ReadonlyArray<T>): T => {
		if (a.length === 0) throw new RangeError("Array is empty");
		return a[0]!;
	},

	first: <T>(a: T[]): T | undefined => a.length > 0 ? a[0] : undefined,
	last: <T>(a: T[]): T | undefined => a.length > 0 ? a[a.length - 1] : undefined,

	empty: Object.freeze([]) as readonly unknown[],

	/**
		* Checks whether {@link v} is a non-empty array.
		* @returns `true` if {@link v} is a non-empty array, otherwise `false`.
		*/
	isNonEmpty: <T>(v: unknown): v is T[] => Arr.is(v) && v.length > 0,

	isEmpty: <T>(a: T[] | Readonly<T[]>): boolean => Arr.is(a) && a.length === 0,

	/** @returns The input value {@link v} if it is a non-empty array, otherwise `undefined`. */
	nonEmpty: <T>(v: unknown): T[] | undefined => Arr.isNonEmpty<T>(v) ? v : undefined,

	toMutable: <T>(a: readonly T[]): T[] => [...a],

	clear: <T>(a: T[]): void => { a.length = 0; },

	/** @returns An empty array if {@link a} is `null` or `undefined`; otherwise {@link a}. */
	orEmpty: <T>(a: T[] | null | undefined): T[] => a === undefined || a === null ? [] : a,

	match: <T>(a: T[] | null | undefined): ArrMatch<T> => {
		if (a === undefined || a === null || a.length === 0)
			return { kind: "empty" };
		if (a.length === 1)
			return { kind: "one", item: a[0]! };
		return { kind: "many", items: a };
	},

	/**
	 * Short-hand to use when you know the index exists, e.g., in a `for` loop.
	 * @throws Throws a {@link UnexpectedUndefinedError}
	 */
	expAt: <T>(a: T[], idx: number) => {
		const v = a[idx];
		if (v === undefined)
			throw new UnexpectedUndefinedError();
		return v;
	},
};

export const Async = {
	/**
	 * @param promise The promise to execute
	 * @param timeoutMs The timeout in milliseconds
	 * @param win The window to set the timeout on
	 * @returns A new promise that will resolve with the original promise's result or reject with {@link Err.TimeoutError}
	 * @throws Throws a {@link Err.TimeoutError} if the promise does not settle within the specified timeout
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await withTimeout(slowOperation(), 1000);
	 * } catch (error) {
	 *   if (error instanceof Err.TimeoutError) {
	 *     console.log('Operation timed out');
	 *   }
	 * }
	 * ```
	 */
	withTimeout: <T>(promise: Promise<T>, timeoutMs: number, win: Window): Promise<T> => {
		// Create a promise that rejects in <timeoutMs> milliseconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			Win.Timeout.set(win, timeoutMs, () => {
				reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
			});
		});

		// Race the input promise against the timeout promise
		return Promise.race([
			promise,
			timeoutPromise
		]);
	}
};

export type BoolStr = "true" | "false";

export const Bln = {
	is: (value: unknown): value is boolean => typeof value === "boolean",
	/** @returns `true` if {@link value} is a `boolean` and its value is `true`. */
	isTrue: (value: unknown): value is boolean => typeof value === "boolean" && value === true,
	TRUE_STR: "true" as BoolStr,
	isTrueStr: (value: unknown): boolean => typeof value === "string" && value === Bln.TRUE_STR,
};


export const Err = {
	/** `Err.is(v, ErrorClassType)` */
	is: <T extends Error>(v: unknown, ctor: new (...args: never[]) => T): v is T => v instanceof ctor,
	toError: (v: unknown): Error => v instanceof Error ? v : new Error(String(v)),
};

export const KeyValue = {
	isNotEmpty: <K, V>(v: Map<K, V> | undefined): v is Map<K, V> => v !== undefined && v.size > 0,
};

export const Num = {

	is: (value: unknown): value is number => {
		return Number.isFinite(value); // Number.isFinite implies typeof value === "number" and excludes both NaN and ±Infinity,
	},

	isNaN: (value: unknown) => Number.isNaN(value),

	isZero: (value: unknown) => Num.is(value) && value === 0,

	fromStr: (s: string) => {
		const ts = Str.trimmedNonEmpty(s);
		if (ts === undefined)
			return null;
		const n = Number(ts);
		return Num.is(n) ? n : null;
	},

	fromStrOrThrow: (s: string): number => {
		const n = Num.fromStr(s);
		if (n === null)
			throw new TypeError(`Cannot convert to number: "${s}"`);
		return n;
	},

	UInt: {
		assert: (n: number) => Env.assert(isUnsignedInteger(n)),
		create: (n: number): UnsignedInteger => {
			if (!isUnsignedInteger(n))
				throw new Error('Invalid UnsignedNumber: must be a non-negative integer.');
			return n;
		},
		is: isUnsignedInteger,
	} as const,

};

export const Null = {
	is: (value: unknown): value is null => value === null, // typeof value === "object" && !Str.is(value) && !Num.is(value) && !Bln.is(value)
	/** Treat `undefined` as `null`. */
	fromNullish: <T>(value: T | undefined | null): T | null => value === undefined ? null : value,
};

export const Nullish = {
	ifNot: <T, R>(value: T | null | undefined, ifPresent: (value: T) => R, ifAbsent: () => R): R => {
		return value !== null && value !== undefined ? ifPresent(value) : ifAbsent();
	}
};

export const Obj = {
	/**
		* If {@link value} is `null`, `false` is returned even thoigh `null` is an object.
		*
		* @param value
		* @returns `true` if `typeof` for {@link value} returns `"object"` and {@link value} is not `null`.
		*/
	is: (value: unknown): value is object => {
		return typeof value === "object" && value !== null; // In JavaScript runtime, `null` is an object. In TypeScript, with `strictNullChecks`, it is not.
	},

	try: <T extends object>(value: unknown): T | null => Obj.is(value) ? value as T : null,

	/**
	 * Short-hand to use when you know the key exists.
	 * @throws Throws a {@link UnexpectedUndefinedError}
	 */
	expAt: <K extends string | number | symbol, V>(obj: Record<K, V>, key: K): V => {
		const v = obj[key];
		if (v === undefined)
			throw new UnexpectedUndefinedError();
		return v;
	},

	/**
		* Trims all string values of top-level properties of {@link obj} in place (non-recursive).
		*
		* @param obj The object whose string values to trim. Non-string values are ignored.
		*/
	trimValues: (obj: Record<string, unknown>): void => {
		for (const key of Object.keys(obj)) {
			const value = obj[key];
			if (Str.is(value))
				obj[key] = value.trim();
		}
	},

	numKeys: <T extends Record<string, unknown>>(obj: T): number => {
		return Object.keys(obj).length;
	},

	nonEmpty: <T extends Record<string, unknown>>(obj: T): boolean => {
		return Object.keys(obj).length > 0;
	},

	/**
		* @param obj
		* @param key
		* @param callbacks Optional validation functions. Each receives the property value, the object itself, and the key.
		* @returns `true` if {@link obj} is an object and the {@link key} exists and all {@link callbacks} pass.
		*/
	hasKey: <T extends Record<string, unknown>, K extends StrictKeys<T>>(
		obj: Record<string, unknown>,
		key: K,
		...callbacks: Array<(value: T[K], obj: Record<string, unknown>, key: K) => boolean>
	): boolean => {

		if (!Obj.is(obj) || !Object.hasOwn(obj, key))
			return false;

		return callbacks.every((cb) => cb(obj[key] as T[K], obj, key));
	},

	getKey: <T extends Record<string, unknown>, K extends StrictKeys<T>>(
		obj: Record<string, unknown>,
		key: K
	): T[K] => {
		return obj[key] as T[K];
	},

	setKey: <T extends Record<string, unknown>, K extends StrictKeys<T>>(
		obj: Record<string, unknown>,
		key: K,
		value: T[K]
	): void => {
		obj[key] = value;
	},
};

/** Set convenience functions. */
export const St = {
	is: <T>(v: unknown): v is Set<T> => v instanceof Set,
	isReadonly: <T>(v: unknown): v is ReadonlySet<T> => v instanceof Set,
	isEmpty: <T>(a: Set<T> | ReadonlySet<T>): boolean => a.size === 0,

	fromArr: <T>(a: T[] | null | undefined): Set<T> => a !== null && a !== undefined ? new Set(a) : new Set(),

	/** A `Set` is not serializable: `JSON.stringify(new Set([1, 2, 3])) → "{}"` */
	toArr: <T>(a: Set<T> | ReadonlySet<T>): T[] => Array.from(a),

	add: <T>(s: Set<T>, items: T[] | null | undefined): Set<T> => {
		if (items !== null && items !== undefined)
			for (const item of items)
				s.add(item);
		return s;
	},
};

export const Str = {
	EMPTY: "",
	SPACE: " ",
	NON_BREAKING_SPACE: " ",
	LF: "\n",
	TAB: "\t",

	/**
		* Checks whether `value` is a string.
		* @param value The value to check.
		* @returns `true` if `value` is a string, otherwise `false`.
		*/
	is: (value: unknown): value is string => typeof value === "string",

	/**
		* Checks whether `value` is a non-empty string.
		* @param value The value to check.
		* @returns `true` if `value` is a string with at least one character, otherwise `false`.
		*/
	isNonEmpty: (value: unknown): value is string => typeof value === "string" && value !== Str.EMPTY,

	/**
		* Checks whether `value` is a string that is non-empty after trimming.
		* @param value The value to check.
		* @returns `true` if `value` is a string that is non-empty after trimming, otherwise `false`.
		*/
	isTrimmedNonEmpty: (value: unknown): value is string => Str.isNonEmpty(value) && value.trim() !== Str.EMPTY,

	/**
		* Returns `value` if it is a non-empty string, otherwise `undefined`.
		* @param value The value to check.
		* @returns The original string if non-empty, else `undefined`.
		*/
	nonEmpty: (value: unknown): string | undefined => Str.isNonEmpty(value) ? value : undefined,

	/**
		* Returns the trimmed `value` if it is a non-empty string, otherwise `undefined`.
		* @param value The value to check.
		* @returns The trimmed string if non-empty, else `undefined`.
		*/
	trimmedNonEmpty: (value: unknown): string | undefined => Str.is(value) ? Str.nonEmpty(value.trim()) : undefined,

	/**
	 * Converts a string to sentence case.
	 * @returns The sentence-cased string, or the original value if it is empty.
	 */
	toSingleSentenceCase: (str: string): string => {
		const s = Str.nonEmpty(str);
		if (s === undefined)
			return str;
		return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
	},

	/**
		* Values set to `undefined` are invalid JSON.
		* If optional dates are stored in JSON files, use this method to make sure any unset properties are serialized and deserialized.
		*
		* - This is particularly important when diffing two files.
		*
		* @param date The date to convert.
		* @returns The ISO 8601 string representation of the date, or `null` if the date is `undefined`.
		*/
	toIsoStringOrNull: (date: Date | undefined) => {
		return date !== undefined ? date.toISOString() : null
	},
};

export const Union = {
	/**
		* Exhaustive pattern matching for Discriminated Unions.
		*
		* @param union The union object.
		* @param discriminant The key used for narrowing (e.g., "type").
		* @param handlers A map of handlers for every possible value of the discriminant.
		*/
	match: <U extends Record<D, string | number>, D extends keyof U, R>(
		union: U,
		discriminant: D,
		handlers: { [V in U[D]]: (val: Extract<U, Record<D, V>>) => R }
	): R => {
		const key = union[discriminant];
		const handler = handlers[key] as (val: unknown) => R;
		return handler(union);
	}
};

function isUnsignedInteger(value: unknown): value is UnsignedInteger {
	return Num.is(value) && Number.isInteger(value) && value >= 0;
}

/**
	* A second union member to suppress ESLint's `no-unnecessary-condition` rule from firing. This occurs when TypeScript narrows a union to a single literal (i.e. the union has only one real value), making comparisons appear always true.
	*
	* @example
	* // Without UNARY_UNION_SUPPRESS, ESLint warns: "comparison is always true, since 'value' === 'value'"
	* type MyType = "value";
	*
	* // With UNARY_UNION_SUPPRESS, the union has two values and ESLint is satisfied:
	* type MyType = "value" | typeof UNARY_UNION_SUPPRESS;
	*
	* // In a switch, add a case for UNARY_UNION_SUPPRESS to satisfy exhaustiveness checking.
	* // The default case handles truly unexpected values:
	* switch (myValue) {
	*	  case UNARY_UNION_SUPPRESS:
	*		  break;
	*	  case "value": {
	*		  // handle value
	*		  break;
	*	  }
	*   // Also possible to cover unexpected value if needed, e.g., if value comes from user.
	*	  //default:
	*	  //  throw new Error(`Unexpected value: ${myValue}`);
	* }
	*
	* // Once a second real value is added to the union, UNARY_UNION_SUPPRESS is no longer needed and can be removed:
	* type MyType = "value" | "anotherValue";
	*
	* switch (myValue) {
	*	  case "value": {
	*		  // handle value
	*		  break;
	*	  }
	*	  case "anotherValue": {
	*		  // handle anotherValue
	*		  break;
	*	  }
	*	  //default:
	*	  //  throw new Error(`Unexpected value: ${myValue}`);
	* }
	*/
export const UNARY_UNION_SUPPRESS = "suppress" as const;

export type IterationAction = {
	/** Whether to include the file in the result set. */
	include: boolean;
	/** Whether to stop the recursion immediately. */
	stop: boolean;
};

export type IterationCallback<T> = (file: T, index: number, currentResults: T[]) => boolean | IterationAction;
