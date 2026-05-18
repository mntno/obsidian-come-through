import { CardData } from "#/data/types";
import { Fsrs } from "#/scheduling/Fsrs";
import { Rating } from '#/scheduling/types';
import { DateTime } from "#/utils/datetime";
import { Card, Rating as FsrsRating, State as FsrsState, show_diff_message } from "ts-fsrs";

const timeUnit = [" sec", " min", " hours", " days", " months", " years"];

const Convert = {
	stateAsString: (state: number) => String(FsrsState[state]),
	ratingAsString: (rating: Rating) => String(FsrsRating[rating]),
	timeDiffMsg: (due: Date, lastReview: Date) => show_diff_message(due, lastReview, true, timeUnit),
} as const;

/** See {@link CardData.c} */
const CREATED_DATE_FALLBACK = "2025";

export class ReviewItemInfo {
	private readonly fsrs: Fsrs;
	private readonly card: Card;
	private readonly cardData: CardData;

	constructor(fsrs: Fsrs, card: Card, cardData: CardData) {
		this.fsrs = fsrs;
		this.card = card;
		this.cardData = cardData;
	}

	public static readonly Convert = Convert;

	public get created(): string {
		return this.cardData.c !== null ? DateTime.dateStringFromIso(this.cardData.c) : CREATED_DATE_FALLBACK;
	}

	public get dueDate() {
		return this.card.due;
	}

	public get due() {
		return DateTime.toString(this.dueDate);
	}

	public get state() {
		return Convert.stateAsString(this.card.state);
	}

	public get lastReview() {
		return this.card.last_review ?? null;
	}

	public retrievabilityAsString(date: Date) {
		return this.fsrs.calculateRetrievabilityString(this.card, date);
	}

	public isStatisticsDue(compareDate: Date = new Date()) {
		return DateTime.isDateLater(this.card.due, compareDate);
	}
}
