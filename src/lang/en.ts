import { Arr } from "#/utils/ts";
import { TFile } from "obsidian";

export const en = {
	actions: {
		viewContentInFile: "View defined content",
		reviewContentInFile: "Review defined content",
	},
	commands: {
		openDecks: {
			name: "Decks",
		},
		generateId: {
			name: "Create a new id under cursor",
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
		}
	},
	settings: {
		uiPrefix: {
			name: "UI prefix",
			description: "Adds a prefix to UI elements, such as menu items and notices, to help distinguish them from other sources when not obvious. Leave empty to disable."
		},
		hideCardHeadingInReview: {
			name: "Hide card heading in review",
			description: "Hide the headings that start the sections that contains cards’ sides."
		}
	},
	modals: {
		selectDeck: {
			placeholder: "Select deck to review",
		},
		confirmation: {
			title: "External change detected",
			pluginName: "Plugin: Come Through",
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
	}
};
