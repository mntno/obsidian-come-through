import { PLUGIN_NAME } from "#/ui/constants";
import { Arr } from "#/utils/ts";
import { TFile } from "obsidian";

export const en = {
	actions: {
		viewContentInFile: "View defined content",
		reviewContentInFile: "Review defined content",
		destructive: {
			delete: (name: string) => `Delete ${name}`,
			confirmDelete: (name: string) => `Are you sure you want to delete ${name}?`,
		}
	},
	button: {
		/** Open a modal that adds an item. */
		add: "Add",
		cancel: "Cancel",
		delete: "Delete",
		/** Open a modal that edits an item. */
		edit: "Edit",
		/** {@link https://docs.obsidian.md/Plugins/User+interface/Settings#Save+on+change%2C+not+on+submit |  Modals "Save" / "Cancel"} */
		save: "Save",
	},
	commands: {
		openDecks: {
			name: "Decks",
		},
		generateId: {
			name: "Create a new ID under cursor",
		},
		global: {
			review: "Review",
			reviewCollection: "Review deck",
		},
		view: {
			markdown: {
				content: "View content defined by the current note",
				review: "Review content defined by the current note",
			}
		},
		setReviewSortOrder: (label: string) => `Set review sort order to ${label}`,
	},
	settings: {
		uiPrefix: {
			name: "UI prefix",
			description: "Adds a prefix to UI elements, such as menu items and notices, to help distinguish them from other sources when not obvious. Leave empty to disable.",
			validationMessage: "Use letters and digits only.",
		},
		hideCardHeadingInReview: {
			name: "Hide card heading in review",
			description: "Hide the headings that start the sections that contains cards’ sides."
		},
		advanced: {
			name: "Advanced",
		},
		processor: {
			name: "Processing",
			description: "Configure how the review content is transformed before it is displayed.",
			preventMultiplePlayback: {
				name: "Prevent multiple audio playback",
				description: "When enabled, starting another audio player will stop any audio that is currently playing."
			},
			brackets: {
				name: "Brackets",
				description: "When enabled, each bracket and its contents will be displayed in a smaller font size than the rest of the text.",
				brackets: {
					parentheses: { name: "Parentheses", description: "()" },
					squareBrackets: {
						name: "Square",
						description: "[] — it is recommended to escape each bracket with a backslash, i.e., \\[ text \\]",
					},
					curlyBraces: { name: "Curly", description: "{}" },
					angleBrackets: {
						name: "Angle",
						description: "<> — it is necessary to escape each bracket with a backslash, i.e., \\< text \\>",
					},
					doubleParentheses: { name: "Double parentheses", description: "(())" },
					doubleCurly: { name: "Double curly", description: "{{}}" },
					doubleAngle: { name: "Double angle", description: "<<>>" },
				},
			},
			applyLangTagsToNonLatinScripts: {
				name: "Increase Thai font size",
				description: "When enabled, Thai text will be displayed in a larger font size."
			}
		},
		schedulers: {
			name: "Schedulers",
			description: "Manage the schedulers used to schedule reviews.",
			defaultScheduler: {
				name: "Default scheduler",
				description: "The scheduler used when a deck does not specify one.",
			},
			addScheduler: {
				name: "Add scheduler",
				description: "Create a new scheduler.",
			},
			type: {
				name: "Type",
				description: "The scheduling algorithm to use.",
				fsrs: "FSRS (spaced repetition)",
				fixedInterval: "Fixed interval",
			},
			enableFuzz: {
				name: "Enable fuzz",
				description: "",
			},
			emptyState: "No additional schedulers.",
			reviewSortOrder: {
				name: "Review sort order",
				description: "The order in which cards are presented for review.",
				due: "Due",
				retrievability: "Retrievability",
			},
			intervalMin: {
				name: "Interval min",
				description: "The minimum interval between reviews, in minutes.",
			},
		}
	},
	modals: {
		selectDeck: {
			placeholder: "Select deck to review",
		},
		scheduler: {
			add: {
				title: "Add scheduler",
				nameLabel: "Name",
				namePlaceholder: "Scheduler name",
			},
			edit: {
				title: "Edit scheduler",
			},
		},
		confirmation: {
			title: "External change detected",
			pluginName: `Plugin: ${PLUGIN_NAME}`,
			description: "Detected changes to data (such as cards, decks, rating statistics, etc) from an external source. If this change was expected, e.g., you created a card on another device that syncs with this one, click Accept changes.",
			acceptChangesTitle: "Accept changes",
			acceptChangesDescription: "Allow this device’s cards, decks, rating statistics, etc, to be replaced with those from the other device.",
			rejectChangesTitle: "Reject changes",
			rejectChangesDescription: "Keep this device’s cards, decks, rating statistics, etc. Having selected this option you should allow the other device(s) to overwrite its data.",
			acceptChangesButton: "Accept changes by other device",
			rejectChangesButton: "Reject changes by other device"
		},
	},
	views: {
		declarations: {
			title: (file: TFile[] = []) => {
				return Arr.isNonEmpty(file) ? `Defined content in ${file.length == 1 ? Arr.firstOrThrow(file).basename : `${file.length} files`}` : "Defined content";
			},
			fileNotSet: "No notes to show content definitions from."
		},
		collections: {
			reviewAll: "Review units in all decks",
			reviewUnassigned: "Review unassigned units",
			reviewCollection: (name: string) => `Review collection "${name}"`,
			reviewItemsIn: (name: string) => `Review items in "${name}"`,
			addNew: "Add new",
		}
	},
	review: {
		actions: {
			toggleInlineInfo: "Toggle inline info",
		}
	},
};
