import { FullID, CardID, NoteID } from "FullID";
import { asNoteID } from "TypeAssistant";
import { UniqueID } from "UniqueID";

export type DeckID = string;

//#region Data structure

export interface DataStoreRoot {
  decks: DecksData;
  active: NotesData;
  archived: NotesData;
  removed: RemovedData;
}

type DecksData = Record<DeckID, DeckData>;

interface DeckData {
  /** Name of the deck */
  n: string;
  /** Parent decks */
  p: DeckID[];
}

type NotesData = Record<NoteID, NoteData>;

interface NoteData {
  /** All cards in note. */
  cs: CardsData;
}

type RemovedData = Record<NoteID, RemovedNoteData>;

interface RemovedCardData extends CardData {
  /** Date marked for removal. */
  date: Date,
}

interface RemovedNoteData {
  cs: Record<CardID, RemovedCardData>;
}

type LogID = string;
type CardsData = Record<CardID, CardData>;

export interface CardData {
  s: StatisticsData;
  /** The deck the card belongs to. */
  d: DeckID[];
  /** The review log id. */
  l: LogID[];
  t: CardIDType;
}

export interface StatisticsData {
  /** Due date. ISO 8601. */
  due: string;
  /** stability */
  s: number;
  /** difficulty */
  d: number;
  /** elapsed_days */
  ed: number;
  /** scheduled_days */
  sd: number;
  /** reps */
  r: number;
  /** lapses */
  l: number;
  /** state */
  st: number;
  /** last_review ISO 8601. */
  lr?: string;
}

//#endregion

//#region Cards

export type CardPredicate = (id: FullID, data: CardData) => boolean;

export interface CardIDDataTuple {
  id: FullID;
  data: CardData;
}

export class CardEditor {

  constructor(public readonly id: FullID, public readonly data: CardData) {
  }

  public setDeck(id?: DeckID) {
    console.assert(this.data.d.length <= 1, "Multiple deck parents not implemented.");
    this.data.d = id ? [id] : [];
  }
}

export class CardAlreadyExistsError extends Error {
  constructor(public readonly id: FullID, public readonly existingIDs: FullID[], options?: ErrorOptions) {

    let message = `Could not add card "${id.cardID}"`;
    const e = existingIDs.first()?.noteID;
    if (e)
      message += `, it already exists in "${existingIDs.first()!.noteID}"`;

    super(message, options);
    this.name = "CardAlreadyExistsError";
  }
}

//#endregion

//#region Decks

export type DeckPredicate = (deck: DeckIDDataTuple) => boolean;

export interface DeckIDDataTuple {
  id: DeckID;
  data: DeckData;
}

export interface GetDecksOptions {
  predicate?: DeckPredicate;
}

export class DeckEditor {

  constructor(public readonly id: DeckID, public readonly data: DeckData) {
  }

  public setName(name: string) {
    this.data.n = name;
  }

  public setParent(parentID?: DeckID) {
    console.assert(this.data.p.length <= 1, "Multiple deck parents not implemented.");
    this.data.p = parentID ? [parentID] : [];
  }

  public static getParents(parentID?: DeckID) {
    return parentID ? [parentID] : [];
  }

  public static parent(data: DeckData) {
    console.assert(data.p.length <= 1, "Multiple deck parents not implemented.");
    return data.p.first();
  }
};

//#endregion

//#region Internal

const enum CardIDType {
  UNIQUE = 0,
  NOTE_SCOPED = 1,
};

//#endregion

export class DataStore {

  public static readonly DEFAULT_DATA: DataStoreRoot = {
    decks: {},
    active: {},
    archived: {},
    removed: {}
  };

  public constructor(
    private readonly data: DataStoreRoot,
    private readonly saveData: (data: DataStoreRoot) => Promise<void>) {
  }

  public cardInfo(id: FullID) {
    let info = `${id.isFrontSide ? "front" : "back"} of ${id.cardID}`

    const card = this.getCard(id);
    if (!card || !id.isFrontSide)
      return info;

    info += `\n  State: ${card.s.st}`;
    info += `\n  Due: ${new Date(Date.parse(card.s.due)).toDateString()}`;

    return info;
  }

  //#region Decks

  public createDeck(cb: (editor: DeckEditor) => any): DeckIDDataTuple {

    const editor = new DeckEditor(UniqueID.generateID(), {
      n: "",
      p: [],
    });

    cb(editor)
    this.data.decks[editor.id] = editor.data;
    this.setDataDirty();
    return { id: editor.id, data: editor.data };
  }

  public editCard(id: FullID, cb: (editor: CardEditor) => boolean) {
    const data = this.getCard(id, true);
    if (data && cb(new CardEditor(id, data)))
      this.setDataDirty();
  }

  public editDeck(id: DeckID, cb: (editor: DeckEditor) => boolean) {
    const data = this.getDeck(id, true);
    if (data && cb(new DeckEditor(id, data)))
      this.setDataDirty();
  }

  public getDeck(id: DeckID, throwIfNotFound = false): DeckData | null {
    const data = this.data.decks[id] ?? null;
    if (data === null && throwIfNotFound)
      throw new Error(`Deck with ID "${id}" was not found.`);
    return data;
  }

  public deleteDeck(idToDelete: DeckID, moveChildrenToID?: DeckID, throwIfNotFound = false) {
    const data = this.getDeck(idToDelete, throwIfNotFound);
    if (!data)
      return null;

    // Move cards to another deck or dissociate card with deck.
    for (const tuple of this.getAllCards((_, data) => DataStore.Predicate.isCardInDeck(idToDelete, data))) {
      this.editCard(tuple.id, (editor) => {
        editor.setDeck(moveChildrenToID);
        return true;
      });
    }

    // Remove deck as a parent on subdecks.
    this.getAllDecks({
      predicate: (deck) => DataStore.Predicate.isParentDeck(deck, idToDelete),
    }).forEach(childDeck => {
      this.editDeck(childDeck.id, editor => {
        editor.setParent(undefined);
        return true;
      });
    });

    delete this.data.decks[idToDelete];
    this.setDataDirty();

    return data;
  }

  public getAllDecks(options?: GetDecksOptions) {
    const {
      predicate,
    } = options || {};

    const decks: DeckIDDataTuple[] = [];

    for (const id of Object.keys(this.data.decks)) {
      const deck = { id: id, data: this.data.decks[id] } satisfies DeckIDDataTuple;
      if (!predicate || predicate(deck))
        decks.push(deck);
    }

    decks.sort(DataStore.Comparer.deckNameAsc);

    return decks;
  }

  //#endregion

  //#region 

  /**
  * Deletes {@link CardData} with {@link id} from {@link DataStoreRoot.removed} and returns it.
  * @param id 
  * @param throwIfNotFound
  * @returns The removed {@link CardData}, or `null` if {@link id} was not found.
  */
  private deleteRemovedCard(id: FullID, throwIfNotFound = false) {
    const removedCard = this.getRemovedCard(id, throwIfNotFound);
    if (!removedCard)
      return null;

    const removedNoteData = this.getRemovedNote(id.noteID, throwIfNotFound)!;
    console.assert(removedNoteData);
    delete removedNoteData.cs[id.cardIDOrThrow()];
    this.setDataDirty();

    if (StatisticsHelper.isRemovedNoteEmpty(removedNoteData))
      this.deleteRemovedNote(id.noteID, throwIfNotFound);

    return removedCard;
  }

  public deleteAllRemovedCards(removedBeforeDate?: Date) {
    if (removedBeforeDate) {
      for (const noteID of Object.keys(this.data.removed)) {
        for (const [cardID, cardData] of Object.entries(this.data.removed[noteID].cs))
          if (cardData.date.getTime() < removedBeforeDate.getTime())
            this.deleteRemovedCard(StatisticsHelper.createFullID(noteID, cardID));
      }
    }
    else {
      this.data.removed = { ...DataStore.DEFAULT_DATA.removed };
      this.setDataDirty();
    }
  }

  /**
   * First checks if the card already exists but is marked for removal. If so, adds it back as active.
   * If not found, creates a new active card.
   * @param id 
   * @param statisticsFactory 
   * @param throwIfExists If card already exist as active.
   */
  private ensureActiveCard(id: FullID, statisticsFactory: () => StatisticsData, throwIfExists = false) {

    const removedCard = this.getAllRemovedCards(
      undefined, //(noteID, _) => id.hasNoteID(noteID),
      (cardID, _) => id.hasCardID(cardID) // For unique IDs. They can be in different notes. Just match on the hash.
    ).first();

    this.createActiveNote(id, false);
    let cardToAdd: CardIDDataTuple;

    if (removedCard) {
      this.deleteRemovedCard(removedCard.id, true);
      cardToAdd = StatisticsHelper.toCardIDDataTuple(id, removedCard.data);
    }
    else {
      cardToAdd = StatisticsHelper.toCardIDDataTuple(
        id,
        StatisticsHelper.createCardData(CardIDType.UNIQUE, statisticsFactory())
      );
    }

    return this.addAsActiveCard(cardToAdd, throwIfExists);
  }

  /**
   * @param card 
   * @param throwIfExists 
   * @returns The created card or `null` if already existed.
   */
  private addAsActiveCard(card: CardIDDataTuple, throwIfExists = false) {
    if (!card.id.noteID || !card.id.cardID)
      throw new Error(`Invalid ID: ${card.id}`);

    // Unique IDs can reside in any note.
    if (card.data.t == CardIDType.UNIQUE) {
      // Expected to be max one
      const existingCards = this.getAllCards((cardID) => card.id.hasCardID(cardID));
      if (existingCards.length > 0) {
        if (throwIfExists)
          throw new CardAlreadyExistsError(card.id, existingCards.map(t => t.id));
        else
          return null;
      }
    }
    else {
      // Card ID is unique per note.
      const noteToCheck = this.getNote(card.id.noteID, false);
      if (noteToCheck && Object.prototype.hasOwnProperty.call(noteToCheck.cs, card.id.cardID)) {
        if (throwIfExists)
          throw new CardAlreadyExistsError(card.id, [card.id]);
        else
          return null;
      }
    }

    const noteToAddTo = this.ensureActiveNote(card.id);
    noteToAddTo.cs[card.id.cardID] = card.data;
    this.setDataDirty();

    return card.data;
  }

  /**
   * Returns existing {@link NoteData} from {@link DataStoreRoot.active} or creates and returns a new one if not found.
   * 
   * @param id 
   * @returns Returns the note, whether it was created or not.
   */
  private ensureActiveNote(id: FullID) {
    return this.createActiveNote(id, false) ?? this.getNote(id.noteID, true)!;
  }

  /**
  * Returns existing {@link RemovedNoteData} from {@link DataStoreRoot.removed} or creates and returns a new one if not found.
  */
  private ensureRemovedNote(noteID: NoteID) {
    let note = this.getRemovedNote(noteID);
    if (!note) {
      note = StatisticsHelper.createRemovedNoteData();
      this.data.removed[noteID] = note;
      this.setDataDirty();
    }
    return note;
  }

  /**   
   * @param id 
   * @param throwIfExists 
   * @returns The created note or `null` if already existed.
   */
  private createActiveNote(id: FullID, throwIfExists = false): NoteData | null {
    if (!id.noteID)
      throw new Error(`Invalid ID: ${id}`);

    if (this.getNote(id.noteID, false)) {
      if (throwIfExists)
        throw new Error(`Note ${id.noteID} already exists.`);
      else
        return null;
    }
    else {
      const newNote = StatisticsHelper.createNoteData();
      this.data.active[id.noteID] = newNote;
      this.setDataDirty();
      return newNote;
    }
  }

  //#endregion

  //#region Remove

  public removeNote(noteID: NoteID) {
    return this.moveActiveNoteToRemoved(noteID);
  }

  public async removeAllCards() {
    for (const noteID of Object.keys(this.data.active)) {
      for (const cardID of Object.keys(this.data.active[noteID].cs))
        this.moveActiveCardToRemoved(StatisticsHelper.createFullID(noteID, cardID));
    }
  }

  private moveActiveCardToRemoved(id: FullID, throwIfNotFound = false) {
    const card = this.deleteActiveCard(id, throwIfNotFound);
    if (!card)
      return false;

    const removedNote = this.ensureRemovedNote(id.noteID);
    removedNote.cs[id.cardIDOrThrow()] = StatisticsHelper.cardToRemovedCard(card);
    this.setDataDirty();
    return true;
  }

  private moveActiveNoteToRemoved(noteID: NoteID, throwIfNotFound = false) {
    const note = this.deleteActiveNote(noteID, throwIfNotFound);
    if (!note)
      return false;

    if (this.getRemovedNote(noteID, false) !== null)
      throw new Error(`Note ${noteID} already removed`);

    this.data.removed[noteID] = StatisticsHelper.noteToRemovedNote(note);
    this.setDataDirty();
    return true;
  }

  /**
   * Deletes {@link CardData} with {@link id} from {@link DataStoreRoot.active} and returns it.
   * 
   * @param id 
   * @returns The removed {@link CardData}, or `null` if {@link id} was not found.
   */
  private deleteActiveCard(id: FullID, throwIfNotFound = false) {
    id.throwIfNoCardID();

    const note = this.getNote(id.noteID, throwIfNotFound);
    let card: CardData | null = null;

    if (note && Object.prototype.hasOwnProperty.call(note.cs, id.cardID)) {
      card = note.cs[id.cardID]
      delete note.cs[id.cardID];
      if (StatisticsHelper.isNoteEmpty(note))
        this.deleteActiveNote(id.noteID);
      this.setDataDirty();
    }

    return card;
  }

  /**
   * Deletes {@link NoteData} with {@link noteID} from {@link DataStoreRoot.active} and returns it.
   * @param noteID 
   * @returns The removed {@link NoteData}, or `null` if {@link noteID} was not found.
   */
  private deleteActiveNote(noteID: NoteID, throwIfNotFound = false) {
    const note = this.getNote(noteID, throwIfNotFound);
    if (note) {
      delete this.data.active[noteID];
      this.setDataDirty();
    }
    return note;
  }

  /**
   * Deletes {@link NoteData} with {@link noteID} from {@link DataStoreRoot.removed} and returns it.
   * @param noteID 
   * @returns The removed {@link NoteData}, or `null` if {@link noteID} was not found.
   */
  private deleteRemovedNote(noteID: NoteID, throwIfNotFound = false) {
    const note = this.getRemovedNote(noteID, throwIfNotFound);
    if (note) {
      delete this.data.removed[noteID];
      this.setDataDirty();
    }
    return note;
  }

  //#endregion

  //#region Get

  public getCard(id: FullID, throwIfNotFound = false) {
    id.throwIfNoCardID();
    const data = this.getNote(id.noteID, throwIfNotFound)?.cs[id.cardID] ?? null;
    if (data === null && throwIfNotFound)
      throw new Error(`Card ${id} was not found.`);
    return data;
  }

  public getNote(noteID: NoteID, throwIfNotFound = false): NoteData | null {
    const note = this.data.active[noteID] ?? null;
    if (note === null && throwIfNotFound)
      throw new Error(`Note with ID "${noteID}" was not found.`);
    return note;
  }

  private getRemovedNote(noteID: NoteID, throwIfNotFound = false): RemovedNoteData | null {
    const note = this.data.removed[noteID] ?? null;
    if (note === null && throwIfNotFound)
      throw new Error(`Removed note with ID "${noteID}" was not found.`);
    return note;
  }

  private getRemovedCard(id: FullID, throwIfNotFound = false): RemovedCardData | null {
    const note = this.getRemovedNote(id.noteID, throwIfNotFound);
    if (!note)
      return null;

    const card = note.cs[id.cardIDOrThrow()] ?? null;
    if (card === null && throwIfNotFound)
      throw new Error(`Removed card with ID "${id}" was not found.`);
    return card;
  }

  /**
   * Returns cards belonging to either {@link deckID} or any of its child decks.
   * @param deckID If `undefined`, all cards are returned.
   * @returns 
   */
  public getAllCardsForDeck(deckID?: DeckID): CardIDDataTuple[] {    
    if (!deckID)
      return this.getAllCards();

    const data = this.getDeck(deckID, true);
    if (!data)
      return [];
    
    let cards = this.getAllCards((_, cardData) => DataStore.Predicate.isCardInDeck(deckID, cardData));
    for (const descendantDeck of this.descendantDecks(deckID)) {      
      cards = [...cards, ...this.getAllCards((_, cardData) => DataStore.Predicate.isCardInDeck(descendantDeck.id, cardData))];
    }
    
    return cards;
  }

  private descendantDecks(parentID?: DeckID): DeckIDDataTuple[] {
    if (!parentID)
      return [];

    const childDecks = this.getAllDecks({
      predicate: (deck) => DataStore.Predicate.isParentDeck(deck, parentID),
    });

    let cards: DeckIDDataTuple[] = [];
    for (const childDeck of childDecks) {
      cards.push(childDeck);
      cards = [...cards, ...this.descendantDecks(childDeck.id)];
    }
    return cards;
  }

  public getAllCards(cardFilter?: (cardID: CardID, data: CardData) => boolean): CardIDDataTuple[] {
    return this.getAllCardsWithFilters(undefined, cardFilter);
  }

  private getAllCardsWithFilters(
    noteFilter?: (noteID: NoteID, data: NoteData) => boolean,
    cardFilter?: (cardID: CardID, data: CardData) => boolean): CardIDDataTuple[] {

    let cards: CardIDDataTuple[] = [];

    for (const [noteID, note] of Object.entries(this.data.active)) {
      if (noteFilter && noteFilter(noteID, note) === false)
        continue;

      for (const [cardID, cardData] of Object.entries(note.cs)) {
        if (cardFilter && cardFilter(cardID, cardData) === false)
          continue;
        cards.push(StatisticsHelper.toCardIDDataTuple(StatisticsHelper.createFullID(noteID, cardID), cardData));
      }
    }
    return cards;
  }

  public getAllNotes(noteFilter?: (noteID: NoteID, data: NoteData) => boolean): NoteID[] {
    if (!noteFilter)
      return Object.keys(this.data.active).map(k => asNoteID(k));
    throw new Error("Not Implemented");
  }

  private getAllRemovedCards(
    noteFilter?: (noteID: NoteID, data: RemovedNoteData) => boolean,
    cardFilter?: (cardID: CardID, data: RemovedCardData) => boolean) {

    let cards: CardIDDataTuple[] = [];

    for (const [noteID, removedData] of Object.entries(this.data.removed)) {

      if (noteFilter && noteFilter(noteID, removedData) === false)
        continue;

      for (const [cardID, card] of Object.entries(removedData.cs)) {

        if (cardFilter && cardFilter(cardID, card) === false)
          continue;

        cards.push({
          id: FullID.create(noteID, cardID, true), // back sides are not stored
          data: StatisticsHelper.removedCardToCard(card),
        });
      }
    }
    return cards;
  }

  //#endregion

  //#region  Sync

  /**
   * 
   * @param oldID 
   * @param newID 
   * @param throwIfNotFound If set, will throw if {@link oldID} doesn't exist.
   * @returns `true` if the ID was changed successfully.
   */
  public changeNoteID(oldID: NoteID, newID: NoteID, throwIfNotFound = false) {

    if (this.getNote(newID))
      throw new Error(`Cannot overwrite ${newID}.`)

    const deletedNote = this.deleteActiveNote(oldID, throwIfNotFound);
    if (deletedNote) {
      this.data.active[newID] = deletedNote;
      this.setDataDirty();
    }

    return deletedNote !== null;
  }

  /**
   * 
   * @param latestIDs All up-to-date front side {@link FullID | IDs} from note with {@link inNoteID}. 
   *                  {@link FullID.cardSide} must be defined. Back sides will be ignored if passed.
   * @param inNoteID Needed in case {@link latestIDs} is empty.
   * @param statisticsFactory 
   */
  public syncData(latestIDs: FullID[], inNoteID: NoteID, statisticsFactory: () => StatisticsData) {

    const currentIDs = this
      .getAllCardsWithFilters((noteID) => noteID === inNoteID) // Only look at the relevant note.
      .map(tuple => tuple.id);

    const removedIDs: FullID[] = [];
    const addedIDs: FullID[] = [];

    const currentSet = new Set(currentIDs.map(str => str.toStringWithoutSide()));
    const latestSet = new Set(latestIDs.filter(id => id.isFrontSide).map(str => str.toStringWithoutSide()));

    // Find deleted values
    for (const currentID of currentIDs) {
      if (!latestSet.has(currentID.toStringWithoutSide())) {
        removedIDs.push(currentID);
        this.moveActiveCardToRemoved(currentID);
      }
    }

    // Find new values
    for (const latestID of latestIDs) {
      if (!latestID.isFrontSide)
        continue;

      if (!currentSet.has(latestID.toStringWithoutSide())) {
        addedIDs.push(latestID);
        this.ensureActiveCard(latestID, statisticsFactory, true); // This shouldn't throw since already determined that the card doesn't exist.
      }
    }

    return { addedIDs, removedIDs };
  }

  //#endregion

  //#region Save

  public async save() {
    if (this._isDataDirty) {
      await this.saveData(this.data);
      this._isDataDirty = false;
    }
  }

  private setDataDirty() {
    this._isDataDirty = true;
  }
  private _isDataDirty = false;

  //#endregion

  //#region 

  public readonly filter = {
    cardsWithoutDeck: (card: CardIDDataTuple) => DataStore.Predicate.cardsInDeck(undefined)(card.id, card.data),    
    cardsInDeck: (deckId: DeckID, card: CardIDDataTuple) => DataStore.Predicate.cardsInDeck(deckId)(card.id, card.data),
  };

  private static Predicate = class {

    /**
     * Will only return the cards in the specified {@link deckID}, i.e.,
     * cards in any subdecks will not be included.
     */
    public static cardsInDeck(deckID?: DeckID): CardPredicate {
      return (_, data) => this.isCardInDeck(deckID, data);
    };

    public static isParentDeck(deck: DeckIDDataTuple, parentID: DeckID): boolean {
      return deck.data.p.includes(parentID);
    }

    public static hasParentDeck(deck: DeckIDDataTuple): boolean {
      return deck.data.p.length > 0;
    }

    /**     
     * @param deckID The {@link DeckID} or `undefined` for cards that are not associated with any deck.
     * @param data 
     * @returns `true` if {@link data} contains a deck reference to {@link deckID} or if {@link deckID} is `undefined` and there are no deck references.
     */
    public static isCardInDeck(deckID: DeckID | undefined, data: CardData) {
      console.assert(deckID === undefined || UniqueID.isValid(deckID));
      return deckID ? data.d.includes(deckID) : data.d.length == 0;
    }
  };

  private static Comparer = class {
    public static deckNameAsc(a: DeckIDDataTuple, b: DeckIDDataTuple) {
      return a.data.n.localeCompare(b.data.n)
    }
  }

  //#endregion
}

class StatisticsHelper {

  public static isNoteEmpty(note: NoteData) {
    return Object.keys(note.cs).length == 0;
  }

  public static isRemovedNoteEmpty(note: RemovedNoteData) {
    return Object.keys(note.cs).length == 0;
  }

  public static createFullID(noteID: NoteID, cardID: CardID) {
    return FullID.create(noteID, cardID, true); // back sides are not stored
  }

  public static createCardData(type: CardIDType, statistics: StatisticsData) {
    return {
      l: [],
      d: [],
      s: statistics,
      t: type,
    } satisfies CardData;
  }

  public static createNoteData() {
    return {
      cs: {}
    } satisfies NoteData;
  }

  public static createRemovedNoteData(): RemovedNoteData {
    return {
      cs: {}
    } satisfies RemovedNoteData;
  }

  public static removedCardToCard(removedCard: RemovedCardData): CardData {
    const {
      date,
      ...cardData } = removedCard;
    return cardData;
  }

  public static cardToRemovedCard(card: CardData, removalDate?: Date): RemovedCardData {
    return {
      ...card,
      date: removalDate ?? new Date(),
    } satisfies RemovedCardData;
  }

  public static noteToRemovedNote(note: NoteData, removalDate?: Date): RemovedNoteData {

    const date = removalDate ?? new Date();
    const removedNote = this.createRemovedNoteData();
    for (const [cardID, data] of Object.entries(note.cs)) {
      removedNote.cs[cardID] = this.cardToRemovedCard(data, date);
    }

    return removedNote;
  }

  public static toCardIDDataTuple(id: FullID, data: CardData): CardIDDataTuple {
    return {
      id,
      data
    } satisfies CardIDDataTuple;
  }
}