import { CardID, FullID, NoteID, DeckID, DeckableFullID } from "FullID";
import { asNoteID } from "TypeAssistant";
import { UniqueID } from "UniqueID";

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
	/** The decks the card belongs to. */
	d: DeckID[];
	/** The review log id. */
	l: LogID[];
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

	public setDecks(ids: DeckID[]) {
		this.data.d = ids;
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

		const decks: DeckData[] = [];
		for (const deckID of card.d) {
			const deckData = this.getDeck(deckID);
			console.assert(deckData);
			if (deckData)
				decks.push(deckData);
		}
		if (decks.length > 0)
			info += `\n  Decks: ${decks.map(data => data.n).join(", ")}`;

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
			const deckIDs = id instanceof DeckableFullID ? id.deckIDs : [];
			cardToAdd = StatisticsHelper.toCardIDDataTuple(
				id,
				StatisticsHelper.createCardData(deckIDs, statisticsFactory())
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

		if (this.getCard(card.id, false) !== null) {
			if (throwIfExists)
				throw new CardAlreadyExistsError(card.id, []);
			else
				return null;
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
		id.throwIfNoNoteID()

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

		this.data.removed[noteID] = StatisticsHelper.noteToRemovedNote(note);
		this.setDataDirty();
		return true;
	}

	/**
	 * Deletes {@link CardData} with {@link id} from {@link DataStoreRoot.active|active} and returns it.
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
		id.throwIfNoNoteID();
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

	/**
	 * Note that if this method returns a non-null value, a note with the same {@link NoteID}
	 * may still exist as active if it contains active cards. In other words, if a note contains
	 * both active and removed cards, its {@link NoteID} will exist in both places.
	 *
	 * @param noteID
	 * @param throwIfNotFound
	 * @returns
	 */
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

		// Latest data
		const latestSet = new Set(latestIDs.filter(id => id.isFrontSide).map(id => {
			console.assert(id.hasNoteID(inNoteID));
			return id.cardID;
		}));

		// Current data
		const noteData = this.getNote(inNoteID, false); // This will return null if this method was called for a note with only back side IDs, in which case it is treated as empty of items.
		const currentCardIDs = noteData ? Object.keys(noteData.cs) : [];
		const currentIDs = currentCardIDs.map(cardID => StatisticsHelper.createFullID(inNoteID, cardID));
		const currentSet = new Set(currentCardIDs);

		//
		const removedIDs: FullID[] = [];
		const addedIDs: FullID[] = [];
		const modifiedIDs: FullID[] = [];

		// Find deleted items
		for (const currentID of currentIDs) {
			if (!latestSet.has(currentID.cardID)) {
				removedIDs.push(currentID);
				this.moveActiveCardToRemoved(currentID);
			}
		}

		// Find new and modified items
		for (const latestID of latestIDs) {
			console.assert(latestID.isFrontSide);
			if (!latestID.isFrontSide)
				continue;

			// New item
			if (!currentSet.has(latestID.cardID)) {
				addedIDs.push(latestID);
				this.ensureActiveCard(latestID, statisticsFactory, true);
			}
			// Neither new item nor removed
			else if (noteData) {

				const currentDeckIDs = noteData.cs[latestID.cardID].d;
				let newDeckIDs: DeckID[] | undefined;

				if (latestID instanceof DeckableFullID) {
					// Only update decks if changed
					if (!latestID.isDecksEqual(currentDeckIDs))
						newDeckIDs = latestID.deckIDs.filter(deckID => this.getDeck(deckID)); // Filter non-existing IDs
				}
				else {
					newDeckIDs = [];
				}

				if (newDeckIDs) {
					this.editCard(latestID, (editor) => {
						editor.setDecks(newDeckIDs);
						modifiedIDs.push(latestID);
						return true;
					});
				}
			}
		}

		return { addedIDs, removedIDs, modifiedIDs };
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
			return (_, data) => DataStore.Predicate.isCardInDeck(deckID, data);
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

	public static createCardData(decks: DeckID[], statistics: StatisticsData) {
		return {
			l: [],
			d: decks,
			s: statistics,
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
