import { ContentParser, ParsedCard } from "ContentParser";
import { DataStore, DeckIDDataTuple, StatisticsData } from "DataStore";
import { Env } from "env";
import { FileParserError } from "FileParser";
import { DeckID, FullID } from "FullID";
import { InternalApi } from "InternalApi";
import { Keymap, KeymapEventListener, Menu, Scope, setIcon, setTooltip, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { HeadingProcessor } from "renderings/content/HeadingProcessor";
import { Scheduler } from "Scheduler";
import { SettingsManager } from "Settings";
import { Grade, IPreview, Rating, show_diff_message, State, TypeConvert } from "ts-fsrs";
import { CARD_BACK_ICON as BACK_ICON, CARD_FRONT_ICON as FRONT_ICON, PLUGIN_ICON, UIAssistant } from "UIAssistant";
import { BaseView, BaseViewState } from "views/BaseView";

export interface ReviewViewState extends BaseViewState {
	deckID?: DeckID;
	showMetadata: boolean;
}

export class ReviewView extends BaseView<ReviewViewState> {

	public static readonly TYPE = "come-through-view-review";
	public static createViewState(deckID: DeckID | undefined, showMetadata: boolean = false): ReviewViewState {
		return {
			deckID: deckID,
			showMetadata: showMetadata,
		} satisfies ReviewViewState;
	}

	private readonly data: DataStore;
	private readonly ui: UIAssistant;
	private readonly scheduler: Scheduler;

	constructor(
		leaf: WorkspaceLeaf,
		settingsManager: SettingsManager,
		scheduler: Scheduler,
		ui: UIAssistant,
		data: DataStore) {
		super(leaf, settingsManager, {
			data: data,
		});

		this.scheduler = scheduler;
		this.ui = ui;
		this.data = data;

		this.reviewDate = new Date(); // Will be refreshed as each item is presented.

		this.navigation = true;
		this.scope = new Scope(this.app.scope);

		const toggleFrontBackEventListener: KeymapEventListener = (_evt, _ctx) => {
			this.toggleAnswer();
			return false;
		};

		const rate = (grade: Grade) => {
			if (this.reviewedItem && this.eState.showBackSide)
				this.rate(this.reviewedItem.id, grade);
		};

		this.scope.register(null, " ", toggleFrontBackEventListener);
		this.scope.register(null, "Enter", toggleFrontBackEventListener);
		if (!InternalApi.addEventHandlerToExistingKeyMap(this.app, this.scope, "markdown:toggle-preview", toggleFrontBackEventListener))
			this.scope.register(["Mod"], "E", toggleFrontBackEventListener);

		this.scope.register(null, "1", () => rate(Rating.Again));
		this.scope.register(null, "2", () => rate(Rating.Hard));
		this.scope.register(null, "3", () => rate(Rating.Good));
		this.scope.register(null, "4", () => rate(Rating.Easy));

		this.scope.register(["Mod"], "R", this.refreshView);
	}

	public override getIcon() {
		return PLUGIN_ICON;
	}

	public getViewType() {
		return ReviewView.TYPE;
	}

	public getDisplayText() {
		return this.deck ? `Review: ${this.deck.data.n}` : "Review";
	}

	public override onload(): void {
		super.onload();

		if (Env.isMobile)
			this.registerDomEvent(this.contentEl, "dblclick", () => { this.toggleAnswer(); });
	}

	public override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string) {
		super.onPaneMenu(menu, source);

		if (source === "tab-header")
			return;

		const file = this.sourceFile();
		if (!file)
			return;

		this.ui.addMenuItem(menu, `Open source note`, {
			section: "pane",
			icon: "file-code-2",
			prefix: false,
			onClick: async evt => {
				const leaf = this.app.workspace.getLeaf(Keymap.isModEvent(evt));
				await leaf.openFile(file, { state: undefined, eState: undefined, active: true, group: undefined });
			}
		});

		this.ui.addMenuItem(menu, `Show metadata`, {
			section: "pane",
			icon: "file-text",
			prefix: false,
			checked: this.showMetadata,
			onClick: () => {
				this.showMetadata = !this.showMetadata;
				this.saveState();
				this.refreshView();
			}
		});

		this.ui.addMenuItem(menu, "Reload", {
			section: "pane",
			icon: "refresh-cw",
			prefix: false,
			onClick: this.refreshView
		});
	}

	protected async onOpen() {
		await super.onOpen();

		this.toggleAnswerButton = this.addAction(
			this.eState.showBackSide ? FRONT_ICON : BACK_ICON,
			this.eState.showBackSide ? "View front" : "View back",
			() => this.toggleAnswer());

		this.frontContainer = createDiv();
		this.backContainer = createDiv();
	}

	protected onSetState(state: ReviewViewState, result: ViewStateResult): void {
		this.deck = state.deckID ? {
			id: state.deckID,
			data: this.data.getDeck(state.deckID, true)!
		} : undefined;
		this.showMetadata = state.showMetadata;

		this.resetEphemeralState();
	}

	protected onGetState(): ReviewViewState {
		return {
			deckID: this.deck?.id,
			showMetadata: this.showMetadata,
		}
	}

	/**
	 * @returns The {@link TFile} where the currently displayed side is declared, `undefined` if there's no side dislayed, `null` if the file couldn't be found.
	 */
	private sourceFile(): TFile | null | undefined {
		return this.eState.currentCard && this.app.vault.getFileByPath(this.eState.showBackSide ? this.eState.currentCard.backID.noteID : this.eState.currentCard.frontID.noteID);
	}

	private deck?: DeckIDDataTuple;
	private showMetadata = false;

	/** The current item in review.  */
	private reviewedItem?: { id: FullID, statistics: StatisticsData } | null;
	private reviewDate: Date;

	private readonly eState = {
		currentCard: null as ParsedCard | null,
		/** If `true` then currently showing the answer. */
		showBackSide: false,
		lastFrontScrollPosition: 0,
		lastBackScrollPosition: 0
	};

	/** Where the front side's DOM is appened to. */
	private frontContainer: HTMLDivElement;
	/** Where the back side's DOM is appened to. */
	private backContainer: HTMLDivElement;

	private ratingButtonsContainer?: HTMLDivElement;
	private toggleAnswerButton?: HTMLElement;

	protected async onRender() {
		this.frontContainer.remove();
		this.frontContainer.empty();
		this.backContainer.remove();
		this.backContainer.empty();
		this.ratingButtonsContainer?.remove();
		this.ratingButtonsContainer?.empty();
		this.ratingButtonsContainer = undefined;

		const onAbort = () => {
			this.toggleAnswerButton?.hide();
			this.resetEphemeralState();
		};

		try {

			const cards = this.data.getAllCardsForDeck(this.deck?.id);
			if (cards.length == 0) {
				this.viewAssistant.createPara({
					text: `There are no cards in ${this.deck ? `the deck named ${this.deck.data.n}` : "this vault"}.`
				});
				onAbort();
				return;
			}

			this.reviewDate = new Date();
			this.reviewedItem = this.scheduler.getNextItem(cards, this.reviewDate);

			if (!this.reviewedItem) {
				this.viewAssistant.createPara({ text: `No more cards at the moment. All ${cards.length} cards ${this.deck ? `under ${this.deck.data.n}` : "in this vault"} are done.` });
				onAbort();
				return;
			}

			console.assert(this.reviewedItem.id.cardID, "Card expected.");
			if (this.reviewedItem.id.cardID === undefined) {
				onAbort();
				return;
			}

			const maybeCompleteCard = await ContentParser.getCard(this.reviewedItem.id, this.app, {
				contentRead: {
					hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker
				},
				likelyNoteIDs: this.data.getAllNotes() // Only notes that contain declarations
			});

			if (maybeCompleteCard.complete === null) {
				if (maybeCompleteCard.complete === null && maybeCompleteCard.incomplete === null)
					this.viewAssistant.createPara({ text: `Could not find content of "${this.reviewedItem.id.cardID}" in "${this.reviewedItem.id.noteID}".` });
				if (maybeCompleteCard.incomplete !== null)
					this.viewAssistant.createPara({ text: `"${this.reviewedItem.id.toString()}" does not have a ${!maybeCompleteCard.incomplete.backMarkdown ? "back" : "front"} side.` });
				onAbort();
				return;
			}

			this.eState.currentCard = maybeCompleteCard.complete;

		} catch (error: unknown) {
			this.handleError(error);
			onAbort();
			return;
		}

		const parsedCard = this.eState.currentCard;
		const processors = [new HeadingProcessor(this.settingsManager.settings.hideCardSectionMarker ? 2 : 1)];

		this.contentRenderer.addCustomProcessors(processors);

		await this.contentRenderer.render(
			parsedCard.frontMarkdown.trim().length > 0 ? parsedCard.frontMarkdown : "Empty front side",
			this.frontContainer, {
			sourcePath: parsedCard.frontID.noteID,
		});

		await this.contentRenderer.render(
			parsedCard.backMarkdown.trim().length > 0 ? parsedCard.backMarkdown : "Empty back side",
			this.backContainer, {
			sourcePath: parsedCard.backID.noteID,
		});

		this.contentRenderer.removeCustomProcessors(processors);

		this.viewAssistant.contentEl.appendChild(this.eState.showBackSide ? this.backContainer : this.frontContainer);

		const nextItems = this.scheduler.previewNextItem(this.reviewedItem.statistics, this.reviewDate);
		const ratingButtonsContainer = createDiv({ cls: "rating-buttons" });
		this.createRatingButtons(nextItems, ratingButtonsContainer);
		this.ratingButtonsContainer = this.viewAssistant.contentEl.appendChild(ratingButtonsContainer);
		if (!this.eState.showBackSide)
			ratingButtonsContainer.hide();

		this.toggleAnswerButton?.show();

		if (this.showMetadata)
			this.renderMetadata();

		this.setRatingButtonWidths();
	}

	private createRatingButtons(nextItems: IPreview, ratingButtonsContainer: HTMLDivElement) {
		// If width is not sufficient for four buttons on one line, this container is used to make two buttons wrap instead of one at the time.
		let pairContainer: HTMLDivElement | null = null;
		const ratingButtons: HTMLButtonElement[] = [];

		for (const { log: nextLog, card: nextCard } of nextItems) {

			if (ratingButtons.length % 2 == 0 || pairContainer === null)
				pairContainer = ratingButtonsContainer.createDiv({ cls: "button-pair" });

			ratingButtons.push(pairContainer.createEl("button", undefined, (button) => {
				setTooltip(button, `${TypeConvert.time(nextCard.due).toString()}`)
				const buttonText = button.createDiv();
				buttonText.createSpan({
					text: Rating[nextLog.rating],
				});
				buttonText.createSpan({
					text: `${show_diff_message(nextCard.due, this.reviewDate, true, this.timeUnit)}`,
				});

				this.contentRenderer.registerDomEvent(button, "click", async () => {
					if (this.reviewedItem)
						await this.rate(this.reviewedItem.id, nextLog.rating as Grade);
				})
			}));
		}
	}

	private handleError(error: unknown) {
		if (error instanceof FileParserError) {
			if (error.type === "file cache unavailable") {

				this.viewAssistant.createPara({
					text: `Cannot display card because "${error.file.path}" is not indexed.`
				});

				const reloadButton = this.viewAssistant
					.createPara()
					.createEl("button", { text: "Reload Obsidian" });

				this.registerDomEvent(reloadButton, "click", async () => {
					InternalApi.reloadApp(this.app);
				})
			}
		}
		else if (error instanceof Error) {
			this.viewAssistant.createPara({ text: error.message });
		} else {
			this.viewAssistant.createPara({ text: `Unexpected error` });
		}
		Env.error(error);
	}

	private async rate(id: FullID, grade: Grade) {
		// Use now as scheduling date rather than the date of rendering to avoid items being scheduled as due in the past, e.g., when next interval is 1 min.
		this.scheduler.rateItem(id, grade);
		this.ui.displayNotice(`You rated ${Rating[grade]}`);
		this.resetEphemeralState();
		await this.data.save(); // This will trigger a refresh via the registered change callback.
	}

	private resetEphemeralState() {
		this.eState.showBackSide = false;
		this.eState.lastFrontScrollPosition = 0;
		this.eState.lastBackScrollPosition = 0;
		this.eState.currentCard = null;
	}

	private toggleAnswer() {
		const scrollPosition = this.scrollPosition;

		if (this.displayCard(!this.eState.showBackSide)) {
			this.eState.showBackSide = !this.eState.showBackSide

			if (this.eState.showBackSide)
				this.eState.lastFrontScrollPosition = scrollPosition.top;
			else
				this.eState.lastBackScrollPosition = scrollPosition.top;

			this.setScrollPosition({
				top: this.eState.showBackSide ? this.eState.lastBackScrollPosition : this.eState.lastFrontScrollPosition,
				behavior: "instant"
			});
		}
	}

	private displayCard(showFront: boolean) {
		if (!this.reviewedItem)
			return false;

		if (showFront) {
			// Uncaught NotFoundError: Failed to execute 'replaceChild' on 'Node': The node to be replaced is not a child of this node.
			console.assert(this.frontContainer.parentElement);
			this.viewAssistant.contentEl.replaceChild(this.backContainer, this.frontContainer);
			this.ratingButtonsContainer?.show();
		}
		else {
			console.assert(this.backContainer.parentElement);
			this.viewAssistant.contentEl.replaceChild(this.frontContainer, this.backContainer);
			this.ratingButtonsContainer?.hide();
		}

		if (this.toggleAnswerButton) {
			setTooltip(this.toggleAnswerButton, showFront ? "View front" : "View back");
			setIcon(this.toggleAnswerButton, showFront ? FRONT_ICON : BACK_ICON);
		}

		this.setRatingButtonWidths();

		return true;
	}

	/**
		* Set the width on all rating buttons to the width of the widest button based on its content.
		*
		* - Requires that the button's initial `width` style is set to `"auto"`.
		*/
	private setRatingButtonWidths() {

		if (!this.ratingButtonsContainer)
			return;

		if (this.ratingButtonsContainer.dataset.didAdjustButtons)
			return;

		// The container needs to be in the DOM otherwise widths may not be available.
		if (!this.ratingButtonsContainer.isShown())
			return;

		const ratingButtons = this.ratingButtonsContainer.querySelectorAll("button");
		if (!ratingButtons)
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

	private renderMetadata() {
		if (!this.eState.currentCard || !this.reviewedItem)
			return;

		const stats = this.reviewedItem.statistics;

		const el = this.viewAssistant.contentEl.createDiv({ cls: "statistics" });
		el.createEl("span", { text: `IDs: ${this.eState.currentCard.frontID} / ${this.eState.currentCard.backID}` });
		el.createEl("span", { text: `State: ${State[stats.st]} (${stats.st})` });
		el.createEl("span", { text: `${this.scheduler.isStatisticsDue(stats, this.reviewDate) ? "Due now" : "Not yet due:"}: ${TypeConvert.time(stats.due).toString()}` });
		if (stats.lr) {
			el.createEl("span", { text: `Last review: ${TypeConvert.time(stats.lr).toString()}` });
		}

		el.createEl("span", { text: `Retrievability: now: ${this.scheduler.retrievability(stats, this.reviewDate)}, @due: ${this.scheduler.retrievability(stats, stats.due)}` });
		el.createEl("span", { text: `Learning steps: ${stats.ls}` });
		el.createEl("span", { text: `Scheduled days: ${stats.sd}` });
		el.createEl("span", { text: `Lapses: ${stats.l}` });
	}

	private readonly timeUnit = [' sec', ' min', ' hours', ' days', ' months', ' years'];
}
