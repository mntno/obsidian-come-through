import { TFile } from "obsidian";

export const en = {
	actions: {
		viewDeclarationsInFile: "View defined content",
	},
	commands: {
		openReview: {
			name: "Review",
		},
		openDecks: {
			name: "Decks",
		},
		generateId: {
			name: "Create a new id under cursor",
		},
		openDeclarations: {
			// View the current note’s defined review content.
			name: "View content defined by the current note’s declarations",
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
			title: (file?: TFile) =>  file ? `Defined content in “${file.basename}”` : "Defined content",
			fileNotSet: "The note to show content definitions from is unknown."
		}
	},
	review: {
		actions: {
			toggleInlineInfo: "Toggle inline info",
		}
	}
};
