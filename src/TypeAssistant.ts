import { DeckableFullID, FullID, NoteID } from "#/data/FullID";
import { CardDeclarable, ExplicitDeclarationAssistant } from "#/declarations/ExplicitDeclaration";
import { Num, Str } from "#/utils/ts";
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
		? new DeckableFullID(noteID, declaration.id, ExplicitDeclarationAssistant.isFrontSide(declaration, true), [declaration.deckID])
		: FullID.create(noteID, declaration.id, ExplicitDeclarationAssistant.isFrontSide(declaration, true));
}

export function isString(value: unknown): value is string {
	return Str.is(value);
}

export function isNumber(value: unknown): value is number {
	return Num.is(value);
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
