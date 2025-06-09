export const CssClass = {

	Plugin: {
		WORKSPACE_LEAF_CONTENT: "come-through-workspace-leaf-content"
	},

	MarkdownView: {
		READING: () => "markdown-reading-view",

		PREVIEW: () => [
			"markdown-preview-view",
			"markdown-rendered",
			"node-insert-event",
			"is-readable-line-width",
			"allow-fold-headings",
			"allow-fold-lists",
			"show-indentation-guide",
			"show-properties",
		],

		SIZER: () => [
			"markdown-preview-sizer",
			"markdown-preview-section",
		],

		PUSHER: () => [
			"markdown-preview-pusher"
		],

		MOD: () => [
			"mod-header",
			"mod-ui"
		],
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

export const HtmlAttribute = {
	Dir: {
		NAME: "dir",
		Values: {
			AUTO: "auto"
		}
	},

	MediaElement: {
		// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video#controls
		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controls
		Controls: {
			NAME: "controls",
			Values: {
				DISPLAY: ""
			}
		},
		/** The controlsList property of an HTMLMediaElement (like <video> or <audio>) allows you to control which built-in playback controls the user agent (browser) should display. */
		ControlsList: {
			NAME: "controlslist",
			Values: {
				NODOWNLOAD: "nodownload",
				NOFULLSCREEN: "nofullscreen",
				/** Hide controls that allow for casting the media to another device for playback. */
				NOREMOTEPLAYBACK: "noremoteplayback",
			}
		},
		Loop: {
			NAME: "loop",
			Values: {
				DISPLAY: ""
			}
		},
		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload
		Preload: {
			NAME: "preload",
			Values: {
				NONE: "none",
				METADATA: "metadata",
				AUTO: "auto",
			}
		},
		Plugin: {
			Data: {
				START_OFFSET_MOBILE: "data-start-offset-mobile",
				END_OFFSET_MOBILE: "data-end-offset-mobile",
				//if need more granularity: START_OFFSET_IOS/START_OFFSET_IPAD/START_OFFSET_ANDROID/..

				/** Whether automatic seeking should occur when media is paused. */
				SeekOnPause: {
					NAME: "data-pause-seek",
					Values: {
						/** Do not seek on pause, i.e., playback will continue where paused.  */
						CURRENT: "current",
						/** Seek to the initial position on pause: if a custom start time was set, seek to that; if not, seek to 0:00. */
						INITIAL: "init",
					}
				},

				/** Delay in seconds before starting playback again after having reached the end. Only relevant when looping. */
				LoopDelay: {
					NAME: "data-loop-delay",
				}
			}
		}
	}
} as const;
