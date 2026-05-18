import { DeckID } from "#/data/FullID";

/** Serves as a reminder that dates are read and stored as ISO strings. */
export type IsoDateString = string;

/** Make sure dates are never of `undefined` type. */
export type OptionalIsoDateString = IsoDateString | null;

type LogID = string;

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
