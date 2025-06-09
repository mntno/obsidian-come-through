import { Env } from "env";
import { ItemView } from "obsidian";
import { CssClass } from "renderings/dom-constants";
import { MarkupAssistant } from "renderings/MarkupAssistant";

export class ViewAssistant {

	private markdownViewRootEl: HTMLDivElement | undefined;
	private previewView: HTMLDivElement | undefined;
	private previewSizerEl: HTMLDivElement | undefined;

	public init(view: ItemView) {
		this.deinit();

		view.containerEl.addClass(CssClass.Plugin.WORKSPACE_LEAF_CONTENT);

		this.markdownViewRootEl = view.contentEl.createDiv({ cls: CssClass.MarkdownView.READING() }, (readerViewEl) => {
			this.previewView = readerViewEl.createDiv({ cls: CssClass.MarkdownView.PREVIEW() }, (previewViewEl) => {
				this.previewSizerEl = previewViewEl.createDiv({ cls: CssClass.MarkdownView.SIZER() }, (el) => {
					el.createDiv({ cls: CssClass.MarkdownView.PUSHER() });
					el.createDiv({ cls: CssClass.MarkdownView.MOD() });
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
			for (let i = children.length - 1; i >= 2; i--)
				this.previewSizerEl.removeChild(children[i]);
		}
	}

	public get contentEl() {
		if (!this.previewSizerEl)
			throw new Error();
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

	public createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
		return MarkupAssistant.createWrappedEl(this.contentEl, tag, o, callback);
	}

	public createPara(o?: DomElementInfo | string) {
		return MarkupAssistant.createWrappedPara(this.contentEl, o);
	}

	public createParaWrapper() {
		return MarkupAssistant.createElWrapper(this.contentEl, "p");
	}

	public createTable() {
		const container = this.contentEl.createDiv({
			cls: MarkupAssistant.classForEl("table"),
			attr: {
				//"dir": "ltr"
			}
		});
		return container.createEl("table");
	}
}
