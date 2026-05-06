import { DataStore } from "#/data/DataStore";
import { Env } from "#/env";
import { t } from "#/Localization";
import { DeckModal } from "#/modals/DeckModal";
import { SettingsManager } from "#/Settings";
import { OmitIndexSignature } from "#/types";
import { Icon } from "#/ui/constants";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";
import { CssClass } from "#/utils/obs/constants";
import { St } from "#/utils/ts";
import { BaseView, BaseViewState } from "#/views/BaseView";
import { DeckID } from "data/FullID";
import { IconName, Menu, setIcon, setTooltip, ViewStateResult, WorkspaceLeaf } from "obsidian";

interface CollectionsViewState extends BaseViewState {
	selectedIDs: DeckID[];
}

const DEFAULT_STATE: OmitIndexSignature<CollectionsViewState> = {
	selectedIDs: [],
} as const;

export class DecksView extends BaseView<CollectionsViewState> {

	public static readonly TYPE = "come-through-view-coll";

	public static createViewState(): CollectionsViewState {
		Env.log.view("CollectionsView:createViewState");
		return BaseView.withDefaultViewState({
			...DEFAULT_STATE,
		});
	}

	private state: CollectionsViewState = { ...DEFAULT_STATE };
	private readonly data: DataStore;

	private selectedIds = new Set<DeckID>();
	private reviewSelectedButton: HTMLButtonElement | null = null;
	private selectAllCheckbox: HTMLInputElement | null = null;

	constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, data: DataStore) {
		Env.log.view("CollectionsView:constructor");
		super(leaf, settingsManager, {
			data: data,
			paneMenu: {
				addReloadItem: true,
			},
		});
		this.data = data;
	}

	public override getIcon(): IconName {
		return Icon.View.COLLECTIONS;
	}

	public override getViewType(): string {
		return DecksView.TYPE;
	}

	public override getDisplayText(): string {
		Env.log.view("CollectionsView:getDisplayText");
		return "Decks";
	}

	protected override onSetState(state: BaseViewState, _result: ViewStateResult): void {
		this.state = { ...DEFAULT_STATE, ...state };
		this.selectedIds = new Set(this.state.selectedIDs);
	}

	protected override onGetState(): CollectionsViewState {
		return {
			...this.state,
			selectedIDs: St.toArr(this.selectedIds),
		} satisfies OmitIndexSignature<CollectionsViewState>;
	}

	protected override async onRender(): Promise<void> {
		Env.log.view("CollectionsView:onRender");

		const collections = this.data.collection.all();
		const collectionIDs = collections.map(c => c.id);
		const allItemsInCollection = this.data.item.allInCollection(collectionIDs);

		//this.dom.create.el("h1", { text: "Decks" });
		this.dom.create.div({ o: "icon" }, (el) => setIcon(el, Icon.View.COLLECTIONS));

		this.dom.create.table((section) => {

			const horizontalAlignment = { cls: ["flex", "justify-center"] };

			section.setHeader((row) => {
				row.add((col) => {
					col.add(undefined, (el) => {
						this.selectAllCheckbox = el.createEl("input", { type: "checkbox" }, (checkbox) => {
							setTooltip(checkbox, `Select all for review`);
							checkbox.checked = this.selectedIds.size === collectionIDs.length;
							this.contentRenderer.registerDomEvent(checkbox, "change", () => {
								if (checkbox.checked)
									collectionIDs.forEach(id => this.selectedIds.add(id));
								else
									this.selectedIds.clear();

								section.tableEl.querySelectorAll("tbody td:first-child input[type='checkbox']")
									.forEach((el) => {
										if (el.instanceOf(HTMLInputElement))
											el.checked = this.selectedIds.has(el.value);
									});

								this.refreshReviewBtn();
							});
						});
					});
					col.add({ text: "Name" });
					col.add({ text: "Parent" });
					col.add({ text: "Units" });
					col.add(undefined, (el) => {
						el.createDiv(horizontalAlignment, (div) => {
							div.createEl("button", { cls: CssClass.Component.CLICKABLE_ICON }, (button) => {
								setIcon(button, Icon.Action.ADD);
								setTooltip(button, t.views.collections.addNew);
								this.contentRenderer.registerDomEvent(button, 'click', (_evt: PointerEvent) => DeckModal.add(this.app, this.data));
							});
						});
					});
				});
			});

			section.addBody((row) => {

				for (const coll of collections) {

					const numberOfCardsInDeck = allItemsInCollection.filter(card => this.data.filter.cardsInDeck(coll.id, card)).length;
					const numberOfCardsInDeckIncludingChildren = this.data.getAllCardsForDeck(coll.id).length;
					const col = row.add();

					col.add(undefined, (el) => {
						el.createEl("input", { type: "checkbox", value: coll.id }, (checkbox) => {
							setTooltip(checkbox, `Select "${coll.data.n}" for review`);
							checkbox.checked = this.selectedIds.has(coll.id);
							this.contentRenderer.registerDomEvent(checkbox, "change", () => {
								if (checkbox.checked)
									this.selectedIds.add(coll.id);
								else
									this.selectedIds.delete(coll.id);
								this.selectAllCheckbox!.checked = this.selectedIds.size === collectionIDs.length;
								this.refreshReviewBtn();
							});
						});
					});

					col.add(undefined, (el) => {
						el.createEl("a", { cls: "text-b", text: coll.data.n }, (link) => {
							setTooltip(link, t.views.collections.reviewCollection(coll.data.n));
							this.contentRenderer.registerDomEvent(link, 'click', (evt: PointerEvent) => {
								OpenView.reviewCollection(this.app, coll.id, Api.Event.paneType(evt));
							});
						});
					});

					col.add({
						text: coll.data.p.length == 0 ? "" : coll.data.p
							.map(parentID => this.data.getDeck(parentID))
							.filter(d => d !== null)
							.map(d => d.n)
							.join(", ")
					});

					col.add({ cls: "text-s", text: numberOfCardsInDeck === numberOfCardsInDeckIncludingChildren ? `${numberOfCardsInDeck}` : `${numberOfCardsInDeck} (${numberOfCardsInDeckIncludingChildren})` });
					col.add(undefined, (el) => {

						el.createDiv(horizontalAlignment, (div) => {

							div.createEl("button", { cls: CssClass.Component.CLICKABLE_ICON }, (button) => {

								this.contentRenderer.registerDomEvent(button, 'click', (evt: PointerEvent) => {
									const menu = new Menu();

									menu.addItem((item) => {
										item.setTitle("Edit");
										item.setIcon(Icon.Action.EDIT);
										item.onClick(() => DeckModal.edit(this.app, this.data, coll.id));
									});

									menu.addItem((item) => {
										item.setTitle("Delete");
										item.setIcon(Icon.Action.DELETE);
										item.setDisabled(numberOfCardsInDeck > 0)
										item.onClick(async () => {
											this.data.deleteDeck(coll.id, undefined, true);
											await this.data.save();
										});
									});

									menu.showAtMouseEvent(evt);
								});
								setIcon(button, Icon.MORE);
							});
						});
					});
				}
			});
		});

		const wrapper = ["text-center"];

		this.reviewSelectedButton = this.dom.create.btn({
			wrapperClasses: wrapper,
		}, (button) => {
			this.contentRenderer.registerDomEvent(button, 'click', (evt: PointerEvent) => {
				OpenView.reviewCollection(this.app, St.toArr(this.selectedIds), Api.Event.paneType(evt));
			});
		});
		this.refreshReviewBtn();

		this.dom.create.p({
			o: { text: `There are ${allItemsInCollection.length} review units in a total of ${collections.length} decks.` },
			wrapperClasses: wrapper,
		});

		this.dom.create.btn({
			o: { text: `Review all ${allItemsInCollection.length}` },
			wrapperClasses: wrapper,
		}, (button) => {
			//setIcon(button, Icon.REVIEW);
			setTooltip(button, t.views.collections.reviewAll);
			this.contentRenderer.registerDomEvent(button, 'click', (evt: PointerEvent) => {
				OpenView.reviewCollection(this.app, collectionIDs, Api.Event.paneType(evt));
			});
		});

		const itemsNotInCollection = this.data.collection.filterNot();
		if (itemsNotInCollection.length > 0) {
			this.dom.create.p({
				o: { text: `${(itemsNotInCollection.length == 1 ? "1 unit is" : `${itemsNotInCollection.length} units are`)} not assigned to any deck.`, cls: "italic", },
				wrapperClasses: wrapper,
			});
			this.dom.create.btn({
				o: { text: `Review ${itemsNotInCollection.length} non-assigned` },
				wrapperClasses: wrapper,
			}, (button) => {
				setTooltip(button, t.views.collections.reviewUnassigned);
				this.contentRenderer.registerDomEvent(button, 'click', (evt: PointerEvent) => {
					OpenView.reviewItem(this.app, itemsNotInCollection.map(i => i.id), Api.Event.paneType(evt));
				});
			});
		}
	}

	private refreshReviewBtn() {
		if (this.reviewSelectedButton == null)
			return;
		const count = this.selectedIds.size;
		this.reviewSelectedButton.setText(count > 0 ? "Review " + count + " selected" : "None selected");
		this.reviewSelectedButton.disabled = count === 0;
	}
}
