import { DeclarationBlock, DeclarationSpecification } from "DeclarationBlock";
import { FullID, NoteID } from "FullID";
import { TFile } from "obsidian";

export function asNoteID(value: TFile | string): NoteID {
  if (value instanceof TFile)
    return value.path;
  if (typeof value === 'string' && value.length > 0)
    return value;
  throw new TypeError(`${value}`);
}

export function fullIDFromDeclaration(declaration: DeclarationSpecification, noteID: NoteID) {
  return FullID.create(noteID, declaration.id, DeclarationBlock.isFrontSide(declaration, true));
}