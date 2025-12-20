import { Env } from "env";
import { ItemView } from "obsidian";
import { UnexpectedUndefinedError } from "utils/errors";
import { CssClass } from "utils/obs/constants";
import { Arr } from "utils/ts";

export class ViewAssistant {

	private markdownViewRootEl: HTMLDivElement | undefined;
	private previewView: HTMLDivElement | undefined;
	private previewSizerEl: HTMLDivElement | undefined;

	public init(view: ItemView) {
		this.deinit();

		this.markdownViewRootEl = view.contentEl.createDiv({ cls: CssClass.MarkdownView.READING }, (readerViewEl) => {
			this.previewView = readerViewEl.createDiv({ cls: Arr.toMutable(CssClass.MarkdownView.PREVIEW) }, (previewViewEl) => {
				this.previewSizerEl = previewViewEl.createDiv({ cls: Arr.toMutable(CssClass.MarkdownView.SIZER) }, (el) => {
					el.createDiv({ cls: Arr.toMutable(CssClass.MarkdownView.PUSHER) });
					el.createDiv({ cls: Arr.toMutable(CssClass.MarkdownView.MOD) });
				});
			});
		});
	}

	/** Undos what {@link init} did. */
	public deinit() {
		if (this.markdownViewRootEl) {
			this.markdownViewRootEl.empty();
			this.markdownViewRootEl = undefined;
			this.previewSizerEl = undefined;
		}
	}

	public empty() {
		if (this.previewSizerEl) {
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
	public get containerEl() {
		if (this.markdownViewRootEl === undefined)
			throw new Error("Not initialized.");
		return this.markdownViewRootEl;
	}

	/** @throws `Error` if {@link init} has not been called. */
	public get contentEl() {
		if (this.previewSizerEl === undefined)
			throw new Error("Not initialized.");
		return this.previewSizerEl;
	}

	public get scrollContainer() {
		return this.previewView;
	}

	public adjustAvailableVerticalScrolling() {
		if (!this.scrollContainer || !this.previewSizerEl)
			return;

		const containerHeight = this.scrollContainer.clientHeight;
		const paddingBottom = Math.floor(containerHeight * 0.5);
		const minHeight = Math.floor(containerHeight * 0.53);

		this.previewSizerEl.setCssStyles({
			"paddingBottom": `${paddingBottom}px`,
			"minHeight": `${minHeight}px`,
		});

		Env.log.view(`ViewAssistant:adjustAvailableVerticalScrolling: \`padding-bottom\`: "${paddingBottom}px", \`min-height\`: "${minHeight}px"`);
	}

}
