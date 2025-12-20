// types.ts - Global type declarations

// Global type aliases

/**
 * Creates a "strict" version of a type by removing its index signature.
 * This is useful for enforcing excess property checks on types that have an index signature.
 */
export type OmitIndexSignature<T> = {
	[K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
};

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type UnsignedInteger = number & { readonly __brand: "UnsignedInteger" };
