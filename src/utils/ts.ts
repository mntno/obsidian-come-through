import { Env } from "env";
import { UnsignedInteger } from "types";
import { TimeoutError } from "utils/errors";

export const Arr = {
	firstOrNull: <T>(a: Array<T>): T | null => a.first() ?? null,
	nonEmpty: <T>(v: T[] | unknown): v is Array<T> => Array.isArray(v) && v.length > 0,
	toMutable: <T>(a: readonly T[]): T[] => [...a],
} as const;

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
}

export const Err = {
	toError: (e: unknown): Error => e instanceof Error ? e : new Error(String(e)),
} as const;

export const KeyValue = {
	isNotEmpty: <K, V>(v: Map<K, V> | undefined): v is Map<K, V> => v !== undefined && v.size > 0,
} as const;

export const Num = {

	is: (value: unknown): value is number => {
		return typeof value === "number";
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

} as const;

export const Obj = {
	/**
		* If {@link value} is `null`, `false` is returned even thoigh `null` is an object.
		*
		* @param value
		* @returns `true` if `typeof` for {@link value} returns `"object"` and {@link value} is not `null`.
		*/
	is: (value: unknown): value is object => {
		return typeof value === "object" && value !== null; // `null` is an object
	},
}

export const Str = {
	EMPTY: "",
	SPACE: " ",
	NON_BREAKING_SPACE: " ",

	is: (value: unknown): value is string => typeof value === "string",
	isNonEmpty: (value: unknown): value is string => typeof value === "string" && value !== "",

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
} as const;

function isUnsignedInteger(value: unknown): value is UnsignedInteger {
	return Num.is(value) && Number.isInteger(value) && value >= 0;
}
