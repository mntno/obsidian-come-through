import { StatisticsData } from 'data/DataStore';
import { Rating } from 'scheduling/types';
import { Card, Grade as FsrsGrade, Rating as FsrsRating, State, TypeConvert } from 'ts-fsrs';
import { Str } from 'utils/ts';


export const FsrsConvert = {

	/**
		* A rating excluding `Rating.Manual` is named `Grade` in `ts-fsrs`. {@link Rating} wraps `Grade` and calls it `Rating`.
		*
		* @param rating
		* @returns
		*/
	toGrade: (rating: Rating): FsrsGrade => {
		switch (rating) {
			case Rating.Again: return FsrsRating.Again;
			case Rating.Hard: return FsrsRating.Hard;
			case Rating.Good: return FsrsRating.Good;
			case Rating.Easy: return FsrsRating.Easy;
		}
	},

	/**
		* @remarks
		*
		* `Rating.Manual` is for bypassing the algorithm.
		* It's a special value used to indicate that a card's review schedule is being handled manually — not by the FSRS algorithm —
		* to allow for manual intervention in the scheduling process.
		*
		* - The next_state method in the FSRSAlgorithm class, which is responsible for updating a card's difficulty and stability, does not perform any calculations when the rating is Manual. It simply returns the existing state.
		* - The next method in the FSRS class, which is used for scheduling the next review, explicitly throws an error if the rating is Manual, preventing it from being used in a normal review.
		* - The rollback method also throws an error if it encounters a Manual rating in a review log.
		*
		* @throws If {@link r} is `Rating.Manual`.
		*/
	asRating: (r: FsrsRating): Rating => {
		switch (r) {
			case FsrsRating.Again: return Rating.Again;
			case FsrsRating.Hard: return Rating.Hard;
			case FsrsRating.Good: return Rating.Good;
			case FsrsRating.Easy: return Rating.Easy;
			case FsrsRating.Manual:
				throw new Error();
		}
	},

	asCard: (s: StatisticsData): Card => {
		return {
			due: TypeConvert.time(s.due),
			stability: s.s,
			difficulty: s.d,
			// TODO: Delete in ts-fsrs 6. Value not used.
			elapsed_days: 0,
			scheduled_days: s.sd,
			learning_steps: s.ls,
			reps: s.r,
			lapses: s.l,
			state: s.st satisfies State,
			// Check if is `string` rather than if `null`: Type changed from `string | undefined` to `string | null` in 0.5.1, so there may still be `undefined` values around. `TypeConvert.time` only supports `Date`, `string`, `number`: else throws.
			last_review: Str.is(s.lr) ? TypeConvert.time(s.lr) : undefined,
		};
	},

	asStatistics: (card: Card): StatisticsData => {
		return {
			due: card.due.toISOString(),
			s: card.stability,
			d: card.difficulty,
			sd: card.scheduled_days,
			ls: card.learning_steps,
			r: card.reps,
			l: card.lapses,
			st: card.state,
			lr: Str.toIsoStringOrNull(card.last_review),
		} satisfies StatisticsData;
	},

	/**
	 * Updates the properties of a {@link StatisticsData} object with the values from a {@link Card} object.
	 * @param s The {@link StatisticsData} object to update.
	 * @param card The {@link Card} object to source the new values from.
	 */
	setStatistics: (s: StatisticsData, card: Card) => {
		s.due = card.due.toISOString();
		s.s = card.stability;
		s.d = card.difficulty;
		s.sd = card.scheduled_days;
		s.ls = card.learning_steps;
		s.r = card.reps;
		s.l = card.lapses;
		s.st = card.state;
		s.lr = Str.toIsoStringOrNull(card.last_review);
	},
}
