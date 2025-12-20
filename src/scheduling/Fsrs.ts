import { Env } from "env";
import { FsrsSchedulerConfig } from "scheduling/types";
import { Card, createEmptyCard, default_enable_fuzz, default_enable_short_term, default_learning_steps, default_maximum_interval, default_relearning_steps, default_request_retention, fsrs, FSRS, generatorParameters, Grade, RecordLogItem } from "ts-fsrs";

export class Fsrs {

	public static readonly DefaultParameter = {
		ENABLE_FUZZ: default_enable_fuzz,
	} as const;

	private readonly fsrs: FSRS;

	constructor(config: FsrsSchedulerConfig) {
		this.fsrs = Fsrs.createFromConfig(config);
	}

	private static createFromConfig(config: FsrsSchedulerConfig) {
		Env.assert(config);

		const params = generatorParameters({
			request_retention: default_request_retention,
			enable_fuzz: config.enableFuzz,
			enable_short_term: default_enable_short_term,
			maximum_interval: default_maximum_interval,
			learning_steps: default_learning_steps,
			relearning_steps: default_relearning_steps,
			// w: default_w,
		});

		return fsrs(params);
	}

	public static createEmptyCard(): Card {
		return createEmptyCard(new Date());
	}

	/**
		* @param scheduleDate The date for the scheduling. Omit to schedule at the time of call (recommended).
		*/
	public rate(rating: Grade, card: Card, scheduleDate?: Date): RecordLogItem {
		return this.fsrs.next(card, scheduleDate ?? new Date(), rating);
	}

	public previewNext(card: Card, reviewDate?: Date): RecordLogItem[] {
		const preview = this.fsrs.repeat(card, reviewDate ?? new Date());
		const logItems: RecordLogItem[] = [];
		for (const item of preview)
			logItems.push(item);
		return logItems;
	}

	// private nextState(rating: Rating, card?: Card) {
	// 	const nextMemoryState = this.fsrs.next_state(
	// 		card !== undefined ? { stability: card.stability, difficulty: card.difficulty } : null,
	// 		card !== undefined ? card.elapsed_days : 0,
	// 		rating,
	// 	);
	// }

	public calculateRetrievability(card: Card, reviewDate: Date): number {
		return this.fsrs.get_retrievability(card, reviewDate, false);
	}

	public calculateRetrievabilityString(card: Card, reviewDate: Date): string {
		return this.fsrs.get_retrievability(card, reviewDate, true);
	}
}
