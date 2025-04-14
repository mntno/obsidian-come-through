import { FileParser, ParsedCard } from "FileParser";
import { FullID } from "FullID";
import { App, Component, ItemView, Keymap, KeymapEventListener, MarkdownRenderer, Menu, Scope, setIcon, setTooltip, TFile, WorkspaceLeaf } from "obsidian";
import { Scheduler, DataItem } from "Scheduler";
import { SettingsManager } from "Settings";
import { StatisticsData } from "Statistics";
import { Grade, Rating, show_diff_message, State, TypeConvert } from "ts-fsrs";
import { CARD_BACK_ICON as BACK_ICON, PLUGIN_ICON, CARD_FRONT_ICON as FRONT_ICON, UIAssistant } from "UIAssistant";

export class ReviewView extends ItemView {

  public static readonly TYPE = "come-through-view-review";

  constructor(leaf: WorkspaceLeaf, private readonly settingsManager: SettingsManager, private readonly scheduler: Scheduler, private readonly ui: UIAssistant) {
    super(leaf);

    this.navigation = true;
    this.scheduler = scheduler;
    this.scope = new Scope(this.app.scope);
    this.reviewDate = new Date();

    const toggleFrontBackEventListener: KeymapEventListener = async (evt, _ctx) => {
      await this.toggleAnswer();
      return false;
    };

    this.toggleAnswerButton = this.addAction(
      this.showBackSide ? FRONT_ICON : BACK_ICON,
      this.showBackSide ? "View front" : "View back", 
      () => this.toggleAnswer());

    //#region Hotkeys

    const rate = (grade: Grade) => {
      if (this.dataItem && this.showBackSide) {
        this.rate(this.dataItem.id, grade);        
      }
    };

    this.scope.register(null, " ", toggleFrontBackEventListener);
    this.scope.register(null, "Enter", toggleFrontBackEventListener);
    this.scope.register(["Mod"], "E", toggleFrontBackEventListener);
    this.scope.register(null, "1", () => rate(Rating.Again));
    this.scope.register(null, "2", () => rate(Rating.Hard));
    this.scope.register(null, "3", () => rate(Rating.Good));
    this.scope.register(null, "4", () => rate(Rating.Easy));

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
    return `Review ${this.numberOfCards} cards`;
  }

  onResize(): void {
  }

  onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string) {
    super.onPaneMenu(menu, source);
    
    const file = this.sourceFile();
    if (!file) 
      return;

    this.ui.addMenuItem(menu, `Open source ${file.basename}`, {
      section: "pane",
      icon: "file",
      prefix: false,
      onClick: async evt => {        
          const leaf = this.app.workspace.getLeaf(Keymap.isModEvent(evt));
          await leaf.openFile(file, { state: undefined, eState: undefined, active: true, group: undefined });        
      }
    });
  }

  /**
   * Called immediately when the view is opened. Usually where the plugin sets up the DOM.
   * Called when the view is opened within a new leaf and is responsible for building the content of your view.
   */
  protected async onOpen() {
    const container = this.contentEl;
    container.empty();

    const readingViewRootEl = container.createDiv({ cls: "markdown-reading-view"});
    this.markdownViewRootEl = ReviewView.createMarkdownViewParentElement(readingViewRootEl);

    this.frontContainer = createDiv();
    this.backContainer = createDiv();  

    await this.refreshView();
  }

  /**
   * Called when the view should close and is responsible for cleaning up any resources used by the view.
   */
  protected async onClose() {
    await this.recycleMarkdownResources();
  }

  //#endregion

  private get numberOfCards() {
    // TODO:
    return this.scheduler.getAllItems().length;
  }

  /** 
   * @returns The {@link TFile} where the currently displayed side is declared, `undefined` if there's no side dislayed, `null` if the file couldn't be found.
   */
  private sourceFile(): TFile | null | undefined {
    return this.currentCard && this.app.vault.getFileByPath(this.showBackSide ? this.currentCard.backID.noteID : this.currentCard.frontID.noteID);
  }

  //#region 

  /** All content goes in here. */
  private markdownViewRootEl: HTMLDivElement;

  /** The current {@link DataItem} */
  private dataItem?: { id: FullID, statistics : StatisticsData } | null;
  
  private currentCard: ParsedCard | null;

  /** If `true` then currently showing the answer. */
  private showBackSide = false;
  
  /** Where the front side's DOM is appened to. */
  private frontContainer: HTMLDivElement;
  /** Where the back side's DOM is appened to. */
  private backContainer: HTMLDivElement;
  /**  */
  private markdownRenderComponent?: Component;
  
  /** Where the rating buttons are added. */
  private ratingButtonsContainer?: HTMLDivElement;
  private toggleAnswerButton: HTMLElement;

  private reviewDate: Date;


  private async refreshView() {
    this.markdownViewRootEl.empty();
    this.markdownViewRootEl.createDiv({cls: ReviewView.markdownPusher});
    this.markdownViewRootEl.createDiv({cls: ReviewView.markdownMod});
    
    this.dataItem = this.scheduler.getNextItem();

    if (!this.dataItem) {
      this.markdownViewRootEl.createEl("span", { text: "No more cards at the moment." });
      this.toggleAnswerButton?.hide();
      return;
    }

    console.assert(this.dataItem.id.cardID, "Card expected.");
    if (this.dataItem.id.cardID === undefined)
      return;

    const maybeCompleteCard = await FileParser.getCard(this.dataItem.id, this.app, { 
      hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker,
      hideDeclarationBlock: true,
    });
    
    if (maybeCompleteCard.complete === null) {
      if (maybeCompleteCard.complete === null && maybeCompleteCard.incomplete === null)
        this.markdownViewRootEl.createEl("span", { text: `${this.dataItem.id.toString()} not found in index.` });
      if (maybeCompleteCard.incomplete !== null)
        this.markdownViewRootEl.createEl("span", { text: `"${this.dataItem.id.toString()}" does not have a ${!maybeCompleteCard.incomplete.backMarkdown ? "back" : "front"} side.` });        
      return;
    }
    
    this.reviewDate = new Date();
    const parsedCard = this.currentCard = maybeCompleteCard.complete;
    const nextItems = this.scheduler.previewNextItem(this.dataItem.statistics, this.reviewDate);
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
            if (this.dataItem)
              await this.rate(this.dataItem.id, nextLog.rating as Grade);
          })
        });
      }
      ratingButtonsContainer.hide();

      //#endregion
    });

    this.markdownViewRootEl.appendChild(this.showBackSide ? this.backContainer : this.frontContainer);
    this.ratingButtonsContainer = this.markdownViewRootEl.appendChild(ratingButtonsContainer);
        
    //this.showData(this.currentCard, this.dataItem.statistics);
  }

  private async rate(id: FullID, grade: Grade) {
    await this.scheduler.rateItem(id, grade, this.reviewDate);
    this.showBackSide = false;
    this.ui.displayNotice(`You rated ${Rating[grade]}`);
    setTimeout(() => this.refreshView().catch(Error), 1);
  }

  private async toggleAnswer() {
    this.showBackSide = !this.showBackSide
    await this.displayCard(this.showBackSide);
  }

  private async displayCard(showFront: boolean) {
    if (showFront) {
      this.markdownViewRootEl.replaceChild(this.backContainer, this.frontContainer);
      this.ratingButtonsContainer?.show();
    }
    else {
      this.markdownViewRootEl.replaceChild(this.frontContainer, this.backContainer);
      this.ratingButtonsContainer?.hide();
    }    
    setTooltip(this.toggleAnswerButton, showFront ? "View front" : "View back");
    setIcon(this.toggleAnswerButton, showFront ? FRONT_ICON : BACK_ICON);
  }

  private showData(card: ParsedCard, statistics: StatisticsData) {

    const el = this.markdownViewRootEl.createDiv({cls: "statistics"});  
    el.createEl("span", { text: `IDs: ${card.frontID} / ${card.backID}` });
    el.createEl("span", { text: `State: ${State[statistics.st]} (${statistics.st})` });
    el.createEl("span", { text: `${Scheduler.isDue(statistics.due) ? "Due now" : "Not yet due:"}: ${TypeConvert.time(statistics.due).toString()}` });
    if (statistics.lr) {
      el.createEl("span", { text: `Last review: ${TypeConvert.time(statistics.lr).toString()}` });
    }
    
    el.createEl("span", { text: `Retrievability: now: ${this.scheduler.retrievability(statistics)}, @due: ${this.scheduler.retrievability(statistics, statistics.due)}` });
    el.createEl("span", { text: `Elapsed days: ${statistics.ed}` });
    el.createEl("span", { text: `Scheduled days: ${statistics.sd}` });  
    el.createEl("span", { text: `Lapses: ${statistics.l}` });
  }

  private readonly timeUnit = [' second', ' min', ' hour', ' day', ' month', ' year'];

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

  private static createMarkdownViewParentElement(parentElement: HTMLElement) {
    const el = parentElement.createDiv({cls: this.markdownPreviewClasses});
    return el.createDiv({cls: this.markdownSizer});
  }

  private static readonly markdownPreviewClasses = [
    "markdown-preview-view",
    "markdown-rendered",
    "node-insert-event",
    "is-readable-line-width",
    "allow-fold-headings",
    "allow-fold-lists",
    "show-indentation-guide",
    "show-properties",
  ];

  private static readonly markdownSizer = [
    "markdown-preview-sizer",
    "markdown-preview-section",
  ];

  private static readonly markdownPusher = [
    "markdown-preview-pusher"
  ];

  private static readonly markdownMod = [
    "mod-header",
    "mod-ui"
  ];

  //#endregion
}

