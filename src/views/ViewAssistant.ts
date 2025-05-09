

export class ViewAssistant {

  public static createMarkdownRoot(el: HTMLElement) {
    const readingViewRootEl = el.createDiv({ cls: "markdown-reading-view" });
    return ViewAssistant.createMarkdownViewParentElement(readingViewRootEl);
  }

  public static empty(el: HTMLElement) {
    el.empty();
    el.createDiv({ cls: ViewAssistant.markdownPusher });
    el.createDiv({ cls: ViewAssistant.markdownMod });
  }

  private static createMarkdownViewParentElement(parentElement: HTMLElement) {
    const el = parentElement.createDiv({ cls: this.markdownPreviewClasses });
    return el.createDiv({ cls: this.markdownSizer });
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