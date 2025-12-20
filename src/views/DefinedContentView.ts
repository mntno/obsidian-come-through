import { ContentParser } from "ContentParser";
import { DataStore } from "data/DataStore";
import t from "Localization";
import { Menu, Scope, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { HeadingProcessor } from "renderings/content/HeadingProcessor";
import { SettingsManager } from "Settings";
import { BaseView, BaseViewState } from "views/BaseView";

export interface DefinedContentViewState extends BaseViewState {
	filePath?: string;
}

export class DefinedContentView extends BaseView<DefinedContentViewState> {

	public static readonly TYPE = "come-through-view-defined-content";
	public static createViewState(file: TFile): DefinedContentViewState {
		return {
			filePath: file.path,
		};
	}

	/**
		* - `null` if {@link TFile} could not be created from a file path.
		* - `undefined` if for other reasons there is no file.
		*/
	private file: TFile | null | undefined;

	/** Keeps track of which details elements have been dynamically created on expand. */
	private hasRendered: WeakMap<HTMLDetailsElement, boolean>;

	/**
		* @param data Used to receive data changed notifications.
		*/
	constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, data: DataStore) {
		super(leaf, settingsManager, {
			data: data,
		});

		this.navigation = true;
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "R", this.render);
	}

	public override getViewType(): string {
		return DefinedContentView.TYPE;
	}

	public override getDisplayText(): string {
		return t.views.declarations.title(this.file ?? undefined);
	}

	public override onload(): void {
		super.onload();

		// Note that the data change callback will also be called on file rename.
		// The "rename" event will be called first.
		// The difference is that when there's a rename event, we want to update the display text.
		this.registerEvent(this.app.vault.on("rename", this.onFileRename.bind(this)));
	}

	public override onunload(): void {
		super.onunload();
		this.hasRendered = new WeakMap<HTMLDetailsElement, boolean>();
	}

	public override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string): void {
		super.onPaneMenu(menu, source);
		if (source === "tab-header")
			return;

		menu.addItem(item => {
			item.setTitle("Reload");
			item.setSection("pane");
			item.setIcon("refresh-cw");
			item.onClick(this.render);
		});
	}

	protected override onSetState(state: DefinedContentViewState, result: ViewStateResult): void {
		this.file = state.filePath ? this.app.vault.getFileByPath(state.filePath) : undefined;
		this.contentRenderer.file = this.file;
	}

	protected override onGetState(): DefinedContentViewState {
		return {
			filePath: this.file?.path,
		}
	}

	protected override onDataChanged(): void {
		// On file rename, this will be called superflously.
		// But since this case is a rare and the solution to avoid the extra render call is too ugly, because of lack of obsidian APIs, it's not worth it implementing.
		// So let it call render two times.
	};

	private onFileRename = async (file: TFile, oldPath: string) => {

		// When the file is renamed, the `path` of the existing `TFile` reference automatically updates.
		// So this condition is expected to be false. Keep it nonetheless.
		if (this.file && this.file.path === oldPath)
			this.file = file;

		if (this.file && this.file.path === file.path) {
			// This will explicitly tell the WorkspaceLeaf to update its view state,
			// which includes re-evaluating getDisplayText() and updating the tab header with the new file path.
			// However, the title in the "tab title bar" is not updated.
			//
			// `setViewState` calls `setState`, which calls `render` so no need to call `render here`.
			await this.leaf.setViewState({ type: DefinedContentView.TYPE, state: this.getState() });
		}
	};

	protected override async onRender(): Promise<void> {
		if (!this.file) {
			console.error("No file set.")
			this.dom.create.para({ text: t.views.declarations.fileNotSet });
			return;
		}

		// <summary> is styled as a <h2>, this will normalize its children to start at <h3>.
		this.contentRenderer.setCustomProcessors([new HeadingProcessor(3)]);
		this.hasRendered = new WeakMap<HTMLDetailsElement, boolean>();

		this.dom.create.el("h1", { text: t.views.declarations.title(this.file) });
		const infoPara = this.dom.create.paraWrapper();

		const parsedContent = await ContentParser.getCardFromFile(this.file, this.app, {
			contentRead: {
				hideCardSectionMarker: this.settingsManager.settings.hideCardSectionMarker,
			}
		});

		let numberOfContentDefinitions = 0;
		let numberOfIncompleteContentDefinitionsInFile = 0;

		for (const parsedUnit of Object.values(parsedContent)) {

			if (parsedUnit.complete !== null) {
				const completeUnit = parsedUnit.complete;
				this.createDefinedContentBlockSection(`${completeUnit.frontID.cardID}: Front`, completeUnit.frontMarkdown);
				this.createDefinedContentBlockSection(`${completeUnit.backID.cardID}: Back`, completeUnit.backMarkdown);
				numberOfContentDefinitions += 2;
			}
			else if (parsedUnit.incomplete !== null) {
				const incompleteUnit = parsedUnit.incomplete;

				if (incompleteUnit.frontID) {
					this.createDefinedContentBlockSection(`${incompleteUnit.frontID.cardID}: Front (incomplete)`, incompleteUnit.frontMarkdown);
					numberOfIncompleteContentDefinitionsInFile += 1;
				}
				if (incompleteUnit.backID) {
					this.createDefinedContentBlockSection(`${incompleteUnit.backID.cardID}: Back (incomplete)`, incompleteUnit.backMarkdown);
					numberOfIncompleteContentDefinitionsInFile += 1;
				}
			}
		}

		const markdownText = this.app.fileManager.generateMarkdownLink(this.file, "") + // custom view has not sourcePath.
			` contains declarations that defines ${numberOfContentDefinitions + numberOfIncompleteContentDefinitionsInFile} content blocks` +
			`${numberOfIncompleteContentDefinitionsInFile > 0 ? " (" + numberOfIncompleteContentDefinitionsInFile + " incomplete)" : ""}` +
			`, amounting to ${numberOfContentDefinitions / 2} review units.`;

		await this.contentRenderer.render(markdownText, infoPara);
	}

	private createDefinedContentBlockSection(summary: string, content?: string) {
		this.dom.create.el("details", undefined, (detailsEl) => {
			detailsEl.createEl("summary", { text: summary });
			const contentDiv = detailsEl.createDiv();
			this.contentRenderer.registerDomEvent(detailsEl, "toggle", async () => {
				if (detailsEl.open && !this.hasRendered.has(detailsEl)) {
					this.hasRendered.set(detailsEl, true);
					if (content)
						await this.contentRenderer.render(content, contentDiv);
				}
				// else if (!detailsEl.open && this.hasRendered.has(detailsEl)) {
				// 	contentDiv.empty();
				// 	this.hasRendered.delete(detailsEl);
				// }
			});
		});
	}
}
