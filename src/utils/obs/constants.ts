export const CssClass = {

	wrapperClassForEl: <K extends keyof HTMLElementTagNameMap>(tag: K) => {
		return "el-" + tag;
	},

	MarkdownView: {
		READING: "markdown-reading-view",

		/**
			* The container that styles HTML rendered markdown (e.g, with `MarkdownRenderer`) the
			* standard way it looks in Obsidian's reader view.
			*
			* `<div class="markdown-preview-view">`
			*
			* Some additional classes, of which the inclusion of most depends on the user's appearance settings:
			*
			* - markdown-rendered: Applied to indicate the content has been processed and rendered from markdown source. This class marks that the markdown has been fully parsed and converted to HTML DOM elements.
			* - node-insert-event: Used to signal that DOM mutation events should be handled for dynamically inserted nodes. This enables proper event handling when new content is added to the rendered markdown.
			* - is-readable-line-width: Applied when the user has enabled the "Readable line length" setting in Editor preferences. This constrains the maximum width of text lines (typically to ~700px) for improved readability.
			* - allow-fold-headings: Applied when the user has enabled heading folding in Editor settings. This allows users to collapse/expand content under headings by clicking fold indicators in the gutter.
			* - allow-fold-lists: Applied when the user has enabled list folding in Editor settings. This allows users to collapse/expand nested list items by clicking fold indicators.
			* - show-indentation-guide: Applied when the user has enabled "Show indentation guides" in Editor settings. This displays vertical lines to visualize indentation levels in lists and nested content.
			* - show-properties: Applied when the user has enabled property/frontmatter visibility. This controls whether YAML frontmatter and metadata properties are displayed in the rendered view.
			*/
		PREVIEW: [
			"markdown-preview-view",
			"markdown-rendered",
			"node-insert-event",
			"is-readable-line-width",
			"allow-fold-headings",
			"allow-fold-lists",
			"show-indentation-guide",
			"show-properties",
		],

		SIZER: [
			"markdown-preview-sizer",
			"markdown-preview-section",
		],

		PUSHER: [
			"markdown-preview-pusher"
		],

		MOD: [
			"mod-header",
			"mod-ui"
		],
	},

	Modal: {
		BUTTON_CONTAINER: "modal-button-container",
		LG: "mod-lg",
		CANCEL: "mod-cancel",
	},

	Setting: {
		Item: {
			DESC: "setting-item-description",
		}
	},

	Embed: {
		INTERNAL: "internal-embed",
		MEDIA: "media-embed",
		AUDIO: "audio-embed",
	},

	State: {
		LOADED: "is-loaded",
		ERROR: "is-error",
	}
} as const;
