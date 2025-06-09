import { FullID } from "FullID";
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
		// Add settings-related strings here
	},
	modals: {
		selectDeck: {
			placeholder: "Select deck to review",
		},
		confirmation: {
			title: "External change detected",
		},
	},
	views: {
		declarations: {
			title: (file?: TFile) =>  file ? `Defined content in “${file.basename}”` : "Defined content",
			fileNotSet: "The note to show content definitions from is unknown."
		}
	}
};
