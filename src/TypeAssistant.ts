import { CardDeclarationAssistant, CardDeclarable } from "declarations/CardDeclaration";
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

export function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null; // `null` is an object
}

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}
