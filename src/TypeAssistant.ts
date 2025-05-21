import { CardDeclaration, CardDeclarable } from "declarations/CardDeclaration";
import { DeckableFullID, DeckID, FullID, NoteID } from "FullID";
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
		? new DeckableFullID(noteID, declaration.id, CardDeclaration.isFrontSide(declaration, true), [declaration.deckID])
		: FullID.create(noteID, declaration.id, CardDeclaration.isFrontSide(declaration, true));
}

export function isObject(value: any) {
	return typeof value === "object" && value !== null; // `null` is an object
}

export function isString(value: any) {
	return typeof value === "string";
}

export function isNumber(value: any) {
	return typeof value === "number";
}
