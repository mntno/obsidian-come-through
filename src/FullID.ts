import { TFile } from "obsidian";
import { CardID, NoteID } from "Statistics";

export function asNoteID(value: TFile | string): NoteID {
  if (value instanceof TFile)
    return value.path;
  if (typeof value === 'string' && value.length > 0) 
    return value;
  throw new TypeError(`${value}`);
}

export class FullID implements FullID {

  constructor(noteID: NoteID, cardID: CardID, cardSide?: string) {    
    this._noteID = noteID.trim(); // File names are case sensitive. Do not change case.
    this._cardID = cardID.trim().toLowerCase(); //toLocaleLowerCase('en-US')

    if (cardSide) {
      if (!FullID.isSideValid(cardSide))
        throw new Error(`Invalid value for "side": ${cardSide}. Expected: ${FullID.sideValues.join(", ")}.`);
      this._cardSide = cardSide?.trim().toLowerCase();
    }
  }

  public static create(noteID: NoteID, cardID: CardID, isFrontSide: boolean) {
    return new FullID(noteID, cardID, isFrontSide ? "f" : "b");
  }

  public static createOppositeSide(id: FullID) {
    return FullID.create(id.noteID, id.cardIDOrThrow(), !id.isFrontSide);
  }

  public static fromCard(noteID: NoteID, cardID: CardID): FullID {
    return new FullID(noteID, cardID);
  }

  public newWithCard(id: CardID) {
    return new FullID(this.noteID, id); 
  }

  //#region Parse string

  /**
   * 
   * @param inputString 
   * @returns 
   * @throws `Error` if requirements failed.
   */
  public static fromString(inputString: string): FullID {    
    const parts = inputString.split('@');

    let cardSide: string | undefined;
    let cardID: string | undefined;
    let noteID: string | undefined;

    if (parts.length === 3) {
      cardSide = parts[0] === '' ? undefined : parts[0];
      cardID = parts[1] === '' ? undefined : parts[1];
      noteID = parts[2] === '' ? undefined : parts[2];
    } else if (parts.length === 2) {
      cardSide = undefined;
      cardID = parts[0] === '' ? undefined : parts[0];
      noteID = parts[1] === '' ? undefined : parts[1];
    } else if (parts.length === 1) {
      cardSide = undefined;
      cardID = undefined;
      noteID = parts[0] === '' ? undefined : parts[0];
    } else {
      cardSide = undefined;
      cardID = undefined;
      noteID = undefined;
    }

    if (!noteID || !cardID)
      throw new Error(`Invalid id format: ${inputString}`);

    return new FullID(noteID, cardID, cardSide);
  }

  /**
   * @throws `Error` if requirements failed.
   */
  public static cardIDFromString(str: string) {
    const i = str.indexOf("@", 0);
    if (i < 0) {
      throw new Error();
    }
    else {
      if (i + 1 >= str.length)
        throw new Error();

      const afterSeparator = str.slice(i + 1);
      const i2 = afterSeparator.indexOf("@", 0);
      if (i2 < 0)
        return afterSeparator;
      else 
        return afterSeparator.slice(0, i2);
    }
  }

  public static isSideValid(side?: string) {
    if (!side)
      return false;
    return this.sideValues.includes(side.trim().toLowerCase());
  }

  private static readonly sideValues = ["f", "front", "b", "back"];

  //#endregion

  //#region Getters

  public get noteID(): NoteID {
    return this._noteID;
  }
  private readonly _noteID: NoteID;

  public get cardID(): CardID {
    return this._cardID;
  }
  private readonly _cardID: CardID;  

  public cardIDOrThrow() {
    this.throwIfNoCardID();
    return this.cardID!;
  }

  public throwIfNoCardID() {
    if (!this.cardID)
      throw new Error(`Full ID "${this}" is missing card ID.`);
  }
  
  public get cardSide(): string | undefined {
    return this._cardSide;
  }
  private readonly _cardSide?: string;

  /**
   * @throws `Error` if {@link cardSide} is not set.
   */
  public get isFrontSide() {
    console.assert(this.cardSide);
    if (!this.cardSide)
      throw new Error(`Side not specified on id: ${this.toString()}`);
    return this.cardSide === "f" || this.cardSide === "front";
  }

  //#endregion

  //#region To string

  public toString() {
    if (this.noteID && this.cardID && this.cardSide)
      return `${this.cardSide}@${this.cardID}@${this.noteID}`;
    if (this.noteID && this.cardID)
      return `${this.cardID}@${this.noteID}`;
    return this.noteID;
  }

  public toStringWithoutSide() {
    if (this.noteID && this.cardID)
      return `${this.cardID}@${this.noteID}`;
    return this.noteID;
  }

  //#endregion

  /**
   * Returns `false` if either instance's {@link cardID} is falsy.
   * @param other 
   * @returns 
   */
  public isEqual(other: FullID, sideInsensitive: boolean) {
    if (!this.cardID || !other.cardID)
      return false;

    return this.isNoteEqual(other) && 
      this.isCardEqual(other) && 
      (sideInsensitive ? true : this.isFrontSide == other.isFrontSide);
  }

  public isNoteEqual(other: FullID) {
    return this.noteID === other.noteID;
  }

  public isCardEqual(other: FullID) {
    return this.cardID === other.cardID;
  }

  public hasNoteID(noteID: NoteID) {
    return this.noteID === noteID.trim();
  }

  public hasCardID(cardID: CardID) {
    return this.cardID === cardID.trim().toLowerCase();
  }
}