import { CardDeclarable, CardDeclarationAssistant } from "declarations/CardDeclaration";
import { DeckableFullID, FullID, NoteID } from "FullID";
import { TFile } from "obsidian";

export function asNoteID(value: TFile | string): NoteID {
	if (value instanceof TFile)
		return value.path;
	if (isString(value) && value.length > 0)
		return value;
	throw new TypeError(`${value}`);
}

export function fullIDFromDeclaration(declaration: CardDeclarable, noteID: NoteID): DeckableFullID | FullID {
	return declaration.deckID
		? new DeckableFullID(noteID, declaration.id, CardDeclarationAssistant.isFrontSide(declaration, true), [declaration.deckID])
		: FullID.create(noteID, declaration.id, CardDeclarationAssistant.isFrontSide(declaration, true));
}

/**
 * If {@link value} is `null`, `false` is returned even thoigh `null` is an object.
 *
 * @param value
 * @returns `true` if `typeof` for {@link value} returns `"object"` and {@link value} is not `null`.
 */
export function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null; // `null` is an object
}

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isDate(value: unknown): value is Date {
	// `getTime` returns NaN if the date is invalid.
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime
	return value instanceof Date && !isNaN(value.getTime());
}

export function parseStrictFloat(value: unknown): number | null {
	if (value === null || value === undefined || !isString(value))
		return null;

	// The unary plus (+) is a concise way to perform a strict conversion.
	// It returns NaN if the entire string isn't a valid number.
	const num = +value;

	if (Number.isNaN(num)) {
		//console.error(`Conversion failed for: ${value}`);
		return null;
	}

	return num;
}

/**
 * Values set to `undefined` are invalid JSON.
 * If optional dates are stored in JSON files, use this method to make sure any unset properties are serialized and deserialized.
 *
 * - This is particularly important when diffing two files.
 *
 * @param date The date to convert.
 * @returns The ISO 8601 string representation of the date, or `null` if the date is `undefined`.
 */
export function toIsoStringOrNull(date: Date | undefined) {
	return date !== undefined ? date.toISOString() : null
}
