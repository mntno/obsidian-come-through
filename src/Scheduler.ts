import { FullID } from 'FullID';
import { CardIDDataTuple, DataStore, StatisticsData } from 'DataStore';
import { createEmptyCard, fsrs, generatorParameters, Rating, FSRS, Card, State, Grade, TypeConvert, default_request_retention, default_maximum_interval, default_enable_fuzz, default_enable_short_term } from 'ts-fsrs';

type DataItem = {
  id: FullID;
  card: Card;
}

export class Scheduler {

  private fsrs: FSRS;

  public constructor(private readonly data: DataStore) {

    const params = generatorParameters({
      request_retention: default_request_retention,
      enable_fuzz: default_enable_fuzz,
      enable_short_term: default_enable_short_term,
      maximum_interval: default_maximum_interval,
      // w: default_w,
    });
    this.fsrs = fsrs(params);
  }

  public createItem() {
    return Scheduler.asStatistics(createEmptyCard(new Date()));
  }

  public rateItem(id: FullID, grade: Grade, reviewDate?: Date) {
    this.data.editCard(id, (editor) => {
      const recordLogItem = this.fsrs.next(Scheduler.asCard(editor.data.s), reviewDate ?? new Date(), grade);
      Scheduler.setStatistics(editor.data.s, recordLogItem.card);
      //this.data.log.unshift(recordLogItem.log);
      return true;
    });
  }

  public previewNextItem(data: StatisticsData, reviewDate?: Date) {
    return this.fsrs.repeat(Scheduler.asCard(data), reviewDate ?? new Date());
  }

  /**
   * Get the next review item from {@link cards}.
   * 
   * @param cards 
   * @param reviewDate 
   * @returns `null` if there is noting to review at {@link reviewDate}.
   */
  public getNextItem(cards: CardIDDataTuple[], reviewDate: Date): {
    id: FullID;
    statistics: StatisticsData;
  } | null {

    let nextItem: DataItem | null = null;

    const items = cards.map<DataItem>(i => ({
      id: i.id,
      card: Scheduler.asCard(i.data.s)
    }));

    // Find the latest item that's been reviewed / rated.    
    const lastReviewedItem = items
      .sort(Scheduler.Comparer.sortByLastReviewDateDesc)
      .find(p => p.card.last_review !== undefined);

    if (lastReviewedItem) {
      console.assert(lastReviewedItem.card.last_review && Scheduler.isDateLater(lastReviewedItem.card.last_review, new Date()), "Expected last review date to be in the past.");

      const groupedByStateSortedByDueDate = this.groupItemsByState(
        items.sort(Scheduler.Comparer.sortDueDateAsc),
        true);

      const nextState = this.getNextStateToUse(
        reviewDate,
        lastReviewedItem.card.state,
        groupedByStateSortedByDueDate);

      const itemsInState = groupedByStateSortedByDueDate[nextState];

      if (itemsInState.length > 1) {
        nextItem = itemsInState.filter(i => i !== lastReviewedItem).first() ?? null;
      }
      else if (itemsInState.length == 1) {
        nextItem = itemsInState[0];
        if (nextItem === lastReviewedItem && !this.isCardDue(lastReviewedItem.card, reviewDate))
          nextItem = null;
      }
    }
    else {
      nextItem = items.sort(Scheduler.Comparer.newest).first() ?? null;
    }

    return nextItem ? { id: nextItem.id, statistics: Scheduler.asStatistics(nextItem.card) } : null;
  }

  //#region

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
    const hasLearningItems = groupedByStateSortedByDueDate[State.Learning].length > 0;
    const hasRelearningItems = groupedByStateSortedByDueDate[State.Relearning].length > 0;
    const hasReviewItems = groupedByStateSortedByDueDate[State.Review].length > 0;

    if (hasRelearningItems)
      throw new Error("Internal Error");

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
    if (nextState === State.Learning && hasLearningItems && this.isCardDue(groupedByStateSortedByDueDate[State.Learning][0].card, date)) {      
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

  private groupItemsByState(items: DataItem[], groupRelearningAsLearning: boolean) {

    const grouped: Record<State, DataItem[]> = {
      [State.New]: [],
      [State.Learning]: [],
      [State.Relearning]: [],
      [State.Review]: [],
    };

    for (const item of items) {
      if (groupRelearningAsLearning && item.card.state === State.Relearning)
        grouped[State.Learning].push(item);
      else
        grouped[item.card.state as State].push(item);
    }

    return grouped;
  }

  private asCard(id: FullID) {
    return Scheduler.asCard(this.data.getCard(id, true)!.s);
  }

  //#endregion

  private nextState(rating: Rating, card?: Card) {
    const nextMemoryState = this.fsrs.next_state(
      card ? { stability: card.stability, difficulty: card.difficulty } : null,
      card ? card.elapsed_days : 0,
      rating,
    );
  }

  private previewNextItemByID(id: FullID, reviewDate?: Date) {
    return this.fsrs.repeat(this.asCard(id), reviewDate ?? new Date());
  }

  //#region

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

  public retrievability(statistics: StatisticsData, date?: Date | string) {
    return this.fsrs.get_retrievability(Scheduler.asCard(statistics), date ?? new Date(), false);
  }

  //#endregion

  private static Comparer = class {

    /**
     * Sort by last reviewed.
     * 
     * Sort by the date an item was latest reviewed descending, 
     * i.e., the item with the latest last review date will be sorted first.
     * 
     * Items without a last review date will be sorted last as they have not been reviewed.
     */
    public static sortByLastReviewDateDesc(a: DataItem, b: DataItem): number {

      if (b.card.last_review && a.card.last_review)
        return TypeConvert.time(b.card.last_review).getTime() - TypeConvert.time(a.card.last_review).getTime();

      if (b.card.last_review !== undefined && a.card.last_review === undefined)
        return 1;

      if (b.card.last_review === undefined && a.card.last_review !== undefined)
        return -1;

      return 0;
    }

    public static sortDueDateAsc(a: DataItem, b: DataItem): number {
      return TypeConvert.time(a.card.due).getTime() - TypeConvert.time(b.card.due).getTime();
    }

    public static sortByRetrievability(fsrs: FSRS, date: Date, a: DataItem, b: DataItem) {
      const ar = fsrs.get_retrievability(a.card, date, false);
      const br = fsrs.get_retrievability(b.card, date, false);
      if (ar < br) return -1;
      if (ar > br) return 1;
      return 0;
    }

    public static newest(a: DataItem, b: DataItem): number {

      if (a.card.state == State.New && b.card.state == State.New)
        return this.sortDueDateAsc(a, b);
      if (a.card.state == State.New && b.card.state != State.New)
        return 1;
      if (a.card.state != State.New && b.card.state == State.New)
        return -1

      const aIsLearningOrRelearning = a.card.state == State.Learning || a.card.state == State.Relearning;
      const bIsLearningOrRelearning = b.card.state == State.Learning || b.card.state == State.Relearning;
      if (aIsLearningOrRelearning && bIsLearningOrRelearning)
        return this.sortDueDateAsc(a, b);
      if (aIsLearningOrRelearning && !bIsLearningOrRelearning)
        return 1;
      if (!aIsLearningOrRelearning && bIsLearningOrRelearning)
        return -1;

      return this.sortDueDateAsc(a, b);
    }
  }

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
