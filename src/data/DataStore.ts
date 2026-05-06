import { CardID, DeckID, DeckableFullID, FullID, NoteID } from "#/data/FullID";
import { UniqueID } from "#/data/UniqueID";
import { Env } from "#/env";
import { asNoteID, isDate, isString } from "#/TypeAssistant";
import { DateTime } from "#/utils/datetime";
import { UnexpectedUndefinedError } from "#/utils/errors";
import { Arr, Null, Obj, St, Str } from "#/utils/ts";
import { deepEqual, strictDeepEqual } from "fast-equals";

export interface DataStoreRoot {
	decks: DecksData;
	active: NotesData;
	removed: RemovedData;
}

type DecksData = Record<DeckID, DeckData>;

export interface DeckData {
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
/** Serves as a reminder that dates are read and stored as ISO strings. */
type IsoDateString = string;
/** Make sure dates are never of `undefined` type. */
type OptionalIsoDateString = IsoDateString | null;

interface RemovedCardData extends CardData {
	/** Date marked for removal. */
	date: IsoDateString;
}

interface RemovedNoteData {
	cs: Record<CardID, RemovedCardData>;
}
/** Shallow type validation. */
const isRemovedNoteData = (value: unknown): value is RemovedNoteData => Obj.is(value) && "cs" in value;

type LogID = string;
type CardsData = Record<CardID, CardData>;

export interface CardData {
	s: StatisticsData;
	/** The decks the card belongs to. */
	d: DeckID[];
	/** The review log id. */
	l: LogID[];
	/**
		* Created date.
		* @since 0.6.0 Make sure to call {@link validateCardData} before use.
		*/
	c: OptionalIsoDateString,
}
/** Shallow type validation. */
const isCardData = (value: unknown): value is CardData => Obj.is(value) && "s" in value && "d" in value;
/** Checks for undefined values, which can happen if values weren't deserialized. */
const validateCardData = (value: CardData) => {
	if (!Str.is(value.c))
		value.c = null;
};

export interface StatisticsData {
	/** Due date. ISO 8601. */
	due: IsoDateString;
	/** stability */
	s: number;
	/** difficulty */
	d: number;
	/**
		* `scheduled_days`
		*
		* The {@link due | due date} minus {@link lr | last review date} in days.
		*/
	sd: number;

	/**
		* `learning_steps`
		*/
	ls: number;

	/**
		* `reps`
		*/
	r: number;

	/**
		* `lapses`
		*
		* Incremented by one if, and only if, rated *Again*, which tells the algorithm that the review failed, forcing the card back into the (re)learning phase.
		*
		* - The `lapses` counter is incremented by exactly one every time a card is rated *Again*. The only exceptions are administrative functions:
		* 	- `rollback()` can decrease the count if an 'Again' rating is undone.
		* 	- `forget()` can reset the count to zero.
		*/
	l: number;

	/**
		* `state`
		*
		* - **New**: The card has been created but has not been studied yet.
		* - **Learning**: The card is being learned for the first time. It will typically be shown in short intervals.
		* - **Review**: The card has been successfully learned and is now in the long-term review cycle to maintain memory retention.
		* - **Relearning**: The card was previously in the 'Review' state but was forgotten (rated 'Again'). It must be learned again before returning to the long-term review cycle.
		*/
	st: number;

	/**
		* `last_review`
		*
		* The date of the last rating, or `null` if never rated.
		*
		* - ISO 8601 format.
		* - Note that if statistics is set to `forget`, state resets to New but `last_review` is not changed.
		*/
	lr: OptionalIsoDateString;
}

export type CardPredicate = (id: FullID, data: CardData) => boolean;

export interface CardIDDataTuple {
	id: FullID;
	data: CardData;
}

interface RemovedCardIDDataTuple {
	id: FullID;
	data: RemovedCardData;
}

export class CardEditor {

	constructor(public readonly id: FullID, public readonly data: CardData) {
	}

	public setDeck(id?: DeckID) {
		Env.assert(this.data.d.length <= 1, "Multiple deck parents not implemented.");
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

	/**
	 * @param parentID Set to `null` to remove all parents.
	 */
	public setParent(parentID: DeckID | null) {
		Env.assert(this.data.p.length <= 1, "Multiple deck parents not implemented.");
		this.data.p = parentID !== null ? [parentID] : [];
	}

	public static parent(data: DeckData) {
		Env.assert(data.p.length <= 1, "Multiple deck parents not implemented.");
		return data.p.first() ?? null;
	}
};

/** Use with {@link DataStore.registerOnChangedCallback} */
export type DataChanged = (data: DataStoreRoot) => Promise<void> | void;

type DataSection = Exclude<keyof DataStoreRoot, "decks"> | "all";
/** See {@link DataStore.Internal.dispatchSection}. */
type SectionActions<R> = { [K in DataSection]: () => R; };

export class DataStore {

	public static readonly DEFAULT_DATA: DataStoreRoot = {
		decks: {},
		active: {},
		removed: {}
	};

	private data: DataStoreRoot;
	private readonly saveData: (data: DataStoreRoot) => Promise<void>;
	/** The minimum number of seconds items will retained as removed items before they are deleted. */
	private purgeThreshold: number;

	public constructor(data: DataStoreRoot, purgeThreshold: number, saveData: (data: DataStoreRoot) => Promise<void>) {
		this.data = data;
		this.purgeThreshold = purgeThreshold;
		this.saveData = saveData;
	}

	public cardInfo(id: FullID) {
		Env.log.data("DataStore:cardInfo: id", id);

		let info = `${id.isFrontSide ? "front" : "back"} of ${id.cardID}`

		const card = this.getCard(id);
		if (!card || !id.isFrontSide)
			return info;

		info += `\n  State: ${card.s.st}`;
		info += `\n  Due: ${new Date(Date.parse(card.s.due)).toDateString()}`;

		const decks: DeckData[] = [];
		for (const deckID of card.d) {
			const deckData = this.getDeck(deckID);
			Env.assert(deckData !== null);
			if (deckData !== null)
				decks.push(deckData);
		}
		if (decks.length > 0)
			info += `\n  Decks: ${decks.map(data => data.n).join(", ")}`;

		return info;
	}

	/**
		* @param cb Return value is ignored.
		*/
	public createDeck(cb: (editor: DeckEditor) => unknown): DeckIDDataTuple {
		Env.log.data("DataStore:createDeck");
		const editor = new DeckEditor(UniqueID.generateID(), {
			n: "",
			p: [],
		});

		cb(editor);
		this.data.decks[editor.id] = editor.data;
		this.setDataDirty();
		return { id: editor.id, data: editor.data };
	}

	public editCard(id: FullID, cb: (editor: CardEditor) => boolean) {
		Env.log.data("DataStore:editCard: id", id);
		const data = this.getCard(id, true);
		if (data && cb(new CardEditor(id, data)))
			this.setDataDirty();
	}

	/**
		* @returns `null` if {@link id} was not found and {@link cb} was not called. If the {@link id} was found, the {@link DeckData} is returned regardless of whether {@link cb} was called.
		*/
	public editDeck(id: DeckID, cb: (editor: DeckEditor) => boolean, throwIfNotFound = false): DeckData | null {
		Env.log.data("DataStore:editDeck: id", id);
		const data = this.getDeck(id, throwIfNotFound);
		if (data !== null && cb(new DeckEditor(id, data)))
			this.setDataDirty();
		return data;
	}

	public getDeck(id: DeckID, throwIfNotFound = false): DeckData | null {
		Env.log.data("DataStore:getDeck: id", id);
		const data = Null.fromUndefined(this.data.decks[id]);
		if (data === null && throwIfNotFound)
			throw new Error(`Deck with ID "${id}" was not found.`);
		return data;
	}

	public deleteDeck(idToDelete: DeckID, moveChildrenToID?: DeckID, throwIfNotFound = false) {
		Env.log.data("DataStore:deleteDeck: idToDelete", idToDelete, "moveChildrenToID", moveChildrenToID);
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
				editor.setParent(null);
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
		Env.log.data("DataStore:getAllDecks: predicate", predicate);
		const decks: DeckIDDataTuple[] = [];

		for (const [id, data] of Object.entries(this.data.decks)) {
			const deck = { id: id, data: data } satisfies DeckIDDataTuple;
			if (!predicate || predicate(deck))
				decks.push(deck);
		}

		decks.sort(DataStore.Comparer.deckNameAsc);

		return decks;
	}

	/**
	* Deletes {@link CardData} with {@link id} from {@link DataStoreRoot.removed} and returns it.
	*
	* Also removes its parent if it no longer has any children. Thus there is no need to call {@link deleteRemovedNote}
	*
	* @param id
	* @param throwIfNotFound
	* @returns The removed {@link CardData}, or `null` if {@link id} was not found.
	*/
	private deleteRemovedCard(id: FullID, throwIfNotFound = false) {
		Env.log.data("DataStore:deleteRemovedCard: id", id);
		const removedCard = this.getRemovedCard(id, throwIfNotFound);
		if (!removedCard)
			return null;

		const removedNoteData = this.getRemovedNote(id.noteID, throwIfNotFound);
		Env.assert(removedNoteData !== null);
		if (removedNoteData === null)
			return null;

		delete removedNoteData.cs[id.cardIDOrThrow()];
		this.setDataDirty();

		if (StatisticsHelper.isRemovedNoteEmpty(removedNoteData))
			this.deleteNote("removed", id.noteID, throwIfNotFound);

		return removedCard;
	}

	/**
	 * @param removedBeforeDate Delete only items that were removed before this date. Set to `undefined` to delete all items.
	 */
	private deleteRemovedCards(removedBeforeDate?: Date) {
		Env.log.data("DataStore:deleteRemovedCards: removedBeforeDate", removedBeforeDate);
		if (removedBeforeDate !== undefined) {
			const time = removedBeforeDate.getTime();
			this.getAllRemovedCards(undefined, (_cardID: CardID, data: RemovedCardData) => {
				const date = StatisticsHelper.ensureDate(data.date);
				Env.dev?.assert(date !== null, "Expected date parsable string.");
				return date && date.getTime() < time ? true : false;
			}).forEach(tuple => this.deleteRemovedCard(tuple.id));
		}
		else {
			this.data.removed = { ...DataStore.DEFAULT_DATA.removed };
			this.setDataDirty();
		}
	}

	/**
	 * First checks if the card already exists but is marked for deletion. If so, adds it back as active.
	 * If not found, creates a new active card.
	 * @param id
	 * @param statisticsFactory
	 * @param throwIfExists If card already exist as active.
	 */
	private ensureActiveCard(id: FullID, statisticsFactory: () => StatisticsData, throwIfExists = false) {
		Env.log.data("DataStore:ensureActiveCard: id", id);

		// First check if already active in any note.
		// - Prevents dublicates, e.g., it the removal event occurs after the add event.
		const existingActive = Arr.firstOrNull(this.getAllCards((cardID, _) => id.hasCardID(cardID)));
		if (existingActive !== null) {
			if (existingActive.id.hasNoteID(id.noteID)) {
				if (throwIfExists)
					throw new CardAlreadyExistsError(id, [existingActive.id]);
				return existingActive.data;
			}
			return this.moveActiveCard(existingActive.id, id.noteID);
		}

		// Check removed
		const removed = Arr.firstOrNull(this.getAllRemovedCards(undefined,
			(cardID, _) => id.hasCardID(cardID) // For unique IDs. They can be in different notes. Just match on the hash.
		));

		this.createActiveNote(id, false);
		let cardToAdd: CardIDDataTuple;

		if (removed !== null) {
			this.deleteRemovedCard(removed.id, true);
			cardToAdd = StatisticsHelper.toCardIDDataTuple(id, StatisticsHelper.removedCardToCard(removed.data));
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
		Env.log.data("DataStore:addAsActiveCard: card", card);
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
		Env.log.data("DataStore:ensureActiveNote: id", id);
		return this.createActiveNote(id, false) ?? this.getNote(id.noteID, true)!;
	}

	/**
	* Returns existing {@link RemovedNoteData} from {@link DataStoreRoot.removed} or creates and returns a new one if not found.
	*/
	private ensureRemovedNote(noteID: NoteID) {
		Env.log.data("DataStore:ensureRemovedNote: noteID", noteID);
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
		Env.log.data("DataStore:createActiveNote: id", id);
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

	public removeNote(noteID: NoteID) {
		Env.log.data("DataStore:removeNote: noteID", noteID);
		return this.moveActiveNoteToRemoved(noteID);
	}

	public async removeAllCards() {
		Env.log.data("DataStore:removeAllCards");
		for (const [noteID, note] of Object.entries(this.data.active)) {
			for (const cardID of Object.keys(note.cs))
				this.moveActiveCardToRemoved(StatisticsHelper.createFullID(noteID, cardID));
		}
	}

	/**
		* Move an active {@link CardData} to another note.
		* @param id Item to move.
		* @param toNoteID Target to move to.
		* @param throwIfNotFound If set to `true`, throws an error if the card is not found in {@link id} or already exists in {@link toNoteID}.
		* @returns `null` if item cannot be found or already exists in {@link toNoteID}.
		*/
	private moveActiveCard(id: FullID, toNoteID: NoteID, throwIfNotFound = false) {
		Env.log.data("DataStore:moveActiveCard: id", id, "toNoteID", toNoteID);

		const card = this.deleteActiveCard(id, throwIfNotFound);
		if (card === null)
			return null;

		const newID = FullID.create(toNoteID, id.cardIDOrThrow(), id.isFrontSide);
		return this.addAsActiveCard({ id: newID, data: card }, throwIfNotFound);
	}

	private moveActiveCardToRemoved(id: FullID, throwIfNotFound = false) {
		Env.log.data("DataStore:moveActiveCardToRemoved: id", id);
		const card = this.deleteActiveCard(id, throwIfNotFound);
		if (card === null)
			return null;

		const removedNote = this.ensureRemovedNote(id.noteID);
		const removedItem = StatisticsHelper.cardToRemovedCard(card);

		removedNote.cs[id.cardIDOrThrow()] = removedItem;
		this.setDataDirty();

		return removedItem;
	}

	private moveActiveNoteToRemoved(noteID: NoteID, throwIfNotFound = false) {
		Env.log.data("DataStore:moveActiveNoteToRemoved: noteID", noteID);
		const note = this.deleteNote("active", noteID, throwIfNotFound);
		if (note === null)
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
		Env.log.data("DataStore:deleteActiveCard: id", id);
		id.throwIfNoCardID();

		const note = this.getNote(id.noteID, throwIfNotFound);
		if (note === null)
			return null;

		const card = note.cs[id.cardID];
		if (card === undefined)
			return null;

		delete note.cs[id.cardID];
		if (StatisticsHelper.isNoteEmpty(note))
			this.deleteNote("active", id.noteID);
		this.setDataDirty();

		return card;
	}

	/**
		* Deletes {@link NoteData} with {@link noteID} from {@link section} and returns it.
		* @param section
		* @param noteID
		* @returns The removed {@link NoteData}, or `null` if {@link noteID} was not found.
		*/
	private deleteNote(section: DataSection, noteID: NoteID, throwIfNotFound = false): NoteData | null {
		Env.log.data(`DataStore:deleteNote: section: ${section}, noteID: ${noteID}`);

		const actions: SectionActions<NoteData | null> = {
			active: () => {
				const n = this.getNote(noteID, section === "active" && throwIfNotFound); // Because `all` calls `active` first.
				if (n !== null)
					delete this.data.active[noteID];
				return n;
			},
			removed: () => {
				const n = this.getRemovedNote(noteID, throwIfNotFound);
				if (n !== null)
					delete this.data.removed[noteID];
				return n;
			},
			all: () => {
				const note = actions.active();
				return note !== null ? note : actions.removed();
			}
		};

		const note = DataStore.Internal.dispatchSection(section, actions);

		if (note !== null)
			this.setDataDirty();

		return note;
	}

	public getCard(id: FullID, throwIfNotFound = false): CardData | null {
		Env.log.data("DataStore:getCard: id", id);
		id.throwIfNoNoteID();
		id.throwIfNoCardID();

		const data = this.getNote(id.noteID, throwIfNotFound)?.cs[id.cardID] ?? null;
		if (data === null && throwIfNotFound)
			throw new Error(`Card ${id.toString()} was not found.`);

		if (data !== null) {
			Env.assert(isCardData(data), "Invalid JSON for id:", id.toString());
			validateCardData(data);
		}

		return data;
	}

	public noteHasItems(noteID: NoteID): boolean {
		const note = this.getNote(noteID);
		return note !== null && Obj.nonEmpty(note.cs);
	}

	public getNote(noteID: NoteID, throwIfNotFound = false): NoteData | null {
		Env.log.data("DataStore:getNote: noteID", noteID);
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
		Env.log.data("DataStore:getRemovedNote: noteID", noteID);
		const note = this.data.removed[noteID] ?? null;
		if (note === null && throwIfNotFound)
			throw new Error(`Removed note with ID "${noteID}" was not found.`);
		return note;
	}

	private getRemovedCard(id: FullID, throwIfNotFound = false): RemovedCardData | null {
		Env.log.data("DataStore:getRemovedCard: id", id);
		const note = this.getRemovedNote(id.noteID, throwIfNotFound);
		if (!note)
			return null;

		const card = note.cs[id.cardIDOrThrow()] ?? null;
		if (card === null && throwIfNotFound)
			throw new Error(`Removed card with ID "${id.toString()}" was not found.`);
		return card;
	}

	/**
	 * Returns all items belonging to any of the specified {@link deckIDs} or any of their child decks.
	 * @param deckIDs
	 * @returns
	 */
	public getAllCardsForDeck(deckIDs: DeckID | ReadonlyArray<DeckID>): CardIDDataTuple[] {
		const rootIDs = Arr.readonlyFrom(deckIDs);
		const targetIDs = new Set<DeckID>();

		for (const id of rootIDs) {
			if (this.getDeck(id) !== null) {
				targetIDs.add(id);
				for (const d of this.descendantDecks(id))
					targetIDs.add(d.id);
			}
		}

		if (St.isEmpty(targetIDs))
			return [];

		return this.getAllCards((_, data) => data.d.some(id => targetIDs.has(id)));
	}

	/**
	 * @param parentID
	 * @param internalCycleGuard Dont pass this parameter directly.
	 * @returns All descendants of {@link parentID}.
	 */
	private descendantDecks(parentID?: DeckID, internalCycleGuard = new Set<DeckID>()): DeckIDDataTuple[] {
		Env.log.data("DataStore:descendantDecks: parentID", parentID);
		if (parentID === undefined)
			return [];

		// Cycle guard: Ex: B is child of A, which is child of B.
		if (internalCycleGuard.has(parentID))
			return [];
		internalCycleGuard.add(parentID);

		const childDecks = this.getAllDecks({
			predicate: (deck) => DataStore.Predicate.isParentDeck(deck, parentID),
		});

		let cards: DeckIDDataTuple[] = [];
		for (const childDeck of childDecks) {
			cards.push(childDeck);
			cards = [...cards, ...this.descendantDecks(childDeck.id, internalCycleGuard)];
		}
		return cards;
	}

	public getAllCards(cardFilter?: (cardID: CardID, data: CardData) => boolean): CardIDDataTuple[] {
		Env.log.data("DataStore:getAllCards");
		return this.getAllCardsWithFilters(undefined, cardFilter);
	}

	private getAllCardsWithFilters(
		noteFilter?: (noteID: NoteID, data: NoteData) => boolean,
		cardFilter?: (cardID: CardID, data: CardData) => boolean): CardIDDataTuple[] {
		Env.log.data("DataStore:getAllCardsWithFilters");
		const cards: CardIDDataTuple[] = [];

		for (const [noteID, note] of Object.entries(this.data.active)) {
			if (noteFilter && noteFilter(noteID, note) === false)
				continue;

			for (const [cardID, cardData] of Object.entries(note.cs)) {
				if (cardFilter && !cardFilter(cardID, cardData))
					continue;
				cards.push(StatisticsHelper.toCardIDDataTuple(StatisticsHelper.createFullID(noteID, cardID), cardData));
			}
		}
		return cards;
	}

	public getAllNotes(noteFilter?: (noteID: NoteID, data: NoteData) => boolean): NoteID[] {
		Env.log.data("DataStore:getAllNotes");
		if (!noteFilter)
			return Object.keys(this.data.active).map(k => asNoteID(k));
		throw new Error("Not Implemented");
	}

	private getAllRemovedCards(
		noteFilter?: (noteID: NoteID, data: RemovedNoteData) => boolean,
		cardFilter?: (cardID: CardID, data: RemovedCardData) => boolean) {
		Env.log.data("DataStore:getAllRemovedCards");
		const cards: RemovedCardIDDataTuple[] = [];

		for (const [noteID, removedData] of Object.entries(this.data.removed)) {

			// The actual json values can contain anything (for example `"removed": { "ad": "s" }`).
			// If, e.g., the value sent to `Object.entries` is `undefined`, it will throw.
			if (Str.isNonEmpty(noteID) && isRemovedNoteData(removedData)) {
				try {
					// Run note filter
					if (noteFilter && noteFilter(noteID, removedData) === false)
						continue;

					for (const [cardID, card] of Object.entries(removedData.cs)) {
						// Run card filter
						if (cardFilter && cardFilter(cardID, card) === false)
							continue;

						cards.push({
							id: FullID.create(noteID, cardID, true), // back sides are not stored
							data: card
						});
					}
				}
				catch (e) {
					Env.log.e(e);
				}
			}
			else {
				Env.log.w("Invalid JSON value: noteID:", noteID, ", removedData:", removedData);
			}
		}

		return cards;
	}

	/**
	 *
	 * @param oldID
	 * @param newID
	 * @param throwIfNotFound If set, will throw if {@link oldID} doesn't exist.
	 * @returns `true` if the ID was changed successfully.
	 */
	public changeNoteID(oldID: NoteID, newID: NoteID, throwIfNotFound = false) {
		Env.log.data("DataStore:changeNoteID: oldID", oldID, "newID", newID);
		if (this.getNote(newID))
			throw new Error(`Cannot overwrite ${newID}.`)

		const deletedNote = this.deleteNote("active", oldID, throwIfNotFound);
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

		Env.dev?.log.d(`DataStore:syncData:\n\tinNoteID: ${inNoteID},\n\tlatestIDs: ${latestIDs.map(id => `${id.cardSide}@${id.cardID}`).join(", ")}`);
		Env.dev?.run(() => latestIDs.forEach(id => Env.assert(id.hasNoteID(inNoteID), `Expected all IDs to belong to ${inNoteID}: ${id.toString()}`)));

		// Latest data
		const latestSet = new Set(latestIDs.filter(id => id.isFrontSide).map(id => {
			Env.assert(id.hasNoteID(inNoteID));
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
			Env.assert(latestID.isFrontSide);
			if (!latestID.isFrontSide)
				continue;

			// New item
			if (!currentSet.has(latestID.cardID)) {
				addedIDs.push(latestID);
				this.ensureActiveCard(latestID, statisticsFactory, true);
			}
			// Neither new item nor removed
			else if (noteData) {

				const currCollectionIDs = noteData.cs[latestID.cardID]?.d;
				if (currCollectionIDs === undefined)
					throw new UnexpectedUndefinedError();

				let newCollectionIDs: DeckID[] | undefined;

				if (latestID instanceof DeckableFullID) {
					// Only update decks if changed
					if (!latestID.isDecksEqual(currCollectionIDs))
						newCollectionIDs = latestID.deckIDs.filter(deckID => this.getDeck(deckID)); // Filter non-existing IDs
				}
				else {
					// The data does not support collections.
					if (currCollectionIDs.length > 0) // Just in case, if there are associated collections, make sure they are removed.
						newCollectionIDs = [];
				}

				if (newCollectionIDs !== undefined) {
					this.editCard(latestID, (editor) => {
						editor.setDecks(newCollectionIDs);
						modifiedIDs.push(latestID);
						return true;
					});
				}
			}
		}

		Env.dev?.log.d(`\taddedIDs: ${addedIDs.map(id => id.toString()).join(", ")}, removedIDs: ${removedIDs.map(id => id.toString()).join(", ")}, modifiedIDs: ${modifiedIDs.map(id => id.toString()).join(", ")}`);

		return { addedIDs, removedIDs, modifiedIDs };
	}

	public async save() {
		Env.log.d("DataStore:save: dirty: ", this._isDataDirty);
		if (this._isDataDirty) {
			const purgeRemovedBeforeDate = new Date((new Date()).getTime() - (this.purgeThreshold * 1000));
			this.deleteRemovedCards(purgeRemovedBeforeDate);
			await this.saveData(this.data);
			this._isDataDirty = false;
			await this.triggerDataChanged();
		}
	}

	private setDataDirty() {
		this._isDataDirty = true;
	}
	private _isDataDirty = false;

	/**
		* Checks whether {@link changedData} differs from the current in-memory data, in which case the {@link changed} callback is called.
		*
		* It is the callers reponsibility to decide whether the current in-memory data should be overwritten with the {@link changedData}
		* by calling the `commit` function passed with the {@link changed} parameter.
		*
		* @param changedData
		* @param changed Called if {@link changedData} is not equal to the current in-memory data. Call `commit` to overwrite the current data with {@link changedData}.
		* @param unchanged Called if {@link changedData} is equal  to the current in-memory data.
		*
		* @returns `true` if the {@link changed} callback was invoked.
		*/
	public onDataChangedExternally(changedData: DataStoreRoot, changed: (info: DataChangedInfo, commit: () => Promise<void>) => void, unchanged?: () => void) {
		const currentData = this.data;
		let isNotEqual = false;

		const info: DataChangedInfo = {
			currentData: currentData,
			changedData: changedData,
			collectionsChanged: !deepEqual(changedData.decks, currentData.decks),
			activeChanged: !deepEqual(changedData.active, currentData.active),
			removedChanged: !deepEqual(changedData.removed, currentData.removed),
		};

		Env.log.d("DataStore:onDataChangedExternally: ", info);

		if (info.collectionsChanged || info.activeChanged || info.removedChanged) {
			isNotEqual = true;
			changed(info, async () => {
				this.data = info.changedData;
				this.setDataDirty();
				await this.triggerDataChanged();
			});
		}
		else {
			Env.dev?.run(() => {
				Env.assert(strictDeepEqual(changedData.decks, currentData.decks), "`collections` are not strictly equal");
				Env.assert(strictDeepEqual(changedData.active, currentData.active), "`active` are not strictly equal");
				Env.assert(strictDeepEqual(changedData.removed, currentData.removed), "`removed` are not strictly equal");
			});

			unchanged?.();
		}

		return isNotEqual;
	}

	/** Get notified when the in-memory data changed. */
	public registerOnChangedCallback(evt: DataChanged) {
		if (!this.registeredChangedCallbacks.includes(evt))
			this.registeredChangedCallbacks.push(evt);
	}

	public unregisterOnChangedCallback(evt: DataChanged) {
		this.registeredChangedCallbacks = this.registeredChangedCallbacks.filter(callback => callback !== evt);
	}

	private async triggerDataChanged() {
		Env.log.data("DataStore:triggerDataChanged", this.registeredChangedCallbacks.length);
		for (const callback of this.registeredChangedCallbacks) {
			try {
				await callback(this.data);
			}
			catch (e) {
				Env.log.e("Error executing data changed callback:", e);
			}
		}
	}
	private registeredChangedCallbacks: DataChanged[] = [];

	private static readonly Internal = {
		dispatchSection: function <R>(section: DataSection, actions: SectionActions<R>): R {
			switch (section) {
				case "active":
					return actions.active();
				case "removed":
					return actions.removed();
				case "all":
					return actions.all();
				default: {
					const _exhaustiveCheck: never = section;
					throw new Error(`DataStore: Unhandled section: ${String(_exhaustiveCheck)}`);
				}
			}
		}
	};

	public readonly item = {

		allInCollection: (id: DeckID | ReadonlyArray<DeckID>) => this.getAllCardsForDeck(id),

		allIDsInSet: (set: ReadonlySet<FullID>, throwIfNotFound = false) => {
			const result: CardIDDataTuple[] = [];
			for (const id of set) {
				const data = this.getCard(id, throwIfNotFound);
				if (data !== null)
					result.push(StatisticsHelper.toCardIDDataTuple(id, data));
			}
			return result;
		},
	};

	public readonly collection = {

		all: (options?: GetDecksOptions) => this.getAllDecks(options),

		/**
		 * @param items Optional list of items to filter. If not provided, all items will be used.
		 * @param omitInvalid `true` to not return items that reference non-existing collection IDs. When `false`, items with at least one existing id will not be returned.
		 * @returns Items that do not belong to any collection.
		 */
		filterNot: (items?: CardIDDataTuple[], omitInvalid = false) =>
			(items !== undefined ? items : this.getAllCards()).filter(card => {
				if (!omitInvalid) {
					const invalid = this.collection.invalidIDs(card.data);
					if (invalid.length > 0) {
						Env.log.w("Item", card.id, "references non-existing collections:", invalid);
						if (invalid.length === card.data.d.length)
							return true;
					}
				}
				return Arr.isEmpty(card.data.d);
			}),

		invalidIDs: (data: CardData) => {
			const invalid: DeckID[] = [];
			for (const cID of data.d) {
				if (this.getDeck(cID) === null)
					invalid.push(cID);
			}
			return invalid;
		},
	};

	public readonly filter = {
		cardsWithoutDeck: (card: CardIDDataTuple) => DataStore.Predicate.cardsInDeck(undefined)(card.id, card.data),
		cardsInDeck: (deckId: DeckID, card: CardIDDataTuple) => DataStore.Predicate.cardsInDeck(deckId)(card.id, card.data),
	};

	private static readonly Predicate = {

		/**
		 * Will only return the cards in the specified {@link deckID}, i.e.,
		 * cards in any subdecks will not be included.
		 */
		cardsInDeck(deckID?: DeckID): CardPredicate {
			return (_, data) => DataStore.Predicate.isCardInDeck(deckID, data);
		},

		isParentDeck(deck: DeckIDDataTuple, parentID: DeckID): boolean {
			return deck.data.p.includes(parentID);
		},

		hasParentDeck(deck: DeckIDDataTuple): boolean {
			return deck.data.p.length > 0;
		},

		/**
		 * @param deckID The {@link DeckID} or `undefined` for cards that are not associated with any deck.
		 * @param data
		 * @returns `true` if {@link data} contains a deck reference to {@link deckID} or if {@link deckID} is `undefined` and there are no deck references.
		 */
		isCardInDeck(deckID: DeckID | undefined, data: CardData) {
			Env.assert(deckID === undefined || UniqueID.isValid(deckID));
			//this.getDeck(deckID)
			return deckID ? data.d.includes(deckID) : data.d.length == 0;
		},
	};

	private static readonly Comparer = {
		deckNameAsc(this: void, a: DeckIDDataTuple, b: DeckIDDataTuple) {
			return a.data.n.localeCompare(b.data.n)
		}
	};
}

/** See {@link DataStore.onDataChangedExternally} */
export type DataChangedInfo = {
	currentData: DataStoreRoot;
	changedData: DataStoreRoot;
	collectionsChanged: boolean;
	activeChanged: boolean;
	removedChanged: boolean;
};

class StatisticsHelper {

	public static ensureDate(value: IsoDateString | Date) {
		const date = isString(value) ? new Date(value) : value;
		return isDate(date) ? date : null;
	}

	public static ensureDateString(value: IsoDateString | Date | undefined): IsoDateString {
		const val = value === undefined ? new Date() : value;
		return isDate(val) ? val.toISOString() : val;
	}

	public static isNoteEmpty(note: NoteData) {
		return Object.keys(note.cs).length == 0;
	}

	public static isRemovedNoteEmpty(note: RemovedNoteData) {
		return Object.keys(note.cs).length == 0;
	}

	public static createFullID(noteID: NoteID, cardID: CardID) {
		return FullID.create(noteID, cardID, true); // back sides are not stored
	}

	/** Creates a new {@link CardData} with created date set to current time. */
	public static createCardData(decks: DeckID[], statistics: StatisticsData) {
		return {
			l: [],
			d: decks,
			s: statistics,
			c: DateTime.toIso(new Date()),
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

	/** Removes properties of {@link RemovedCardData} that don't exist in {@link CardData}. This should be done, for example, before serializing the JSON.  */
	public static removedCardToCard(removedCard: RemovedCardData): CardData {
		const {
			date,
			...cardData
		} = removedCard;
		return cardData;
	}

	public static cardToRemovedCard(card: CardData, removalDate?: Date): RemovedCardData {
		return {
			...card,
			date: StatisticsHelper.ensureDateString(removalDate),
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
