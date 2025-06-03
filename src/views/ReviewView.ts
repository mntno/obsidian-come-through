import { ContentParser, ParsedCard } from "ContentParser";
import { DeckID, FullID } from "FullID";
import { App, Component, ItemView, Keymap, KeymapEventListener, MarkdownRenderer, Menu, Scope, setIcon, setTooltip, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { Scheduler } from "Scheduler";
import { SettingsManager } from "Settings";
import { DeckIDDataTuple, DataStore, StatisticsData } from "DataStore";
import { Grade, Rating, show_diff_message, State, TypeConvert } from "ts-fsrs";
import { CARD_BACK_ICON as BACK_ICON, PLUGIN_ICON, CARD_FRONT_ICON as FRONT_ICON, UIAssistant } from "UIAssistant";
import { ViewAssistant } from "views/ViewAssistant";
import { InternalApi } from "InternalApi";
import { FileParserError } from "FileParser";

export interface IReviewViewState {
	deckID?: DeckID;
	showMetadata: boolean;
}

export class ReviewView extends ItemView {

	public static readonly TYPE = "come-through-view-review";

	constructor(
		leaf: WorkspaceLeaf,
		private readonly settingsManager: SettingsManager,
		private readonly scheduler: Scheduler,
		private readonly ui: UIAssistant,
		private readonly data: DataStore) {
		super(leaf);

		this.navigation = true;
		this.scope = new Scope(this.app.scope);
		this.reviewDate = new Date(); // Will be refreshed as each item is presented.

		//#region Hotkeys

		const toggleFrontBackEventListener: KeymapEventListener = (_evt, _ctx) => {
			this.toggleAnswer();
			return false;
		};

		const rate = (grade: Grade) => {
			if (this.reviewedItem && this.showBackSide)
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

		//#endregion
	}

	//#region

	getIcon() {
		return PLUGIN_ICON;
	}

	getViewType() {
		return ReviewView.TYPE;
	}

	getDisplayText() {
		return this.deck ? `${this.deck.data.n} deck review` : "Review";
	}

	onResize(): void {
	}

	onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string) {
		super.onPaneMenu(menu, source);

		const file = this.sourceFile();
		if (!file)
			return;

		this.ui.addMenuItem(menu, `Go to declaration`, {
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
			onClick: evt => {
				this.showMetadata = !this.showMetadata;
				this.app.workspace.requestSaveLayout();
				this.render();
			}
		});
	}

	protected async onOpen() {
		this.data.registerOnChangedCallback(this.onDataChangedCallback);
		this.addAction("refresh-cw", "Reload", this.refreshView);

		this.toggleAnswerButton = this.addAction(
			this.showBackSide ? FRONT_ICON : BACK_ICON,
			this.showBackSide ? "View front" : "View back",
			() => this.toggleAnswer());

		this.contentEl.empty();
		this.viewAssistant.init(this.contentEl);

		this.frontContainer = createDiv();
		this.backContainer = createDiv();
	}

	protected async onClose() {
		this.data.unregisterOnChangedCallback(this.onDataChangedCallback);
		this.viewAssistant.deinit();
		await this.recycleMarkdownResources();
	}

	public override getState() {
		return {
			deckID: this.deck?.id,
			showMetadata: this.showMetadata,
		} satisfies IReviewViewState;
	}

	public override async setState(state: IReviewViewState, result: ViewStateResult) {

		this.deck = state.deckID ? {
			id: state.deckID,
			data: this.data.getDeck(state.deckID, true)!
		} : undefined;
		this.showMetadata = state.showMetadata;

		await this.render();
		await super.setState(state, result);
	}

	//#endregion

	/**
	 * @returns The {@link TFile} where the currently displayed side is declared, `undefined` if there's no side dislayed, `null` if the file couldn't be found.
	 */
	private sourceFile(): TFile | null | undefined {
		return this.currentCard && this.app.vault.getFileByPath(this.showBackSide ? this.currentCard.backID.noteID : this.currentCard.frontID.noteID);
	}

	private onDataChangedCallback = () => {
		this.refreshView();
	};

	private refreshView = () => {
		this.showBackSide = false;
		this.render();
	};

	//#region

	private deck?: DeckIDDataTuple;
	private showMetadata = false;

	private readonly viewAssistant = new ViewAssistant();

	/** The current item in review.  */
	private reviewedItem?: { id: FullID, statistics: StatisticsData } | null;
	private reviewDate: Date;

	private currentCard: ParsedCard | null;

	/** If `true` then currently showing the answer. */
	private showBackSide = false;

	/** Where the front side's DOM is appened to. */
	private frontContainer: HTMLDivElement;
	/** Where the back side's DOM is appened to. */
	private backContainer: HTMLDivElement;

	private markdownRenderComponent?: Component;

	private ratingButtonsContainer?: HTMLDivElement;
	private toggleAnswerButton?: HTMLElement;

	private async render() {
		this.viewAssistant.empty();

		const abort = () => {
			this.toggleAnswerButton?.hide();
		};

		try {

			const cards = this.data.getAllCardsForDeck(this.deck?.id);
			if (cards.length == 0) {
				this.viewAssistant.createPara({
					text: `There are no cards in ${this.deck ? `the deck named ${this.deck.data.n}` : "this vault"}.`
				});
				abort();
				return;
			}

			this.reviewDate = new Date();
			this.reviewedItem = this.scheduler.getNextItem(cards, this.reviewDate); // Not necessarily deterministic.

			if (!this.reviewedItem) {
				this.viewAssistant.createPara({ text: `No more cards at the moment. All ${cards.length} cards ${this.deck ? `under ${this.deck.data.n}` : "in this vault"} are done.` });
				abort();
				return;
			}

			console.assert(this.reviewedItem.id.cardID, "Card expected.");
			if (this.reviewedItem.id.cardID === undefined) {
				abort();
				return;
			}

			const maybeCompleteCard = await ContentParser.getCard(
				this.reviewedItem.id,
				this.app,
				{
					contentRead: {
						hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker
					},
					likelyNoteIDs: this.data.getAllNotes()
				}
			);

			if (maybeCompleteCard.complete === null) {
				if (maybeCompleteCard.complete === null && maybeCompleteCard.incomplete === null)
					this.viewAssistant.createPara({ text: `Could not find content of "${this.reviewedItem.id.cardID}" in "${this.reviewedItem.id.noteID}".` });
				if (maybeCompleteCard.incomplete !== null)
					this.viewAssistant.createPara({ text: `"${this.reviewedItem.id.toString()}" does not have a ${!maybeCompleteCard.incomplete.backMarkdown ? "back" : "front"} side.` });
				abort();
				return;
			}

			this.currentCard = maybeCompleteCard.complete;

		} catch (error: unknown) {
			this.handleError(error);
			abort();
			return;
		}

		const parsedCard = this.currentCard;
		const nextItems = this.scheduler.previewNextItem(this.reviewedItem.statistics, this.reviewDate);
		const ratingButtonsContainer = createDiv({ cls: "come-through-rating-buttons" });

		await this.recycleMarkdownResources(async (frontContainer, backContainer, component) => {

			await ReviewView.renderMarkdown(this.app, parsedCard.frontMarkdown.trim().length > 0 ? parsedCard.frontMarkdown : "Empty front side", frontContainer, parsedCard.frontID.noteID, component);
			await ReviewView.renderMarkdown(this.app, parsedCard.backMarkdown.trim().length > 0 ? parsedCard.backMarkdown : "Empty back side", backContainer, parsedCard.backID.noteID, component);

			//#region Rating buttons

			for (const { log: nextLog, card: nextCard } of nextItems) {
				ratingButtonsContainer.createEl("button", undefined, (button) => {
					setTooltip(button, `${TypeConvert.time(nextCard.due).toString()}`)
					const buttonText = button.createDiv();
					buttonText.createSpan({
						text: Rating[nextLog.rating],
						cls: "rating-button-text"
					});
					buttonText.createSpan({
						text: `${show_diff_message(nextCard.due, this.reviewDate, true, this.timeUnit)}`,
						cls: "rating-button-interval"
					});

					component.registerDomEvent(button, "click", async () => {
						if (this.reviewedItem)
							await this.rate(this.reviewedItem.id, nextLog.rating as Grade);
					})
				});
			}
			ratingButtonsContainer.hide();

			//#endregion
		});

		this.toggleAnswerButton?.show();
		this.viewAssistant.contentEl.appendChild(this.showBackSide ? this.backContainer : this.frontContainer);
		this.ratingButtonsContainer = this.viewAssistant.contentEl.appendChild(ratingButtonsContainer);

		if (this.showMetadata)
			this.renderMetadata();
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
	}

	private async rate(id: FullID, grade: Grade) {
		// Use now as scheduling date rather than the date of rendering to avoid items being scheduled as due in the past, e.g., when next interval is 1 min.
		this.scheduler.rateItem(id, grade);
		this.ui.displayNotice(`You rated ${Rating[grade]}`);

		await this.data.save(); // This will trigger a refresh
		//this.refreshView();
	}

	private toggleAnswer() {
		if (this.displayCard(!this.showBackSide))
			this.showBackSide = !this.showBackSide
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

		return true;
	}

	private renderMetadata() {
		if (!this.currentCard || !this.reviewedItem)
			return;

		const stats = this.reviewedItem.statistics;

		const el = this.viewAssistant.contentEl.createDiv({ cls: "statistics" });
		el.createEl("span", { text: `IDs: ${this.currentCard.frontID} / ${this.currentCard.backID}` });
		el.createEl("span", { text: `State: ${State[stats.st]} (${stats.st})` });
		el.createEl("span", { text: `${this.scheduler.isStatisticsDue(stats, this.reviewDate) ? "Due now" : "Not yet due:"}: ${TypeConvert.time(stats.due).toString()}` });
		if (stats.lr) {
			el.createEl("span", { text: `Last review: ${TypeConvert.time(stats.lr).toString()}` });
		}

		el.createEl("span", { text: `Retrievability: now: ${this.scheduler.retrievability(stats, this.reviewDate)}, @due: ${this.scheduler.retrievability(stats, stats.due)}` });
		el.createEl("span", { text: `Elapsed days: ${stats.ed}` });
		el.createEl("span", { text: `Scheduled days: ${stats.sd}` });
		el.createEl("span", { text: `Lapses: ${stats.l}` });
	}

	private readonly timeUnit = [' sec', ' min', ' hours', ' days', ' months', ' years'];

	//#endregion

	//#region Markdown

	private static async renderMarkdown(app: App, markdown: string, el: HTMLElement, filePath: string, component: Component) {

		await MarkdownRenderer.render(app, markdown, el, filePath, component);

		// External links works but not internal.
		// https://forum.obsidian.md/t/internal-links-dont-work-in-custom-view/90169/3
		el.querySelectorAll('a.internal-link').forEach(internalLinkEl => {
			if (internalLinkEl instanceof HTMLElement) {
				const handler = async (event: MouseEvent) => {
					event.preventDefault();
					const href = (event.currentTarget as HTMLAnchorElement).getAttribute('href');
					if (href)
						app.workspace.openLinkText(href, filePath, false); // false = same tab
				};
				component.registerDomEvent(internalLinkEl, "click", handler);
			}
		});
	}

	/**
	 * Recycles {@link frontContainer} and {@link backContainer} and their event listeners.
	 */
	private async recycleMarkdownResources(reuseCallback?: (front: HTMLElement, back: HTMLElement, component: Component) => Promise<void>) {

		this.frontContainer.remove();
		this.frontContainer.empty();
		this.backContainer.remove();
		this.backContainer.empty();

		this.markdownRenderComponent?.unload();
		this.markdownRenderComponent = undefined;

		if (reuseCallback) {
			this.markdownRenderComponent = new Component();
			this.markdownRenderComponent.load();
			await reuseCallback(this.frontContainer, this.backContainer, this.markdownRenderComponent);
		}
	}
}
