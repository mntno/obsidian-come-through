export class ViewAssistant {

	private markdownViewRootEl: HTMLDivElement | undefined;
	private previewSizerEl: HTMLDivElement | undefined;

	public init(viewRootEl: HTMLElement) {
		this.deinit();

		this.markdownViewRootEl = viewRootEl.createDiv({ cls: "markdown-reading-view" }, (readerViewEl) => {
			readerViewEl.createDiv({ cls: ViewAssistant.markdownPreviewClasses }, (previewViewEl) => {
				this.previewSizerEl = previewViewEl.createDiv({ cls: ViewAssistant.markdownSizer }, (el) => {
					el.createDiv({ cls: ViewAssistant.markdownPusher });
					el.createDiv({ cls: ViewAssistant.markdownMod });
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

	public createH1(o: DomElementInfo | string) {
		this.contentEl.createDiv({ cls: "el-h1" }, el => {
			el.createEl("h1", o);
		});
	}

	public createPara(o: DomElementInfo | string) {
		this.contentEl.createDiv({ cls: "el-p" }, el => {
			el.createEl("p", o);
		});
	}

	public createTable() {
		const container = this.contentEl.createDiv({
			cls: "el-table",
			attr: {
				//"dir": "ltr"
			}
		});
		return container.createEl("table");
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
}
