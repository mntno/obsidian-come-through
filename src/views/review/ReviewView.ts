import { CssClass } from "#/constants";
import { DataStore } from "#/data/DataStore";
import { Env } from "#/env";
import { t } from "#/Localization";
import { ReviewItemInfoModal } from "#/modals/ReviewItemInfoModal";
import { HeadingProcessor } from "#/renderings/content/HeadingProcessor";
import { ReviewItemInfo } from "#/scheduling/ReviewItemInfo";
import { Scheduler } from "#/scheduling/Scheduler";
import { NextReviewItemOptions, Rating, ReviewSortOrder } from "#/scheduling/types";
import { SettingsManager } from "#/Settings";
import { OmitIndexSignature, UnsignedInteger } from "#/types";
import { Icon } from "#/ui/constants";
import { UIAssistant } from "#/ui/UIAssistant";
import { UnexpectedUndefinedError } from "#/utils/errors";
import { Api } from "#/utils/obs/api";
import { El } from "#/utils/obs/dom";
import { FileParserError } from "#/utils/obs/FileParser";
import { InternalApi } from "#/utils/obs/internal";
import { Arr, Bln, Num, Obj, Str, Union } from "#/utils/ts";
import { BaseView, BaseViewEphemeralState, BaseViewState } from "#/views/BaseView";
import { ContentUnit } from "#/views/review/ContentUnit";
import { createMetadataEl, createRatingButtons } from "#/views/review/elements";
import { ItemReviewProviderError, ReviewItemProvider, ReviewProviderConfig, ReviewProviderError, ReviewProviderErrors, ReviewProviderFactory } from "#/views/review/providers";
import { ReviewState } from "#/views/review/types";
import { IconName, Keymap, KeymapEventListener, Menu, PaneType, setIcon, setTooltip, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";

declare global {
	interface DOMStringMap {
		didAdjustButtons?: import("#/utils/ts").BoolStr;
	}
}

interface ReviewViewState extends BaseViewState {
	providerConfig: ReviewProviderConfig | null;
	showMetadata: boolean;
	sortOrder: ReviewSortOrder;
}

interface ReviewViewEphemeralState extends BaseViewEphemeralState {
	contentIndex: UnsignedInteger | null;
	frontScrollPosition: number;
	backScrollPosition: number;
};

const DEFAULT_STATE: OmitIndexSignature<ReviewViewState> = {
	providerConfig: null,
	showMetadata: false,
	sortOrder: "due",
} as const;

const DEFAULT_ESTATE: OmitIndexSignature<ReviewViewEphemeralState> = {
	contentIndex: null,
	frontScrollPosition: 0,
	backScrollPosition: 0
} as const;

export class ReviewView extends BaseView<ReviewViewState> {

	public static readonly TYPE = "come-through-view-review";
	public static createViewState(config: ReviewProviderConfig | null): ReviewViewState {
		Env.log.d("ReviewView:createViewState: config:", config);
		return BaseView.withDefaultViewState({
			...DEFAULT_STATE,
			providerConfig: config,
		} satisfies OmitIndexSignature<ReviewViewState>);
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

	private provider: ReviewItemProvider | undefined;

	private ratingButtonsContainer?: HTMLDivElement;
	private displayNextContentButton?: HTMLElement;

	public constructor(
		leaf: WorkspaceLeaf,
		settingsManager: SettingsManager,
		scheduler: Scheduler,
		ui: UIAssistant,
		data: DataStore) {
		Env.log.d("ReviewView:constructor");
		super(leaf, settingsManager, {
			data: data,
			paneMenu: {
				addReloadItem: () => {
					this.removeAllPages(true); // Currently first page is loaded if the pager has no `currentIndex`.
				},
			},
			scope: {
				register: (app, scope) => {
					const onDisplayNextContentItem: KeymapEventListener = () => {
						this.displayNextContentItem();
						return false;
					};

					const rate = (rating: Rating) => {
						const f = this.getFacade();
						if (f !== null && f.rate !== null)
							f.rate(rating).catch(Env.catch);
					};

					scope.register(null, " ", onDisplayNextContentItem);
					scope.register(null, "Enter", onDisplayNextContentItem);
					if (!InternalApi.addEventHandlerToExistingKeyMap(app, scope, "markdown:toggle-preview", onDisplayNextContentItem))
						scope.register(["Mod"], "E", onDisplayNextContentItem);

					scope.register(null, "1", () => rate(Rating.Again));
					scope.register(null, "2", () => rate(Rating.Hard));
					scope.register(null, "3", () => rate(Rating.Good));
					scope.register(null, "4", () => rate(Rating.Easy));
				},
			},
		});

		this.scheduler = scheduler;
		this.ui = ui;
		this.data = data;

		this.pager = new ContentUnit(2);
	}

	/** @async Await if to operate after the view has been rendered. */
	public async setSortOrder(sortOrder: ReviewSortOrder) {
		this.state.sortOrder = sortOrder;
		this.removeAllPages(true);
		this.saveState();
		await this.render();
	}

	/**
		* @returns `null` if it is not possible to call any of the methods.
		*/
	public getFacade() {
		if (this.reviewState === null)
			return null;
		const reviewState = this.reviewState;

		return {

			/**
			 * @async Await if to operate after the file has been opened.
			 * @returns `null` if source file cannot be opened.
			 */
			openSourceFile: Api.File.is(this.sourceFile()) ? async (newLeaf?: PaneType | boolean) => {
				const sourceFile = this.sourceFile();
				if (sourceFile) {
					const leaf = this.app.workspace.getLeaf(newLeaf);
					await leaf.openFile(sourceFile, { state: undefined, eState: undefined, active: true, group: undefined });
				}
			} : null,

			/** @async Await if you need the updated data. */
			rate: this.pager.isAtLastIndex ? async (rating: Rating) => await this.rate(rating) : null,

			reviewState: reviewState,
			reviewItemInfo: () => this.scheduler.getItemInfo(reviewState.reviewedItem),

			sortOrder: this.state.sortOrder,

			/** @returns `null` if metadata cannot be shown. */
			toggleShowMetadata: this.pager.currentIndex !== null ? () => {
				this.state.showMetadata = !this.state.showMetadata;
				this.saveState();
				this.render().catch(Env.catch);
			} : null,
		};
	}

	public override getIcon(): IconName {
		return Icon.View.REVIEW;
	}

	public override getViewType(): string {
		return ReviewView.TYPE;
	}

	public override getDisplayText(): string {
		return this.provider !== undefined ? this.provider.getDisplayText() : "Review";
	}

	public override onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | (string & {})): void {
		super.onPaneMenu(menu, source);

		if (source === "tab-header")
			return;

		const prefix = false;
		const section = Api.Menu.Section.Pane;
		const action = this.getFacade();

		this.ui.addMenuItem(menu, `Order by retrievability`, {
			section: section,
			icon: "arrow-up-down",
			prefix: prefix,
			checked: this.state.sortOrder === "retrievability",
			onClick: () => void this.setSortOrder(this.state.sortOrder === "retrievability" ? "due" : "retrievability").catch(Env.catch),
		});

		if (action !== null && action.openSourceFile !== null) {
			this.ui.addMenuItem(menu, `Open source note`, {
				section: section,
				icon: "file-code-2",
				prefix: prefix,
				onClick: evt => void action.openSourceFile?.(Keymap.isModEvent(evt)).catch(Env.catch)
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
	}

	protected override async onOpen(): Promise<void> {
		Env.log.d("ReviewView:onOpen");
		await super.onOpen();

		if (Env.isMobile)
			this.interactionAssistant.registerDoubleClick(this.contentEl, () => this.displayNextContentItem());

		const props = this.forwardBackwardButtonProps();
		this.displayNextContentButton = this.addAction(props.icon, props.title, () => this.displayNextContentItem());
	}

	protected override onSetState(state: ReviewViewState, _result: ViewStateResult): void {
		Env.log.d("ReviewView:onSetState", state);

		const applyState = (overrides: Partial<ReviewViewState> = {}) => {
			this.state = { ...DEFAULT_STATE, ...state, ...overrides };
			this.provider = ReviewProviderFactory.create(this.state.providerConfig, {
				app: this.app,
				data: this.data,
				scheduler: this.scheduler,
				settings: this.settingsManager.settings
			});
		};

		if (state.reason === "init") {
			applyState({
				// Makes sense to retain these "settings" when the same leaf is reused, i.e., when user chooses to review something else in the same tab.
				sortOrder: this.state.sortOrder,
				showMetadata: this.state.showMetadata
			});
			this.removeAllPages(true);
		} else {
			applyState();
		}
	}

	protected override onGetState(): ReviewViewState {
		Env.log.d("ReviewView:onGetState");
		return {
			...this.state,
			providerConfig: this.provider !== undefined ? this.provider.getConfig() : null,
		} satisfies OmitIndexSignature<ReviewViewState>;
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
		Env.log.d("ReviewView:onRender", this.state);
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

	private async getNextItem(): Promise<ReviewState | null> {
		Env.log.view("ReviewView:getNextItem", "provider", this.provider);
		if (this.provider === undefined)
			return null;

		const calculateDueBefore = (relativeDate: Date): Map<Date, number> => {
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

			return totalDueBefore;
		};

		const handleError = (error: unknown) => {
			Env.log.e("ReviewView:getNextItem:handleError:", error);

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- As of now there's just one `error.type`.
			if (error instanceof FileParserError && error.type === "file cache unavailable") {
				this.dom.create.p(`Cannot display card because "${error.file.path}" is not indexed.`);
				this.dom.create.div({ wrapperClasses: ["flex justify-center"] , o: { cls: ["flex gap-4"]} }, (el) => {
					El.create(el, "button", { text: "Reload views" }, (el) => {
						this.registerDomEvent(el, "click", (evt) => this.reload(evt))
					});
					El.create(el, "button", { text: "Reload Obsidian" }, (el) => {
						this.registerDomEvent(el, "click", () => InternalApi.reloadApp(this.app))
					});
				});
			}
			else if (error instanceof Error) {
				this.dom.create.p(error.message);
			}
			else {
				this.dom.create.p("Could not retrieve content");
			}
		}

		const handleProviderError = (error: ReviewProviderError) => {
			const specificError = ReviewProviderError.cast(error);

			Union.match(error.info, "code", {
				"no-data-items": (_info) => {
					if (specificError.type === "item") {
						this.dom.create.p(`The requested ${specificError.items.size} review units do not exist`)
					}
					else {
						const suffix = Union.match<Exclude<ReviewProviderErrors, ItemReviewProviderError>, "type", string>(specificError, "type", {
							"all": (_e) => "this vault.",
							"deck": (e) => {
								return `the ${Obj.numKeys(e.items) === 1 ? "deck" : "decks"} named ${Object.values(e.items).map(d => d.n).join(", ")}.`;
							},
							"file": (e) => `${e.items.length === 1 ? "this file" : `these ${e.items.length} files`}.`,
						});
						this.dom.create.p(`There is no review content defined in ${suffix}`);
					}
				},
				"no-review-items": (info) => {
					const suffix = Union.match<ReviewProviderErrors, "type", string | DocumentFragment>(specificError, "type", {
						"all": (_e) => `in this vault are done.`,
						"item": (_e) => `are done.`,
						"deck": (e) => `under ${Object.values(e.items).map(d => d.n).join(", ")} are done.`,
						"file": (e) => {

							if (e.items.length === 1) {
								const file = Api.File.get(this.app.vault, Arr.firstOrThrow(e.items));
								if (file !== null) {
									const fragment = this.dom.create.node.fragment();
									fragment.appendChild(this.dom.create.node.text('in '));
									fragment.appendChild(this.dom.create.fileLink(file, this, this.app));
									fragment.appendChild(this.dom.create.node.text(' are done.'));
									return fragment;
								}
							}

							return `in "${e.items.length === 1 ? e.items[0] : String(e.items.length)}${e.items.length > 1 ? " files" : ""}" are done.`
						}
					});

					this.dom.create.p({
						o: {
							text: `No more cards at the moment. All ${String(info.cards.length)} cards `,
						},
						createdCallback: (p) => {
							if (Str.is(suffix))
								p.appendText(suffix);
							else
								p.appendChild(suffix);
						}
					});
				},
				"incomplete-declaration": (info) => {
					this.dom.create.p(`Could not find content of "${info.reviewedItem.id.cardID}" in "${info.reviewedItem.id.noteID}".`);
				},
				"content-not-found": (info) => {
					this.dom.create.p(`"${info.reviewedItem.id.toString()}" does not have a ${info.incomplete.backMarkdown === undefined ? "back" : "front"} side.`);
				},
				"unexpected": (info) =>
					this.dom.create.p(info.message),
			});
		};

		let rs: ReviewState | null = null;
		const now = new Date();
		const options: NextReviewItemOptions = {
			sortOrder: this.state.sortOrder,
			totalDueBefore: this.state.sortOrder === "due" ? calculateDueBefore(now) : undefined,
			totalRetrievabilityBelow: this.state.sortOrder === "retrievability" ? new Map<number, number>([[0.85, 0], [0.90, 0], [0.95, 0]]) : undefined,
		};

		try {
			const result = await this.provider.getNextItem(now, options);
			if (result instanceof ReviewProviderError)
				handleProviderError(result);
			else
				rs = result;
		} catch (error) {
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

		this.ui.notify.info(`You rated ${ReviewItemInfo.Convert.ratingAsString(rating)}`, { prefix: false });
	}

	private displayNextContentItem() {
		Env.log.d("ReviewView:displayNextContentItem", this.reviewState);
		if (this.reviewState === null)
			return;

		const nextIndex = this.pager.nextIndexUp;
		Env.dev?.assert(nextIndex !== null);
		if (nextIndex !== null)
			this.displayPageAtIndex(nextIndex);
		this.refreshUI();
	}

	/**
		* Gets the avalable content from the pager and inserts it into the DOM, replacing the current content.
		*/
	private displayPageAtIndex(index: UnsignedInteger): boolean {
		Env.log.d("ReviewView:displayPageAtIndex:", index, "review", this.reviewState);

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
			Env.assert(currentContent.parentElement !== null); // Uncaught NotFoundError: Failed to execute 'replaceChild' on 'Node': The node to be replaced is not a child of this node.
			this.dom.contentEl.replaceChild(contentToDisplay, currentContent);
		}

		Env.dev?.assert(this.pager.currentIndex === index);
		this.updateEphemeralState({ currentPageIndex: index });

		return true;
	}

	/**
		* Removes all cached pages/divs created from the last review unit.
		*
		* Sometimes you want to call render to build additional components, like the info view, without rebuilding the review content.
		* Even if {@link BaseView.render} removes all content, the created pages are still retained/cached in the {@link pager} and inserted.
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

	/** Adjusts the UI components (such as buttons, scrollbar) based on the current state. */
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

		if (Bln.isTrueStr(this.ratingButtonsContainer.dataset.didAdjustButtons))
			return;

		// The container needs to be in the DOM otherwise widths may not be available.
		if (!this.ratingButtonsContainer.isShown())
			return;

		const ratingButtons = this.ratingButtonsContainer.querySelectorAll("button");
		if (ratingButtons.length === 0)
			return;

		let maxWidth = 0;
		let minContentWidth = Infinity;

		ratingButtons.forEach((btn) => {
			const width = btn.offsetWidth;
			if (width > maxWidth)
				maxWidth = width;

			// Find the button whose content/text is of minimum width, this is used to widen the button if the radius is too large.
			const firstChild = btn.firstElementChild;
			if (firstChild instanceof HTMLElement && firstChild.offsetWidth < minContentWidth)
				minContentWidth = firstChild.offsetWidth;
		});

		// The width of the wides button is now found.
		// But before setting this width, check that the current radius (set by the Obsidian theme) is not so large that the button becomes a circle.
		// If the radius is too large, adjust the width to avoid the circular appearance.
		const firstBtn = ratingButtons[0];
		if (firstBtn === undefined)
			throw new UnexpectedUndefinedError();
		const borderRadius = parseFloat(getComputedStyle(firstBtn).borderRadius);
		const minDimension = Math.min(maxWidth, firstBtn.offsetHeight);
		if (borderRadius >= minDimension / 2) // Radius is to large relative to the buttons dimensions. For example, a true circle results from a square button (equal width and height) with a radius of half that size.
			maxWidth = borderRadius * 2 + (minContentWidth === Infinity ? 2 : minContentWidth) * 0.5; //"borderRadius * 2" is the width that makes it a circle, then whatever is added will make up the horizontal border.

		ratingButtons.forEach(btn => btn.setCssProps({ [CssClass.View.Review.Var.RATING_BUTTON_WIDTH]: maxWidth + "px" }));

		this.ratingButtonsContainer.dataset.didAdjustButtons = "true";
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
