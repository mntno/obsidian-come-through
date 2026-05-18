import { CssClass as PluginCssClass } from "#/constants";
import { El } from "#/utils/dom/dom";
import { El as ObsEl } from "#/utils/obs/dom";
import { UnexpectedUndefinedError } from "#/utils/errors";
import { HtmlAttribute, CssClass as ObsCssClass } from "#/utils/obs/constants";
import { InternalApi, InternalApiError } from "#/utils/obs/internal";
import { Arr, Bln, Err } from "#/utils/ts";
import { ItemView } from "obsidian";

/** Knows about the Obsidian specifc DOM structure. */
export class ViewAssistant {

	/** `<div class="workspace-leaf-content …>` */
	private workspaceLeafContentEl: HTMLElement | undefined;
	private markdownViewRootEl: HTMLDivElement | undefined;
	private previewView: HTMLDivElement | undefined;
	private previewSizerEl: HTMLDivElement | undefined;

	public init(view: ItemView) {
		this.deinit();

		this.workspaceLeafContentEl = view.containerEl;
		El.setAttribute(this.workspaceLeafContentEl, HtmlAttribute.Data.MODE, ObsCssClass.Workspace.Data.PREVIEW_MODE);

		this.markdownViewRootEl = view.contentEl.createDiv({ cls: ObsCssClass.MarkdownView.READING }, (readerViewEl) => {
			this.previewView = readerViewEl.createDiv({ cls: Arr.toMutable(ObsCssClass.MarkdownView.Preview.DEFAULT) }, (previewViewEl) => {

				// If failed to get value, add anyway to limit the line witdth in plugin's views.
				const readableLineLength = InternalApi.getConfig(view.app.vault, "readableLineLength");
				if (Bln.isTrue(readableLineLength) || Err.is(readableLineLength, InternalApiError))
					ObsEl.Cls.add(previewViewEl, ObsCssClass.MarkdownView.Preview.IS_READABLE_LINE_WIDTH);

				this.previewSizerEl = previewViewEl.createDiv({ cls: Arr.toMutable(ObsCssClass.MarkdownView.SIZER) }, (el) => {
					el.createDiv({ cls: Arr.toMutable(ObsCssClass.MarkdownView.PUSHER) });
					el.createDiv({ cls: Arr.toMutable(ObsCssClass.MarkdownView.MOD) });
				});
			});
		});
	}

	public get isInitialized(): boolean {
		return this.markdownViewRootEl !== undefined;
	}

	/** Undos what {@link init} did. */
	public deinit() {

		if (this.workspaceLeafContentEl !== undefined) {
			El.removeAttribute(this.workspaceLeafContentEl, HtmlAttribute.Data.MODE);
			this.workspaceLeafContentEl = undefined;
		}

		if (this.markdownViewRootEl) {
			this.markdownViewRootEl.empty();
			this.markdownViewRootEl = undefined;
			this.previewSizerEl = undefined;
		}
	}

	public empty() {
		if (this.previewSizerEl !== undefined) {
			const children = this.previewSizerEl.children;
			for (let i = children.length - 1; i >= 2; i--) {
				const child = children[i];
				if (child === undefined)
					throw new UnexpectedUndefinedError();
				this.previewSizerEl.removeChild(child);
			}
		}
	}

	/** @throws `Error` if {@link init} has not been called. */
	public get workspaceLeafEl() {
		this.throwIfNotInitialized(this.workspaceLeafContentEl);
		return this.workspaceLeafContentEl;
	}

	/** @throws `Error` if {@link init} has not been called. */
	public get containerEl() {
		this.throwIfNotInitialized(this.markdownViewRootEl);
		return this.markdownViewRootEl;
	}

	/** @throws `Error` if {@link init} has not been called. */
	public get contentEl() {
		this.throwIfNotInitialized(this.previewSizerEl);
		return this.previewSizerEl;
	}

	/** @throws `Error` if {@link init} has not been called. */
	public get scrollContainer() {
		this.throwIfNotInitialized(this.previewView);
		return this.previewView;
	}

	public adjustAvailableVerticalScrolling() {

		const containerHeight = this.scrollContainer.clientHeight;
		const paddingBottom = Math.floor(containerHeight * 0.5);
		const minHeight = Math.floor(containerHeight * 0.53);

		this.contentEl.setCssProps({
			[PluginCssClass.View.Var.SCROLL_PADDING]: `${paddingBottom}px`,
			[PluginCssClass.View.Var.SCROLL_MIN_HEIGHT]: `${minHeight}px`,
		});
	}

	private throwIfNotInitialized<T extends HTMLElement | undefined>(el: T): asserts el is Exclude<T, undefined> {
		if (el === undefined)
			throw new Error("Not initialized.");
	}
}
