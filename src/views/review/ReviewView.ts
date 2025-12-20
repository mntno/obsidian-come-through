import { ContentParser } from "ContentParser";
import { DataStore, DeckIDDataTuple } from "data/DataStore";
import { DeckID } from "data/FullID";
import { Env } from "env";
import t from "Localization";
import { ReviewItemInfoModal } from "modals/ReviewItemInfoModal";
import { IconName, Keymap, KeymapEventListener, Menu, PaneType, Scope, setIcon, setTooltip, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { HeadingProcessor } from "renderings/content/HeadingProcessor";
import { ReviewItemInfo } from "scheduling/ReviewItemInfo";
import { Scheduler } from "scheduling/Scheduler";
import { Rating } from "scheduling/types";
import { NextReviewItemOptions, ReviewSortOrder } from "scheduling/types";
import { SettingsManager } from "Settings";
import { OmitIndexSignature, UnsignedInteger } from "types";
import { Icon } from "ui/constants";
import { UIAssistant } from "ui/UIAssistant";
import { FileParserError } from "utils/obs/FileParser";
import { InternalApi } from "utils/obs/internal";
import { Num, Obj, Str } from "utils/ts";
import { BaseView, BaseViewEphemeralState, BaseViewState } from "views/BaseView";
import { ContentUnit } from "views/review/ContentUnit";
import { createMetadataEl, createRatingButtons } from "views/review/elements";
import { ReviewState } from "views/review/types";

interface ReviewViewState extends BaseViewState {
	deckID: DeckID | null;
	showMetadata: boolean;
	sortOrder: ReviewSortOrder;
}

interface ReviewViewEphemeralState extends BaseViewEphemeralState {
	contentIndex: UnsignedInteger | null;
	frontScrollPosition: number;
	backScrollPosition: number;
};

const DEFAULT_STATE: ReviewViewState = {
	deckID: null,
	showMetadata: false,
	sortOrder: "due",
} as const;

const DEFAULT_ESTATE: ReviewViewEphemeralState = {
	contentIndex: null,
	frontScrollPosition: 0,
	backScrollPosition: 0
} as const;

export class ReviewView extends BaseView<ReviewViewState> {

	public static readonly TYPE = "come-through-view-review";
	public static createViewState(deckID: DeckID | null): ReviewViewState {
		Env.log.d("ReviewView:createViewState: collection ID:", deckID);
		return {
			...DEFAULT_STATE,
			...{
				deckID: deckID,
			},
		} satisfies ReviewViewState;
	}

	private readonly data: DataStore;
	private readonly ui: UIAssistant;
	private readonly scheduler: Scheduler;
	private readonly pager: ContentUnit;

	private state: ReviewViewState = { ...DEFAULT_STATE };
	private eState: ReviewViewEphemeralState = { ...DEFAULT_ESTATE };

	/**
		* Will be `null` if there for some reason is no content available.
		* For example if:
		* - there was no content to review based on the given collection and sort order
		* - errors occured during the process
		* - an instance of this class was just created and this property hasn't been assigned yet
		*
		* External available functionality that is dependent on this value, is exposed through {@link getFacade}, which may be used internally as well.
		*/
	private reviewState: ReviewState | null = null;

	private deck: DeckIDDataTuple | null = null;

	private ratingButtonsContainer?: HTMLDivElement;
	private displayNextContentButton?: HTMLElement;

	public constructor(
		leaf: WorkspaceLeaf,
		settingsManager: SettingsManager,
		scheduler: Scheduler,
		ui: UIAssistant,
		data: DataStore) {
		Env.log.d("ReviewView:constructor");
		super(leaf, settingsManager, { data: data });

		this.scheduler = scheduler;
		this.ui = ui;
		this.data = data;

		this.pager = new ContentUnit(2);

		this.navigation = true;
		this.scope = new Scope(this.app.scope);

		const onDisplayNextContentItem: KeymapEventListener = () => {
			this.displayNextContentItem();
			return false;
		};

		const rate = (rating: Rating) => {
			this.getFacade()?.rate?.(rating);
		};

		this.scope.register(null, " ", onDisplayNextContentItem);
		this.scope.register(null, "Enter", onDisplayNextContentItem);
		if (!InternalApi.addEventHandlerToExistingKeyMap(this.app, this.scope, "markdown:toggle-preview", onDisplayNextContentItem))
			this.scope.register(["Mod"], "E", onDisplayNextContentItem);

		this.scope.register(null, "1", () => rate(Rating.Again));
		this.scope.register(null, "2", () => rate(Rating.Hard));
		this.scope.register(null, "3", () => rate(Rating.Good));
		this.scope.register(null, "4", () => rate(Rating.Easy));

		this.scope.register(["Mod"], "R", () => this.reloadView());
	}

	public setSortOrder(sortOrder: ReviewSortOrder) {
		this.state.sortOrder = sortOrder;
		this.removeAllPages(true);
		this.saveState();
		this.render();
	}

	/**
		* @returns `null` if it is not possible to call any of the methods.
		*/
	public getFacade() {
		if (this.reviewState === null)
			return null;
		const reviewState = this.reviewState;

		return {

			/** @returns `null` if source file cannot be opened. */
			openSourceFile: this.sourceFile() instanceof TFile ? async (newLeaf?: PaneType | boolean) => {
				const sourceFile = this.sourceFile();
				if (sourceFile) {
					const leaf = this.app.workspace.getLeaf(newLeaf);
					await leaf.openFile(sourceFile, { state: undefined, eState: undefined, active: true, group: undefined });
				}
			} : null,

			rate: this.pager.isAtLastIndex ? (rating: Rating) => this.rate(rating) : null,

			reviewState: reviewState,
			reviewItemInfo: () => this.scheduler.getItemInfo(reviewState.reviewedItem),

			sortOrder: this.state.sortOrder,

			/** @returns `null` if metadata cannot be shown. */
			toggleShowMetadata: this.pager.currentIndex !== null ? () => {
				this.state.showMetadata = !this.state.showMetadata;
				this.saveState();
				this.render();
			} : null,
		};
	}

	public override getIcon(): IconName {
		return Icon.PLUGIN;
	}

	public override getViewType(): string {
		return ReviewView.TYPE;
	}

	public override getDisplayText(): string {
		return this.deck ? `Review: ${this.deck.data.n}` : "Review";
	}

	public override onload(): void {
		Env.log.d("ReviewView:onload");
		super.onload();

		if (Env.isMobile)
			this.registerDomEvent(this.contentEl, "dblclick", () => { this.displayNextContentItem(); });
	}

	public override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string): void {
		Env.log.d("ReviewView:onPaneMenu");
		super.onPaneMenu(menu, source);

		if (source === "tab-header")
			return;

		const prefix = false;
		const section = "pane";
		const action = this.getFacade();

		this.ui.addMenuItem(menu, `Order by retrievability`, {
			section: section,
			icon: "arrow-up-down",
			prefix: prefix,
			checked: this.state.sortOrder === "retrievability",
			onClick: () => {
				this.setSortOrder(this.state.sortOrder === "retrievability" ? "due" : "retrievability");
			}
		});

		if (action !== null && action.openSourceFile !== null) {
			this.ui.addMenuItem(menu, `Open source note`, {
				section: section,
				icon: "file-code-2",
				prefix: prefix,
				onClick: async evt => {
					await action.openSourceFile?.(Keymap.isModEvent(evt));
				}
			});
		}

		if (action !== null && action.toggleShowMetadata !== null) {
			this.ui.addMenuItem(menu, t.review.actions.toggleInlineInfo, {
				section: section,
				icon: "info",
				prefix: prefix,
				checked: this.state.showMetadata,
				onClick: action.toggleShowMetadata
			});
		}

		this.ui.addMenuItem(menu, "Reload", {
			section: section,
			icon: "refresh-cw",
			prefix: prefix,
			onClick: () => {
				this.reloadView();
			}
		});
	}

	protected override async onOpen(): Promise<void> {
		Env.log.d("ReviewView:onOpen");
		await super.onOpen();

		const props = this.forwardBackwardButtonProps();
		this.displayNextContentButton = this.addAction(props.icon, props.title, () => this.displayNextContentItem());
	}

	protected override onSetState(state: ReviewViewState, result: ViewStateResult): void {
		Env.log.d("ReviewView:onSetState", state);
		this.state = { ...DEFAULT_STATE, ...state };
		this.deck = state.deckID ? {
			id: state.deckID,
			data: this.data.getDeck(state.deckID, true)!
		} : null;
	}

	protected override onGetState(): ReviewViewState {
		Env.log.d("ReviewView:onGetState");
		return {
			...this.state,
			...{
				deckID: this.deck?.id ?? null,
			} satisfies Partial<OmitIndexSignature<ReviewViewState>>,
		};
	}

	protected override onSetEphemeralState(state: unknown): void {
		this.eState = Obj.is(state) ? { ...DEFAULT_ESTATE, ...state } : { ...DEFAULT_ESTATE };
		Env.log.d("ReviewView:onSetEphemeralState:", this.eState);

		if (this.eState.contentIndex !== null)
			this.displayPageAtIndex(this.eState.contentIndex);
		this.refreshUI(); // Other UI dependent on ephemeral state is updated here.
	}

	protected override onGetEphemeralState(): Record<string, unknown> {
		Env.log.d("ReviewView:onGetEphemeralState");

		this.updateEphemeralState({
			currentPageIndex: this.pager.currentIndex,
			scrollPositionForPageIndex: this.pager.currentIndex ?? Num.UInt.create(0),
		});

		return this.eState;
	}

	protected override async onRender(): Promise<void> {
		Env.log.d("ReviewView:onRender");
		this.ratingButtonsContainer?.remove();
		this.ratingButtonsContainer?.empty();
		this.ratingButtonsContainer = undefined;

		// Get review unit data.

		this.reviewState = await this.getNextItem();
		if (this.reviewState === null) {
			this.removeAllPages(true); // The pages are tied to the review state.
			this.refreshUI();
			return;
		}
		const reviewState = this.reviewState;

		// Create review content

		const processors = [new HeadingProcessor(this.settingsManager.settings.hideCardSectionMarker ? 2 : 1)];
		this.contentRenderer.addCustomProcessors(processors);

		const frontIndex = Num.UInt.create(0);
		let frontContainer = this.pager.getPageAtIndex(frontIndex);
		Env.log.view("Will render content page:", frontIndex, frontContainer === null);
		if (frontContainer === null) {
			frontContainer = createDiv();
			await this.contentRenderer.render(
				reviewState.card.frontMarkdown.trim().length > 0 ? reviewState.card.frontMarkdown : "Empty front side",
				frontContainer, {
				sourcePath: reviewState.card.frontID.noteID,
			});
			this.pager.setPageAtIndex(frontIndex, frontContainer);
		}

		const backIndex = Num.UInt.create(1);
		let backContainer = this.pager.getPageAtIndex(backIndex);
		Env.log.view("Will render content page:", backIndex, backContainer === null);
		if (backContainer === null) {
			backContainer = createDiv();
			await this.contentRenderer.render(
				reviewState.card.backMarkdown.trim().length > 0 ? reviewState.card.backMarkdown : "Empty back side",
				backContainer, {
				sourcePath: reviewState.card.backID.noteID,
			});
			this.pager.setPageAtIndex(backIndex, backContainer);
		}

		this.contentRenderer.removeCustomProcessors(processors);

		this.displayPageAtIndex(this.pager.currentIndex ?? Num.UInt.create(0));

		// Create additional UI components.

		const nextItems = this.scheduler.previewNextItem(reviewState.reviewedItem.statistics, reviewState.date).map(nextItem => ({
			info: this.scheduler.getItemInfo({ id: reviewState.reviewedItem.id, statistics: nextItem.stat }),
			item: nextItem,
		}));
		const ratingButtonsContainer = createRatingButtons(nextItems, reviewState, this.state.sortOrder, (button: HTMLButtonElement, rating: Rating) => {
			this.contentRenderer.registerDomEvent(button, "click", () => this.rate(rating));
		});
		this.ratingButtonsContainer = this.dom.contentEl.appendChild(ratingButtonsContainer);

		if (this.state.showMetadata && !this.pager.isAtLastIndex) {
			const info = this.scheduler.getItemInfo(reviewState.reviewedItem);
			createMetadataEl(reviewState, this.state.sortOrder, info, this.dom.create, (button) => {
				this.contentRenderer.registerDomEvent(button, "click", () => new ReviewItemInfoModal(this.app, reviewState, this.state.sortOrder, info).open());
			});
		}

		this.refreshUI();
	}

	/** Currently assumes that {@link getNextItem} returns the same item again. */
	private reloadView() {
		// Currently first page is loaded if the pager has no `currentIndex`.
		this.removeAllPages(true);
		this.render();
	}

	/** Tries to set {@link reviewedItem} and {@link currentCard}. */
	private async getNextItem() {
		Env.log.d("ReviewView:getNextItem");

		const nextItemOptions = (relativeDate: Date): NextReviewItemOptions => {
			const totalDueBefore = new Map<Date, number>();

			const noon = new Date(relativeDate);
			noon.setHours(12, 0, 0, 0);
			if (relativeDate.getTime() < noon.getTime())
				totalDueBefore.set(noon, 0);

			const eightPM = new Date(relativeDate);
			eightPM.setHours(20, 0, 0, 0);
			if (relativeDate.getTime() < eightPM.getTime())
				totalDueBefore.set(eightPM, 0);

			const fourAMNextDay = new Date(relativeDate);
			fourAMNextDay.setDate(fourAMNextDay.getDate() + 1);
			fourAMNextDay.setHours(4, 0, 0, 0);
			totalDueBefore.set(fourAMNextDay, 0);

			return {
				sortOrder: this.state.sortOrder,
				totalDueBefore: this.state.sortOrder === "due" ? totalDueBefore : undefined,
				totalRetrievabilityBelow: this.state.sortOrder === "retrievability" ? new Map<number, number>([[0.85, 0], [0.90, 0], [0.95, 0]]) : undefined,
			};
		};

		const getReviewState = async (): Promise<ReviewState | null> => {
			const cards = this.data.getAllCardsForDeck(this.deck?.id);

			if (cards.length === 0) {
				Env.log.view("ReviewView:getNextItem: cards.length === 0");
				this.dom.create.para({
					text: `There are no cards in ${this.deck ? `the deck named ${this.deck.data.n}` : "this vault"}.`
				});
				return null;
			}

			const now = new Date();
			const options = nextItemOptions(now);
			const reviewedItem = this.scheduler.getNextItem(cards, now, options);

			if (!reviewedItem) {
				this.dom.create.para({ text: `No more cards at the moment. All ${cards.length} cards ${this.deck ? `under ${this.deck.data.n}` : "in this vault"} are done.` });
				return null;
			}

			Env.assert(Str.nonEmpty(reviewedItem.id.cardID) !== undefined, "Card expected");
			if (Str.nonEmpty(reviewedItem.id.cardID) === undefined)
				return null;

			const contentResult = await ContentParser.getCard(reviewedItem.id, this.app, {
				contentRead: {
					hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker
				},
				likelyNoteIDs: this.data.getAllNotes() // Only notes that contain declarations
			});

			if (contentResult.complete === null) {
				if (contentResult.incomplete !== null)
					this.dom.create.para({ text: `"${reviewedItem.id.toString()}" does not have a ${contentResult.incomplete.backMarkdown ? "back" : "front"} side.` });
				else
					this.dom.create.para({ text: `Could not find content of "${reviewedItem.id.cardID}" in "${reviewedItem.id.noteID}".` });

				return null;
			}

			return {
				reviewedItem,
				date: now,
				card: contentResult.complete,
				numberOfItems: cards.length,
				totalDueBefore: options.totalDueBefore,
				totalRetrievabilityBelow: options.totalRetrievabilityBelow
			};
		};

		const handleError = (error: unknown) => {
			Env.log.e("ReviewView:getNextItem:handleError:", error);

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (error instanceof FileParserError && error.type === "file cache unavailable") {

				this.dom.create.para({ text: `Cannot display card because "${error.file.path}" is not indexed.` });
				this.dom.create.paraWrapper().createEl("button", { text: "Reload Obsidian" }, (el) => {
					this.registerDomEvent(el, "click", () => { InternalApi.reloadApp(this.app); })
				});
			}
			else if (error instanceof Error) {
				this.dom.create.para({ text: error.message });
			}
			else {
				this.dom.create.para({ text: "Could not retrieve content" });
			}
		}

		let rs: ReviewState | null = null;

		try {
			rs = await getReviewState();
		} catch (error: unknown) {
			handleError(error);
		}

		return rs;
	}

	private async rate(rating: Rating) {
		Env.log.d("ReviewView:rate", rating);

		const item = this.reviewState?.reviewedItem;
		Env.assert(item !== undefined);
		if (item === undefined)
			return;

		this.removeAllPages(true);

		// Use now as scheduling date rather than the date of rendering to avoid items being scheduled as due in the past, e.g., when next interval is 1 min.
		this.scheduler.rateItem(item.id, rating);
		await this.data.save(); // This will trigger a refresh via the registered change callback.

		this.ui.displayNotice(`You rated ${ReviewItemInfo.Convert.ratingAsString(rating)}`, { prefix: false });
	}

	private displayNextContentItem() {
		Env.log.d("ReviewView:displayNextContentItem");
		const nextIndex = this.pager.nextIndexUp;
		Env.dev?.assert(nextIndex !== null);
		if (nextIndex !== null)
			this.displayPageAtIndex(nextIndex);
		this.refreshUI();
	}

	private displayPageAtIndex(index: UnsignedInteger): boolean {
		Env.log.d("ReviewView:displayContentAtIndex:", index, "review", this.reviewState);

		Num.UInt.assert(index);
		if (!Num.UInt.is(index))
			return false;

		if (this.reviewState === null)
			return false;

		const currentIndex = this.pager.currentIndex;
		if (index === currentIndex)
			return false;

		// Save scroll position before DOM change.
		this.updateEphemeralState({ scrollPositionForPageIndex: currentIndex ?? undefined });

		const contentToDisplay = this.pager.getPageAtIndex(index); // TODO: create content here.
		if (contentToDisplay === null)
			return false;

		const currentContent = currentIndex !== null ? this.pager.getPageAtIndex(currentIndex) : null;

		// First time appending.
		if (currentContent === null) {
			this.dom.contentEl.appendChild(contentToDisplay);
		}
		else {
			Env.assert(currentContent.parentElement); // Uncaught NotFoundError: Failed to execute 'replaceChild' on 'Node': The node to be replaced is not a child of this node.
			this.dom.contentEl.replaceChild(contentToDisplay, currentContent);
		}

		Env.dev?.assert(this.pager.currentIndex === index);
		this.updateEphemeralState({ currentPageIndex: index });

		return true;
	}

	/**
		* Removes all cached pages/divs created from the last review unit.
		*
		* @param includeEphemeralState Explicitly declare intent to reset ephemeral state
		*/
	private removeAllPages(includeEphemeralState: boolean) {
		this.pager.removeAllPages();
		if (includeEphemeralState)
			this.resetEphemeralState();
	}

	/** Updates the state to reflect the state of its dependent UI components. */
	private updateEphemeralState(p: {
		currentPageIndex?: UnsignedInteger | null,
		/** The page index to set the current scroll position to. */
		scrollPositionForPageIndex?: UnsignedInteger
	}) {
		Env.log.d("ReviewView:updateEphemeralState:", p);

		if (Num.UInt.is(p.currentPageIndex) || p.currentPageIndex === null) {
			this.eState.contentIndex = p.currentPageIndex;
		}

		if (Num.UInt.is(p.scrollPositionForPageIndex)) {
			if (p.scrollPositionForPageIndex === 0)
				this.eState.frontScrollPosition = this.scrollPosition.top;
			if (p.scrollPositionForPageIndex === 1)
				this.eState.backScrollPosition = this.scrollPosition.top;
		}

		Env.log.view("ReviewView:updateEphemeralState: Updated ephemeral state:", this.eState);
	}

	private resetEphemeralState() {
		Env.log.d("ReviewView:resetEphemeralState");
		this.eState = { ...DEFAULT_ESTATE };
	}

	/** Replace with {@link ContentUnit.isAtLastIndex} when supporting more than two pages. Currently only used where two pages is hardcoded. */
	private get isShowingBackSide() {
		return this.pager.currentIndex === 1;
	}

	private refreshUI() {
		Env.log.d("ReviewView:refreshUI");

		if (this.reviewState !== null) {
			if (this.displayNextContentButton) {
				const props = this.forwardBackwardButtonProps();
				setTooltip(this.displayNextContentButton, props.title);
				setIcon(this.displayNextContentButton, props.icon);
				this.displayNextContentButton.show();
			}
		}
		else {
			this.displayNextContentButton?.hide();
		}

		if (this.pager.isAtLastIndex) {
			this.ratingButtonsContainer?.show();
			this.setRatingButtonWidths();
		}
		else {
			this.ratingButtonsContainer?.hide();
		}

		this.setScrollPosition({
			top: this.isShowingBackSide ? this.eState.backScrollPosition : this.eState.frontScrollPosition,
			behavior: "instant"
		});
	}

	private forwardBackwardButtonProps() {
		return {
			title: this.isShowingBackSide ? "View front" : "View back",
			icon: this.isShowingBackSide ? Icon.CARD_FRONT : Icon.CARD_BACK,
		}
	}

	/**
		* Set the width on all rating buttons to the width of the widest button based on its content.
		*
		* - Requires that the button's initial `width` style is set to `"auto"`.
		*/
	private setRatingButtonWidths() {
		Env.log.d("ReviewView:setRatingButtonWidths");

		if (!this.ratingButtonsContainer)
			return;

		if (this.ratingButtonsContainer.dataset.didAdjustButtons)
			return;

		// The container needs to be in the DOM otherwise widths may not be available.
		if (!this.ratingButtonsContainer.isShown())
			return;

		const ratingButtons = this.ratingButtonsContainer.querySelectorAll("button");
		if (ratingButtons.length === 0)
			return;

		let maxWidth = 0;
		ratingButtons.forEach((btn) => {
			const width = btn.offsetWidth;
			if (width > maxWidth)
				maxWidth = width;
		});
		ratingButtons.forEach(btn => btn.setCssProps({ "width": maxWidth + "px" }));

		this.ratingButtonsContainer.dataset.didAdjustButtons = "yes";
	}

	/**
	 * @returns The {@link TFile} where the currently displayed side is declared; `null` if there's no side dislayed or if the file couldn't be found.
	 */
	private sourceFile(): TFile | null | undefined {
		Env.log.d("ReviewView:sourceFile");
		if (this.reviewState === null)
			return null;
		return this.app.vault.getFileByPath(this.isShowingBackSide ? this.reviewState.card.backID.noteID : this.reviewState.card.frontID.noteID);
	}
}
