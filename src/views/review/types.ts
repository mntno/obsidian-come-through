import { ParsedCard } from "ContentParser";
import { ReviewItem } from "scheduling/types";

export interface ReviewState {
	/** The current item in review.  */
	reviewedItem: ReviewItem,
	card: ParsedCard,
	/** Total number of items in the review queue. */
	numberOfItems: number,
	/** Date for which this state applies. */
	date: Date,
	totalDueBefore?: Map<Date, number>,
	totalRetrievabilityBelow?: Map<number, number>,
};
