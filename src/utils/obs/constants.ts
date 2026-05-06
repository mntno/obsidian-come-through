export const HtmlAttribute = {
	Data: {
		MODE: "data-mode"
	}
} as const;

export const CssClass = {

	wrapperClassForEl: <K extends keyof HTMLElementTagNameMap>(tag: K) => {
		return "el-" + tag;
	},

	Component: {
		CLICKABLE_ICON: "clickable-icon",
	},

	/** Classes on the body element. */
	Body: {

		Setting: {
			/**
				* Added when "Full screen" is enabled in settings.
				* "Automatically hide interface elements while reading."
				*
				*/
			AUTO_FULL_SCREEN: "auto-full-screen",

			/**
				* Added when "Floating navigation" is enabled in settings.
				* "Navigation buttons float over the content instead of being anchored."
				*/
			IS_FLOATING_NAV: "is-floating-nav",
		},

		Platform: {
			IS_PHONE: "is-phone",
		},

		Interface: {
			/** Added when the navigation such as the header view is hidden (or about to be hidden once transitioned). */
			IS_HIDDEN_NAV: "is-hidden-nav",
			IS_SHOW_INDENT_GUIDE: "show-indentation-guide"
		}
	},

	Workspace: {
		LEAF_CONTENT_MODIFIER: "workspace-leaf-content",
		Data: {
			PREVIEW_MODE: "preview"
		}
	},

	MarkdownView: {
		READING: "markdown-reading-view",
		Preview: {
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
				* - allow-fold-headings: Applied when the user has enabled heading folding in Editor settings. This allows users to collapse/expand content under headings by clicking fold indicators in the gutter.
				* - allow-fold-lists: Applied when the user has enabled list folding in Editor settings. This allows users to collapse/expand nested list items by clicking fold indicators.
				* - show-indentation-guide: Applied when the user has enabled "Show indentation guides" in Editor settings. This displays vertical lines to visualize indentation levels in lists and nested content.
				* - show-properties: Applied when the user has enabled property/frontmatter visibility. This controls whether YAML frontmatter and metadata properties are displayed in the rendered view.
				*/
			DEFAULT: [
				"markdown-preview-view",
				"markdown-rendered",
				"node-insert-event",
				//"is-readable-line-width",
				"allow-fold-headings",
				"allow-fold-lists",
				"show-indentation-guide",
				"show-properties",
			],
			/** Applied when the user has enabled the "Readable line length" setting in Editor preferences. This constrains the maximum width of text lines (typically to ~700px) for improved readability. */
			IS_READABLE_LINE_WIDTH: "is-readable-line-width",
		},

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
