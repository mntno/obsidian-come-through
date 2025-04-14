import { FullID } from 'FullID';
import { Statistics, StatisticsData } from 'Statistics';
import { createEmptyCard, fsrs, generatorParameters, Rating, FSRS, Card, State, Grade, TypeConvert, default_request_retention, default_maximum_interval, default_enable_fuzz, default_enable_short_term } from 'ts-fsrs';

export class SchedulerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SchedulerError";
  }
}

export interface GetDataOptions {
  sortByDueDateAsc?: boolean;

  /**
   * Sort so that the most recent reviewed card comes first.
   * Cards without latest review date will be sorted before those that have. 
   */
  sortByLastReviewDateDesc?: boolean;
  sortByRetrievability?: boolean;
  reviewDate?: Date,
  onlyIfDue?: boolean,
}

export interface DataItem {
  id: FullID;
  card: Card;
}

export class Scheduler {

  private fsrs: FSRS;  

  public constructor(private readonly data: Statistics) {

    const params = generatorParameters({
      request_retention: default_request_retention,
      enable_fuzz: default_enable_fuzz,
      enable_short_term: default_enable_short_term,
      maximum_interval: default_maximum_interval,
      // w: default_w,
    });    
    this.fsrs = fsrs(params);
  }

  //#region

  public getAllItems(options: GetDataOptions = {}) {
    const {
      sortByDueDateAsc = false,
      sortByLastReviewDateDesc = false,
      sortByRetrievability = false,
      reviewDate = new Date(),
      onlyIfDue = false,
    } = options;

    let allData = this.data.getAllCards().map<DataItem>(i => {
      return { id: i.id, card: Scheduler.asCard(i.data.s)};
    }); 

    if (sortByDueDateAsc) {
      allData = allData.sort(this.sortDueDateAsc);
    }
    else if (sortByLastReviewDateDesc) {      
      allData = allData.sort((a, b) => {

        if (a.card.last_review && b.card.last_review)
          return TypeConvert.time(b.card.last_review).getTime() - TypeConvert.time(a.card.last_review).getTime();

        // If none of them have last review, sort by due date asc.
        if (a.card.last_review === undefined && b.card.last_review === undefined)
          return this.sortDueDateAsc(a, b);

        // If they have a last review, sort after the ones who don't have.
        if (a.card.last_review)
          return -1;
        if (b.card.last_review)
          return -1;

        return 0;
      });
    }
    else if (sortByRetrievability) {
      allData = allData.sort((a, b) => {
        const ar = this.fsrs.get_retrievability(a.card, reviewDate, false);
        const br = this.fsrs.get_retrievability(b.card, reviewDate, false);
        if (ar < br) return -1;
        if (ar > br) return 1;
        return 0;
      });
    }

    return onlyIfDue ? allData.filter(d => {
      return this.isCardDue(d.card, reviewDate);
    }) : allData;
  }

  private groupItemsByStateSortedByDue(groupRelearningAsLearning: boolean) {

    const grouped: Record<State, { id: FullID, card: Card }[]> = {
      [State.New]: [],
      [State.Learning]: [],
      [State.Relearning]: [],
      [State.Review]: [],
    };

    for (const item of this.getAllItems({ sortByDueDateAsc: true })) {
      if (groupRelearningAsLearning && item.card.state === State.Relearning)
        grouped[State.Learning].push(item);
      else
        grouped[item.card.state as State].push(item);
    }

    return grouped;
  }

  public newStatistics() {
    return Scheduler.asStatistics(createEmptyCard(new Date()));
  }

  //#endregion

  /**
   * Calculates the next state of memory based on the current state, time elapsed, and grade.
   * 
   * @returns The next state of memory with updated difficulty and stability.
   */
  private nextState(rating: Rating, card?: Card) {
    const nextMemoryState = this.fsrs.next_state(
      card ? { stability: card.stability, difficulty: card.difficulty } : null,
      card ? card.elapsed_days : 0,
      rating,
    );
  }

  private getCard(id: FullID) {
    return Scheduler.asCard(this.data.getCard(id, true)!.s);
  }

  public async rateItem(id: FullID, grade: Grade, reviewDate?: Date) {
    const cardData = this.data.getCard(id, true)!;
    const recordLogItem = this.fsrs.next(Scheduler.asCard(cardData.s), reviewDate ?? new Date(), grade);
    Scheduler.setStatistics(cardData.s, recordLogItem.card);
    //this.data.log.unshift(recordLogItem.log);
    await this.data.save();
  }

  public getNextItem(reviewDate?: Date) {
    let nextItem: DataItem | null = null;

    const allItemsSortedByLastReview = this.getAllItems({
      sortByLastReviewDateDesc: true,
      reviewDate: reviewDate,
    });
            
    // Get the latest item that's been reviewed/rated.
    const lastReviewedItem = allItemsSortedByLastReview.find(p => p.card.last_review !== undefined);
    
    if (lastReviewedItem) {            
      const groupedByStateSortedByDueDate = this.groupItemsByStateSortedByDue(true)      
      const nextState = this.getNextStateToUse(lastReviewedItem.card.state, groupedByStateSortedByDueDate);      
      nextItem = groupedByStateSortedByDueDate[nextState].filter(p => p.id !== lastReviewedItem.id).first() ?? null;
    }
    else {            
      nextItem = allItemsSortedByLastReview
        .filter(p => p.card.last_review === undefined) // Get unreviewed (presumably the same result as in items[State.New]). 
        .sort(this.sortDueDateAsc).first() // Re-sort by due date.
        ?? null;      
    }

    return nextItem ? { id: nextItem.id, statistics: Scheduler.asStatistics(nextItem.card) } : null;
  }

  public previewNextItemByID(id: FullID, reviewDate?: Date) {    
    return this.fsrs.repeat(this.getCard(id), reviewDate ?? new Date());
  }

  public previewNextItem(data: StatisticsData, reviewDate?: Date) {    
    return this.fsrs.repeat(Scheduler.asCard(data), reviewDate ?? new Date());
  }

  /**
   * 
   * @param lastState 
   * @param groupedByStateSortedByDueDate Cards with {@link State.Relearning} are expected to be merged with {@link State.Learning}.
   * @returns If {@link State.Learning} is returned, cards in {@link State.Relearning} state may also be used.
   */
  private getNextStateToUse(lastState: State, groupedByStateSortedByDueDate: Record<State, {
    id: FullID;
    card: Card;
  }[]>): State {

    const hasNewItems = groupedByStateSortedByDueDate[State.New].length > 0;
    const hasLearningItems = groupedByStateSortedByDueDate[State.Learning].length > 0;
    const hasRelearningItems = groupedByStateSortedByDueDate[State.Relearning].length > 0;
    const hasReviewItems = groupedByStateSortedByDueDate[State.Review].length > 0;
    
    if (hasRelearningItems)
      throw new Error();

    let nextState = State.New;

    switch (lastState) {
      case State.New:
        if (hasLearningItems)
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
        if (hasLearningItems)
          nextState = State.Learning;
        else if (hasNewItems)
          nextState = State.New;
        else
          nextState = State.Review;
        break;
    }
   
    // If next state is learning/relearning and there are cards in those states due, go ahead.
    // The first card in the array is expected to be due next.
    if (nextState === State.Learning && hasLearningItems && this.isCardDue(groupedByStateSortedByDueDate[State.Learning][0].card)) {
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

  //#region

  /**
   * @param card 
   * @param date The {@link Date} to compare against. If later than {@link card}, then the latter is due.
   * @returns 
   */
  public isCardDue(card: Card, date: Date = new Date()) {    
    return Scheduler.isDue(card.due, date);
  }

  public isStatisticsDue(data: StatisticsData, compareDate: Date = new Date()) {
    return Scheduler.isDue(TypeConvert.time(data.due), compareDate);
  }

  public static isDue(date: Date | string, compareDate: Date = new Date()): boolean {
    if (typeof date === 'object' && date instanceof Date) {
      return compareDate.getTime() - date.getTime() > 0 ? true : false;
    } else {
      return this.isDue(TypeConvert.time(date), compareDate);
    }
  }

  private sortDueDateAsc(a: DataItem, b: DataItem): number {    
    return TypeConvert.time(a.card.due).getTime() - TypeConvert.time(b.card.due).getTime();
  }

  public retrievability(statistics: StatisticsData, date?: Date | string) {
    return this.fsrs.get_retrievability(Scheduler.asCard(statistics), date ?? new Date(), false);
  } 

  //#endregion

  private static asCard(s: StatisticsData): Card {
    return {
      due: TypeConvert.time(s.due),
      stability: s.s,
      difficulty: s.d,
      elapsed_days: s.ed,
      scheduled_days: s.sd,
      reps: s.r,
      lapses: s.l,
      state: s.st as State,
      last_review: s.lr ? TypeConvert.time(s.lr) : undefined,
    };
  }

  private static asStatistics(card: Card): StatisticsData {
    return {
      due: card.due.toISOString(),
      s: card.stability,
      d: card.difficulty,
      ed: card.elapsed_days,
      sd: card.scheduled_days,
      r: card.reps,
      l: card.lapses,
      st: card.state,
      lr: card.last_review?.toISOString(),
    } satisfies StatisticsData;
  }

  private static setStatistics(s: StatisticsData, card: Card) {
    s.due = card.due.toISOString();
    s.s = card.stability;
    s.d = card.difficulty;
    s.ed = card.elapsed_days;
    s.sd = card.scheduled_days;
    s.r = card.reps;
    s.l = card.lapses;
    s.st = card.state;
    s.lr = card.last_review?.toISOString();
  }
}
