// types.ts - Global type declarations

// Global type aliases

/**
 * Creates a "strict" version of a type by removing its index signature.
 * This is useful for enforcing excess property checks on types that have an index signature.
 */
export type OmitIndexSignature<T> = {
	[K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
};

/** Strips index signatures to ensure only hard-coded properties are allowed in the union. */
export type StrictKeys<T> = keyof OmitIndexSignature<T>;

/** Extract only the keys present in T1 that are not in T2 using {@link StrictKeys}. */
export type LocalStrictKeys<T1, T2> = Exclude<StrictKeys<T1>, StrictKeys<T2>>;

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type UnsignedInteger = number & { readonly __brand: "UnsignedInteger" };
