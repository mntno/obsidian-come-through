import { CardIDDataTuple, DataStore, StatisticsData } from "data/DataStore";
import { FullID } from "data/FullID";
import { Env } from "env";
import { Fsrs } from "scheduling/Fsrs";
import { FsrsConvert } from "scheduling/FsrsConvert";
import { ReviewItemInfo } from "scheduling/ReviewItemInfo";
import { FsrsSchedulerConfig, NextItem, NextReviewItemOptions, Rating, ReviewItem } from "scheduling/types";
import { Card, State, TypeConvert } from "ts-fsrs";
import { KeyValue } from "utils/ts";

interface DataItem {
	id: FullID;
	card: Card;
}

interface RetreivabilityDataItem extends DataItem {
	retreivability: number;
}

export class Scheduler {

	private static readonly DEFAULT_CONFIG: FsrsSchedulerConfig = {
		enableFuzz: Fsrs.DefaultParameter.ENABLE_FUZZ,
	};

	private readonly data: DataStore;
	private fsrs: Fsrs;

	public constructor(data: DataStore, config: FsrsSchedulerConfig = Scheduler.DEFAULT_CONFIG) {
		this.data = data;
		this.fsrs = new Fsrs(config);
	}

	public reconfigure(config: FsrsSchedulerConfig) {
		this.fsrs = new Fsrs(config);
	}

	public createItem() {
		return FsrsConvert.asStatistics(Fsrs.createEmptyCard());
	}

	/**
		* @param id ID of the item to rate.
		* @param rating
		* @param scheduleDate The date for the scheduling. Omit to schedule at the time of call (recommended).
		*/
	public rateItem(id: FullID, rating: Rating, scheduleDate?: Date) {
		this.data.editCard(id, (editor) => {
			const recordLogItem = this.fsrs.rate(FsrsConvert.toGrade(rating), FsrsConvert.asCard(editor.data.s), scheduleDate);
			FsrsConvert.setStatistics(editor.data.s, recordLogItem.card);
			//this.data.log.unshift(recordLogItem.log);
			return true;
		});
	}

	public previewNextItem(data: StatisticsData, reviewDate?: Date) {
		return this.previewNext(FsrsConvert.asCard(data), reviewDate);
	}

	/**
		* @param id
		* @throws If {@link id} does not exist.
		*/
	public previewNextItemByID(id: FullID, reviewDate?: Date) {
		const cd = this.data.getCard(id, true)!;
		const card = FsrsConvert.asCard(cd.s)
		return this.previewNext(card, reviewDate);
	}

	private previewNext(card: Card, reviewDate?: Date): NextItem[] {
		return this.fsrs
			.previewNext(card, reviewDate)
			.map(logItem => {
				return {
					stat: FsrsConvert.asStatistics(logItem.card),
					reviewLog: {
						rating: FsrsConvert.asRating(logItem.log.rating),
						// Add properties as needed
					}
				} satisfies NextItem;
			});
	}

	private static createDataItem(i: CardIDDataTuple) {
		const card = FsrsConvert.asCard(i.data.s);
		return {
			id: i.id,
			card: card,
		} satisfies DataItem;
	};

	private static createRetrievabilityDataItem(cardData: CardIDDataTuple, retreivability: (card: Card) => number): RetreivabilityDataItem {
		const item = Scheduler.createDataItem(cardData);
		return {
			...item,
			...{
				retreivability: retreivability(item.card),
			},
		} satisfies RetreivabilityDataItem;
	};

	/**
	 * Get the next review item from {@link cards}.
	 *
	 * Not necessarily deterministic.
	 *
	 * @param cards
	 * @param reviewDate
	 * @returns `null` if there is noting to review at {@link reviewDate}.
	 */
	public getNextItem(cards: CardIDDataTuple[], reviewDate: Date, options: NextReviewItemOptions): ReviewItem | null {
		const retrievabilityUpperThreshold = options.retrievabilityUpperThreshold ?? 0.95;
		let nextItem: DataItem | null = null;

		switch (options.sortOrder) {

			case "retrievability": {
				const items = cards.map(i => Scheduler.createRetrievabilityDataItem(i, (card) => this.fsrs.calculateRetrievability(card, reviewDate)));
				const itemsSortedByRetrievability = items.sort(Scheduler.Comparer.retrievability);

				if (KeyValue.isNotEmpty(options.totalRetrievabilityBelow)) {
					for (const threshold of options.totalRetrievabilityBelow.keys())
						options.totalRetrievabilityBelow.set(threshold, itemsSortedByRetrievability.filter(i => i.retreivability < threshold).length);
				}

				nextItem = itemsSortedByRetrievability.find(i => i.retreivability < retrievabilityUpperThreshold) ?? null;
				break;
			}

			case "due": {
				const items = cards.map(i => Scheduler.createDataItem(i));
				const itemsSortedByDueDate = items.sort(Scheduler.Comparer.dueDateAsc);

				if (KeyValue.isNotEmpty(options.totalDueBefore)) {
					for (const date of options.totalDueBefore.keys())
						options.totalDueBefore.set(date, itemsSortedByDueDate.filter(i => this.isCardDue(i.card, date)).length);
				}

				nextItem = itemsSortedByDueDate.find(i => this.isCardDue(i.card, reviewDate)) ?? null;
				break;
			}
		}

		return nextItem === null ? null : {
			id: nextItem.id,
			statistics: FsrsConvert.asStatistics(nextItem.card),
		} satisfies ReviewItem;
	}

	public getItemInfo(item: ReviewItem) {
		const c = this.data.getCard(item.id, false);
		Env.dev?.assert(c !== null, "Expected existing id:", item.id.toString());
		return new ReviewItemInfo(this.fsrs, FsrsConvert.asCard(item.statistics), c!);
	}

	/**
	 *
	 * @param lastState
	 * @param groupedByStateSortedByDueDate Cards with {@link State.Relearning} are expected to be merged with {@link State.Learning}.
	 * @returns If {@link State.Learning} is returned, cards in {@link State.Relearning} state may also be used.
	 */
	private getNextStateToUse(date: Date, lastState: State, groupedByStateSortedByDueDate: Record<State, {
		id: FullID;
		card: Card;
	}[]>): State {

		const hasNewItems = groupedByStateSortedByDueDate[State.New].length > 0;
		const firstLearningItem = groupedByStateSortedByDueDate[State.Learning][0];
		const hasRelearningItems = groupedByStateSortedByDueDate[State.Relearning].length > 0;
		const hasReviewItems = groupedByStateSortedByDueDate[State.Review].length > 0;

		if (hasRelearningItems)
			throw new Error("Internal Error");

		let nextState = State.New;

		switch (lastState) {
			case State.New:
				if (firstLearningItem !== undefined)
					nextState = State.Learning;
				else if (hasReviewItems)
					nextState = State.Review;
				break;

			case State.Learning:
			case State.Relearning:
				if (hasReviewItems)
					nextState = State.Review;
				else if (hasNewItems)
					nextState = State.New;
				else
					nextState = State.Learning;
				break;

			case State.Review:
				if (firstLearningItem !== undefined)
					nextState = State.Learning;
				else if (hasNewItems)
					nextState = State.New;
				else
					nextState = State.Review;
				break;
		}

		// If next state is learning/relearning and there are cards in those states due, go ahead.
		// The first card in the array is expected to be due next.
		if (nextState === State.Learning && firstLearningItem !== undefined && this.isCardDue(firstLearningItem.card, date)) {
			return State.Learning;
		}
		else {
			if (!hasNewItems)
				return State.Review
			else if (!hasReviewItems)
				return State.New
			else
				return Math.random() > 0.5 ? State.Review : State.New
		}
	}

	private groupItemsByState(items: DataItem[], groupRelearningAsLearning: boolean, excludeItem?: DataItem) {

		const grouped: Record<State, DataItem[]> = {
			[State.New]: [],
			[State.Learning]: [],
			[State.Relearning]: [],
			[State.Review]: [],
		};

		for (const item of items) {
			if (excludeItem !== undefined && excludeItem.id.isEqual(item.id))
				continue;
			if (groupRelearningAsLearning && item.card.state === State.Relearning)
				grouped[State.Learning].push(item);
			else
				grouped[item.card.state as State].push(item);
		}

		return grouped;
	}


	/**
	 * @param card
	 * @param date The {@link Date} to compare against. If later than {@link card}, then the latter is due.
	 * @returns
	 */
	public isCardDue(card: Card, date: Date) {
		return Scheduler.isDateLater(card.due, date);
	}

	public isStatisticsDue(data: StatisticsData, compareDate: Date = new Date()) {
		return Scheduler.isDateLater(TypeConvert.time(data.due), compareDate);
	}

	/**
	 *
	 * @param date
	 * @param compareDate
	 * @returns `true` if {@link compareDate} is later than {@link date}.
	 */
	public static isDateLater(date: Date | string, compareDate: Date = new Date()): boolean {
		if (typeof date === 'object' && date instanceof Date) {
			return compareDate.getTime() - date.getTime() > 0 ? true : false;
		} else {
			return this.isDateLater(TypeConvert.time(date), compareDate);
		}
	}

	private static Comparer = class {

		/**
		 * Sort by last reviewed.
		 *
		 * Sort by the date an item was latest reviewed descending,
		 * i.e., the item with the latest last review date will be sorted first.
		 *
		 * Items without a last review date will be sorted last as they have not been reviewed.
		 */
		public static lastReviewDateDesc(a: DataItem, b: DataItem): number {

			if (b.card.last_review !== undefined && a.card.last_review !== undefined)
				return TypeConvert.time(b.card.last_review).getTime() - TypeConvert.time(a.card.last_review).getTime();

			if (b.card.last_review !== undefined && a.card.last_review === undefined)
				return 1;

			if (b.card.last_review === undefined && a.card.last_review !== undefined)
				return -1;

			return 0;
		}

		public static dueDateAsc(a: DataItem, b: DataItem): number {
			return TypeConvert.time(a.card.due).getTime() - TypeConvert.time(b.card.due).getTime();
		}

		public static retrievability(a: RetreivabilityDataItem, b: RetreivabilityDataItem) {
			if (a.retreivability < b.retreivability) return -1;
			if (a.retreivability > b.retreivability) return 1;
			return 0;
		}

		public static newest(a: DataItem, b: DataItem): number {

			if (a.card.state == State.New && b.card.state == State.New)
				return Scheduler.Comparer.dueDateAsc(a, b);
			if (a.card.state == State.New && b.card.state != State.New)
				return 1;
			if (a.card.state != State.New && b.card.state == State.New)
				return -1

			const aIsLearningOrRelearning = a.card.state == State.Learning || a.card.state == State.Relearning;
			const bIsLearningOrRelearning = b.card.state == State.Learning || b.card.state == State.Relearning;
			if (aIsLearningOrRelearning && bIsLearningOrRelearning)
				return Scheduler.Comparer.dueDateAsc(a, b);
			if (aIsLearningOrRelearning && !bIsLearningOrRelearning)
				return 1;
			if (!aIsLearningOrRelearning && bIsLearningOrRelearning)
				return -1;

			return Scheduler.Comparer.dueDateAsc(a, b);
		}
	}

}
