import { ContentParser, MaybeParsedCard } from "#/ContentParser";
import { CardIDDataTuple, DataStore, DeckData } from "#/data/DataStore";
import { DeckID, FullID } from "#/data/FullID";
import { Env } from "#/env";
import { Scheduler } from "#/scheduling/Scheduler";
import { NextReviewItemOptions, ReviewItem } from "#/scheduling/types";
import { PluginSettings } from "#/Settings";
import { Arr, St, Str } from "#/utils/ts";
import { ReviewState } from "#/views/review/types";
import { App } from "obsidian";

/**
 * All types must be serializable as the {@link ReviewItemProvider} is recreated from this.
 */
export type ReviewProviderConfig =
	| { type: "all" }
	| { type: "item", id: FullID | FullID[] }
	| { type: "deck", deckID: null | DeckID | DeckID[] }
	| { type: "file", paths: string | string[] };

export interface ReviewItemProvider {
	/** Do not cache. Get them fresh each time as there is no notifying of changes. */
	getNextItem(date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError>;
	getDisplayText(): string;
	getConfig(): ReviewProviderConfig | null;
}

export class ReviewProviderFactory {
	static create(config: ReviewProviderConfig | null, ctx: ReviewProviderContext): ReviewItemProvider {
		if (config === null)
			return new AllCardsReviewProvider(ctx);

		switch (config.type) {
			case "item":
				return new ItemReviewProvider(config.id, ctx);
			case 'deck':
				return new CollectionReviewProvider(config.deckID, ctx);
			case 'file':
				return new FileReviewProvider(config.paths, ctx);
			case "all":
				return new AllCardsReviewProvider(ctx);
		}
	}
}

type ReviewProviderContext = {
	app: App;
	data: DataStore;
	scheduler: Scheduler;
	settings: PluginSettings;
}

export type ReviewProviderErrors = AllCardsReviewProviderError | ItemReviewProviderError | DeckReviewProviderError | FileReviewProviderError;

export type ReviewProviderErrorInfo =
	| { code: "no-data-items" }
	| { code: "no-review-items", cards: CardIDDataTuple[] }
	| { code: "incomplete-declaration"; reviewedItem: ReviewItem }
	| { code: "content-not-found"; reviewedItem: ReviewItem; incomplete: MaybeParsedCard }
	| { code: "unexpected"; message: string };

export abstract class ReviewProviderError extends Error {
	public readonly info: ReviewProviderErrorInfo;

	protected constructor(detail: ReviewProviderErrorInfo) {
		super(detail.code);
		this.name = "ReviewProviderError";
		this.info = detail;
	}

	public static cast(error: ReviewProviderError): ReviewProviderErrors {
		return error as ReviewProviderErrors;
	}
}

abstract class DataProviderError<T> extends ReviewProviderError {
	public readonly items: T;
	constructor(detail: ReviewProviderErrorInfo, collections: T) {
		super(detail);
		this.items = collections;
	}
}

export class AllCardsReviewProviderError extends ReviewProviderError {
	public readonly type = "all" as const;
	constructor(detail: ReviewProviderErrorInfo) {
		super(detail);
		this.name = "AllCardsReviewProviderError";
	}
}

export class ItemReviewProviderError extends DataProviderError<ReadonlySet<FullID>> {
	public readonly type = "item" as const;
	constructor(detail: ReviewProviderErrorInfo, items: ReadonlySet<FullID>) {
		super(detail, items);
		this.name = "ItemReviewProviderError";
	}
}

export class DeckReviewProviderError extends DataProviderError<Record<DeckID, DeckData>> {
	public readonly type = "deck" as const;
	constructor(detail: ReviewProviderErrorInfo, collections: Record<DeckID, DeckData>) {
		super(detail, collections);
		this.name = "DeckReviewProviderError";
	}
}

export class FileReviewProviderError extends DataProviderError<string[]> {
	public readonly type = "file" as const;
	constructor(detail: ReviewProviderErrorInfo, paths: string[]) {
		super(detail, paths);
		this.name = "FileReviewProviderError";
	}
}

abstract class BaseReviewProvider {
	protected readonly ctx: ReviewProviderContext;

	protected constructor(ctx: ReviewProviderContext) {
		this.ctx = ctx;
	}

	protected abstract createError(info: ReviewProviderErrorInfo): ReviewProviderError;

	protected async createReviewState(cards: CardIDDataTuple[], date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError> {

		if (cards.length === 0)
			return this.createError({ code: "no-data-items" });

		const reviewedItem = this.ctx.scheduler.getNextItem(cards, date, options);
		if (reviewedItem === null)
			return this.createError({ code: "no-review-items", cards: cards });

		Env.assert(Str.nonEmpty(reviewedItem.id.cardID) !== undefined, "Card expected");
		if (Str.nonEmpty(reviewedItem.id.cardID) === undefined)
			return this.createError({ code: "unexpected", message: "Card expected" });

		const contentResult = await ContentParser.getCard(reviewedItem.id, this.ctx.app, {
			contentRead: {
				hideCardSectionMarker: this.ctx.settings.hideCardSectionMarker
			},
			likelyNoteIDs: this.ctx.data.getAllNotes() // Only notes that contain declarations
		});

		if (contentResult.complete === null) {
			if (contentResult.incomplete !== null)
				return this.createError({ code: "content-not-found", reviewedItem, incomplete: contentResult.incomplete });
			else
				return this.createError({ code: "incomplete-declaration", reviewedItem });
		}

		return {
			reviewedItem,
			date: date,
			card: contentResult.complete,
			numberOfItems: cards.length,
			totalDueBefore: options.totalDueBefore,
			totalRetrievabilityBelow: options.totalRetrievabilityBelow
		};
	}
}

class AllCardsReviewProvider extends BaseReviewProvider implements ReviewItemProvider {

	public constructor(ctx: ReviewProviderContext) {
		super(ctx);
	}

	protected createError(info: ReviewProviderErrorInfo): ReviewProviderError {
		return new AllCardsReviewProviderError(info);
	}

	public async getNextItem(date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError> {
		return this.createReviewState(this.ctx.data.getAllCards(), date, options);
	}

	public getDisplayText(): string {
		return "Review all";
	}

	public getConfig(): ReviewProviderConfig | null {
		return null;
	}
}

class ItemReviewProvider extends BaseReviewProvider implements ReviewItemProvider {
	private readonly id: ReadonlySet<FullID>;

	public constructor(cardID: FullID | FullID[] | Set<FullID>, ctx: ReviewProviderContext) {
		super(ctx);
		this.id = St.is(cardID) ? cardID : new Set(Arr.from(cardID));
	}

	protected createError(info: ReviewProviderErrorInfo): ReviewProviderError {
		if (St.isEmpty(this.id))
			return new AllCardsReviewProviderError(info);
		return new ItemReviewProviderError(info, this.id);
	}

	public async getNextItem(date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError> {
		return this.createReviewState(this.ctx.data.item.allIDsInSet(this.id), date, options);
	}

	public getDisplayText(): string {
		return `Review ${this.id.size} units`;
	}

	public getConfig(): ReviewProviderConfig | null {
		return { type: "item", id: St.toArr(this.id) };
	}
}

class CollectionReviewProvider extends BaseReviewProvider implements ReviewItemProvider {
	/** Empty array means all items that are assigned a collection. Use {@link collectionIDs}. */
	private readonly id: ReadonlyArray<DeckID>;

	public constructor(deckID: DeckID | DeckID[] | null, ctx: ReviewProviderContext) {
		Env.log.data("CollectionReviewProvider: ", deckID)
		super(ctx);
		this.id = deckID === null ? [] : Arr.readonlyFrom(deckID);
	}

	protected createError(info: ReviewProviderErrorInfo): ReviewProviderError {
		const map: Record<DeckID, DeckData> = {};
		for (const id of this.collectionIDs()) {
			const data = this.ctx.data.getDeck(id);
			if (data !== null)
				map[id] = data;
		}
		return new DeckReviewProviderError(info, map);
	}

	public async getNextItem(date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError> {
		Env.log.data("CollectionReviewProvider:getNextItem: ", this.collectionIDs());
		return this.createReviewState(this.ctx.data.item.allInCollection(this.collectionIDs()), date, options);
	}

	public getDisplayText(): string {
		switch (this.id.length) {
			case 0:
				return "Review";
			case 1:
				return `Review ${this.ctx.data.getDeck(Arr.firstOrThrow(this.id), true)!.n}`;
			default:
				return `Review ${this.id.length} decks`;
		}
	}

	public getConfig(): ReviewProviderConfig | null {
		return { type: 'deck', deckID: [...this.id] };
	}

	private collectionIDs() {
		if (Arr.isEmpty(this.id))
			return this.ctx.data.collection.all().map(c => c.id);
		else
			return this.id;
	}
}

class FileReviewProvider extends BaseReviewProvider implements ReviewItemProvider {
	private readonly paths: string[];

	public constructor(paths: string | string[], ctx: ReviewProviderContext) {
		super(ctx);
		this.paths = Arr.from(paths);
	}

	protected createError(info: ReviewProviderErrorInfo): ReviewProviderError {
		return new FileReviewProviderError(info, this.paths);
	}

	public async getNextItem(date: Date, options: NextReviewItemOptions): Promise<ReviewState | ReviewProviderError> {
		const cards = this.ctx.data.getAllCards().filter(c => this.paths.some(p => c.id.hasNoteID(p)));
		return this.createReviewState(cards, date, options);
	}

	public getDisplayText(): string {
		if (this.paths.length === 1) {
			const filename = this.paths[0]?.split('/').pop() || this.paths[0] || "File";
			return `Review: ${filename}`;
		}
		return `Review: ${this.paths.length} files`;
	}

	public getConfig(): ReviewProviderConfig | null {
		return { type: 'file', paths: this.paths };
	}
}
