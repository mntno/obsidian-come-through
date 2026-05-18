import { ContentParser } from "#/ContentParser";
import { DataStore } from "#/data/DataStore";
import { Env } from "#/env";
import { t } from "#/Localization";
import { ContentRenderOptions } from "#/renderings/content/ContentRenderer";
import { HeadingProcessor } from "#/renderings/content/processors/HeadingProcessor";
import { OmitIndexSignature } from "#/types";
import { Icon } from "#/ui/constants";
import { Api } from "#/utils/obs/api";
import { Arr, Str } from "#/utils/ts";
import { BaseView, BaseViewState, } from "#/views/BaseView";
import { ContentParserViewContext } from "#/views/types";
import { IconName, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";

export interface DefinedContentViewState extends BaseViewState {
	/** Paths will be updated if the file is renamed or deleted. See {@link DefinedContentViewState.onFileRename} */
	readonly filePaths: string[];
}

const DEFAULT_STATE: OmitIndexSignature<DefinedContentViewState> = {
	filePaths: []
} as const;

export class DefinedContentView extends BaseView<DefinedContentViewState, ContentParserViewContext> {

	public static readonly TYPE = "come-through-view-defined-content";
	public static createViewState(file: TFile | TFile[]): DefinedContentViewState {
		Env.log.d("DefinedContentView:createViewState", Env.log.NT, file);
		return BaseView.withDefaultViewState({
			...DEFAULT_STATE,
			filePaths: Arr.is(file) ? file.map(f => f.path) : [file.path],
		} satisfies OmitIndexSignature<DefinedContentViewState>);
	}

	private state: DefinedContentViewState = { ...DEFAULT_STATE };

	private files: TFile[] = [];
	/** These paths did not correspond to any valid files. */
	private invalidPaths: string[] = [];

	/**
		* @param data Used to receive data changed notifications.
		*/
	constructor(leaf: WorkspaceLeaf, ctx: ContentParserViewContext, data: DataStore) {
		super(leaf, ctx, {
			data: {
				subscribeToChanges: true,
				data: data,
			},
			paneMenu: {
				addReloadItem: true
			},
		});
	}

	public override getIcon(): IconName {
		return Icon.View.DEFINED_CONTENT;
	}

	public override getViewType(): string {
		return DefinedContentView.TYPE;
	}

	public override getDisplayText(): string {
		return t.views.declarations.title(this.files);
	}

	public override onload(): void {
		super.onload();

		// Note that the data change callback will also be called on file rename.
		// The "rename" event will be called first.
		// The difference is that when there's a rename event, we want to update the display text.
		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			if (Api.File.is(file))
				await this.onFileRename(file, oldPath);
		}));

		this.registerEvent(this.app.vault.on("delete", async (file) => {
			if (Api.File.is(file))
				await this.onFileDelete(file);
		}));
	}

	protected override onSetState(state: DefinedContentViewState, _result: ViewStateResult): void {
		this.state = { ...DEFAULT_STATE, ...state };
		this.files = [];
		this.invalidPaths = [];

		for (const path of state.filePaths) {
			const file = this.app.vault.getFileByPath(path);
			if (file !== null)
				this.files.push(file);
			else
				this.invalidPaths.push(path);
		}

		this.files.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	protected override onGetState(): DefinedContentViewState {
		return {
			...this.state,
		} satisfies OmitIndexSignature<DefinedContentViewState>;
	}

	protected override onDataChanged(): void {
		// On file rename, this will be called superflously.
		// But since this case is a rare and the solution to avoid the extra render call is too ugly, because of lack of obsidian APIs, it's not worth it implementing.
		// So let it call render two times.
	};

	private onFileRename = async (file: TFile, oldPath: string) => {
		Env.log.d("DefinedContentView:onFileRename", file, oldPath);

		const pathIndex = this.state.filePaths.indexOf(oldPath);
		if (pathIndex === -1) // A file was renamed that is not relevant.
			return;

		this.state.filePaths[pathIndex] = file.path;
		await this.reinitiate(DefinedContentView.TYPE, true); // Repopulate and render everything.
	};

	private onFileDelete = async (file: TFile) => {
		Env.log.d("DefinedContentView:onFileDelete", file);

		const pathIndex = this.state.filePaths.indexOf(file.path);
		if (pathIndex === -1) // A file was deleted that is not relevant.
			return;

		this.state.filePaths.splice(pathIndex, 1);
		await this.reinitiate(DefinedContentView.TYPE, true); // Repopulate and render everything.
	};

	protected override async onRender(): Promise<void> {
		if (Arr.isEmpty(this.state.filePaths)) {
			this.dom.create.p(t.views.declarations.fileNotSet);
			return;
		}

		const files = this.files;

		if (Arr.isNonEmpty(this.invalidPaths)) {
			const pathsLog = this.invalidPaths.join(", ");

			if (Arr.isEmpty(files))
				Env.log.e(`No valid paths: ${this.invalidPaths.length} invalid paths found: ${pathsLog}`);
			else
				Env.log.e(`Found ${this.invalidPaths.length} invalid paths: ${pathsLog}`);

			this.dom.create.p(t.views.declarations.fileNotSet);
		}

		// <summary> is styled as a <h2>, this will normalize its children to start at <h3>.
		this.contentRenderer.setCustomProcessors([new HeadingProcessor(this.ctx.processorConfig.heading(3))]);

		// Keeps track of which details elements have been dynamically created on expand.
		const hasRendered = new WeakMap<HTMLDetailsElement, boolean>();

		let totalContentDefinitions = 0;
		let totalIncompleteDefinitions = 0;

		this.dom.create.h(1, t.views.declarations.title(files));
		const infoPara = this.dom.create.paraWrapper();

		for (const file of files) {
			let fileContentDefinitions = 0;
			let fileIncompleteDefinitions = 0;

			if (files.length > 1)
				this.dom.create.h(2, file.basename);

			const fileInfoPara = this.dom.create.paraWrapper();

			const options: ContentRenderOptions = {
				sourcePath: file.path,
			};

			const parsedContent = await ContentParser.getCardFromFile(file, this.app, this.ctx.contentParserConfig.getParseOptions());

			for (const parsedUnit of Object.values(parsedContent)) {

				if (parsedUnit.complete !== null) {
					const completeUnit = parsedUnit.complete;
					this.createDefinedContentBlockSection(hasRendered, `${completeUnit.frontID.cardID}: Front`, completeUnit.frontMarkdown, options);
					this.createDefinedContentBlockSection(hasRendered, `${completeUnit.backID.cardID}: Back`, completeUnit.backMarkdown, options);
					fileContentDefinitions += 2;
				}
				else if (parsedUnit.incomplete !== null) {
					const incompleteUnit = parsedUnit.incomplete;

					if (incompleteUnit.frontID) {
						this.createDefinedContentBlockSection(hasRendered, `${incompleteUnit.frontID.cardID}: Front (incomplete)`, incompleteUnit.frontMarkdown, options);
						fileIncompleteDefinitions += 1;
					}
					if (incompleteUnit.backID) {
						this.createDefinedContentBlockSection(hasRendered, `${incompleteUnit.backID.cardID}: Back (incomplete)`, incompleteUnit.backMarkdown, options);
						fileIncompleteDefinitions += 1;
					}
				}
			}

			const fileLink = this.app.fileManager.generateMarkdownLink(file, Str.EMPTY /* custom view has no sourcePath */);
			const fileMarkdownText = fileLink +
				` contains declarations that define ${fileContentDefinitions + fileIncompleteDefinitions} pages` +
				`${fileIncompleteDefinitions > 0 ? " (" + fileIncompleteDefinitions + " incomplete)" : ""}` +
				`, amounting to ${fileContentDefinitions / 2} complete review units.`;

			await this.contentRenderer.render(fileMarkdownText, fileInfoPara, { sourcePath: Str.EMPTY });

			totalContentDefinitions += fileContentDefinitions;
			totalIncompleteDefinitions += fileIncompleteDefinitions;
		}

		if (files.length > 1) {
			const markdownText =
				`These ${files.length} files contain declarations that define ${totalContentDefinitions + totalIncompleteDefinitions} pages` +
				`${totalIncompleteDefinitions > 0 ? " (" + totalIncompleteDefinitions + " incomplete)" : ""}` +
				`, amounting to ${totalContentDefinitions / 2} complete review units.`;

			await this.contentRenderer.render(markdownText, infoPara, { sourcePath: Str.EMPTY });
		}
	}

	private createDefinedContentBlockSection(hasRendered: WeakMap<HTMLDetailsElement, boolean>, summary: string, content?: string, options?: ContentRenderOptions) {
		this.dom.create.el("details", undefined, (detailsEl) => {
			detailsEl.createEl("summary", { text: summary });
			const contentDiv = detailsEl.createDiv();
			this.contentRenderer.registerDomEvent(detailsEl, "toggle", async () => {
				if (detailsEl.open && !hasRendered.has(detailsEl)) {
					hasRendered.set(detailsEl, true);
					if (content)
						await this.contentRenderer.render(content, contentDiv, options);
				}
				// else if (!detailsEl.open && this.hasRendered.has(detailsEl)) {
				// 	contentDiv.empty();
				// 	this.hasRendered.delete(detailsEl);
				// }
			});
		});
	}
}
