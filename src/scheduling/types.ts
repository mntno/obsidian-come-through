import { FullID } from "#/data/FullID";
import { StatisticsData } from "#/data/types";
import { Rating as FsrsRating } from "ts-fsrs";

export enum Rating {
	Again = FsrsRating.Again,
	Hard = FsrsRating.Hard,
	Good = FsrsRating.Good,
	Easy = FsrsRating.Easy
}
export const Ratings = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export interface NextItem {
	stat: StatisticsData,
	reviewLog: {
		rating: Rating,
		// Add properties as needed
	},
};

export const Scheduling = {
	reviewSortOrder: ["due", "retrievability"] as const,
};

export type ReviewSortOrder = (typeof Scheduling.reviewSortOrder)[number];

export type FsrsSchedulerConfig = {
	enableFuzz: boolean;
}

export type NextReviewItemOptions = {
	sortOrder: ReviewSortOrder;
	totalDueBefore?: Map<Date, number>;
	totalRetrievabilityBelow?: Map<number, number>;
	/** When sorting by retrievability, do not return items with higher than this. */
	retrievabilityUpperThreshold?: number;
}

export interface ReviewItem {
	id: FullID,
	statistics: StatisticsData,
};
