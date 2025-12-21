import { Env } from "env";
import { UnsignedInteger } from "types";
import { TimeoutError } from "utils/errors";

/** Strips index signatures to ensure only hard-coded properties are allowed in the union. */
export type StrictKeys<T> = keyof {
	[K in keyof T as string extends K ? never : number extends K ? never : K]: unknown;
};

/** Extract only the keys present in T1 that are not in T2 using {@link StrictKeys}. */
export type LocalStrictKeys<T1, T2> = Exclude<StrictKeys<T1>, StrictKeys<T2>>;

export const Arr = {
	firstOrNull: <T>(a: Array<T>): T | null => a.first() ?? null,
	nonEmpty: <T>(v: T[] | unknown): v is Array<T> => Array.isArray(v) && v.length > 0,
	toMutable: <T>(a: readonly T[]): T[] => [...a],
	clear: <T>(a: T[]): void => { a.length = 0; },
};

export const Async = {
	/**
	 * @param promise The promise to execute
	 * @param timeoutMs The timeout in milliseconds
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
	withTimeout: <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
		// Create a promise that rejects in <timeoutMs> milliseconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
			}, timeoutMs);
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
	isTrue: (value: unknown): value is boolean => typeof value === "boolean" && value === true,
	TRUE_STR: "true" as BoolStr,
	isTrueStr: (value: unknown): boolean => typeof value === "string" && value === Bln.TRUE_STR,
};


export const Err = {
	toError: (e: unknown): Error => e instanceof Error ? e : new Error(String(e)),
};

export const KeyValue = {
	isNotEmpty: <K, V>(v: Map<K, V> | undefined): v is Map<K, V> => v !== undefined && v.size > 0,
};

export const Num = {

	is: (value: unknown): value is number => {
		return typeof value === "number" && !Number.isNaN(value);
	},

	isNaN: (value: unknown) => Number.isNaN(value),

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

		if (!Obj.is(obj) || !Object.hasOwn(obj, key as PropertyKey))
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

export const Str = {
	EMPTY: "",
	SPACE: " ",
	NON_BREAKING_SPACE: " ",
	LF: "\n",
	TAB: "\t",

	/**
		* Checks whether `value` is a string.
		*
		* @param value The value to check.
		* @returns `true` if `value` is a string, otherwise `false`.
		*/
	is: (value: unknown): value is string => typeof value === "string",

	/**
		* Checks whether `value` is a non-empty string.
		*
		* @param value The value to check.
		* @returns `true` if `value` is a string with at least one character, otherwise `false`.
		*/
	isNonEmpty: (value: unknown): value is string => typeof value === "string" && value !== "",

	/**
		* Returns `value` if it is a non-empty string, otherwise `undefined`.
		*
		* @param value The value to check.
		* @returns The original string if non-empty, or `undefined`.
		*/
	nonEmpty: (value: unknown): string | undefined => typeof value === "string" && value !== "" ? value : undefined,

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
