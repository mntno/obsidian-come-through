import { Env } from "#/env";
import { t } from "#/Localization";
import { ReviewItemInfoModal } from "#/modals/ReviewItemInfoModal";
import { ReviewItemInfo } from "#/scheduling/ReviewItemInfo";
import { Ratings, ReviewSortOrder } from "#/scheduling/types";
import { Api } from "#/utils/obs/api";
import { ReviewView } from "#/views/review/ReviewView";
import { App, Command } from "obsidian";

/** Commands that only appear when a {@link ReviewView} is open. */
export const ReviewViewCommand = {

	setSortOrder: (app: App): Command[] => {
		const commands: Command[] = [];
		for (const sortOrder of ["due", "retrievability"] satisfies ReviewSortOrder[]) {
			commands.push({
				id: ReviewView.TYPE + "-order-by-" + sortOrder,
				name: "Set review sort order to " + sortOrder,
				checkCallback: (checking: boolean) => {
					const reviewView = app.workspace.getActiveViewOfType(ReviewView);
					if (reviewView) {
						if (!checking)
							reviewView.setSortOrder(sortOrder).catch(Env.catch);
						return true;
					}
					return false;
				}
			});
		}
		return commands;
	},

	rate: (app: App): Command[] => {
		const commands: Command[] = [];

		for (const rating of Ratings) {
			const ratingString = ReviewItemInfo.Convert.ratingAsString(rating);
			commands.push({
				id: ReviewView.TYPE + "-rate-" + ratingString,
				name: "Rate " + ratingString.toLowerCase() + ` (${rating})`,
				checkCallback: (checking: boolean) => {
					const reviewView = getFacade(app);
					if (reviewView !== null && reviewView.rate !== null) {
						if (!checking)
							reviewView.rate(rating).catch(Env.catch);
						return true;
					}
					return false;
				}
			});
		}

		return commands;
	},

	navigateToSourceFile: (app: App): Command => {
		return {
			id: ReviewView.TYPE + "-open-source-file",
			name: "Open source note",
			checkCallback: (checking: boolean) => {
				const reviewView = getFacade(app);
				if (reviewView !== null && reviewView.openSourceFile !== null) {
					if (!checking)
						reviewView.openSourceFile(Api.Event.paneType(app)).catch(Env.catch);
					return true;
				}
				return false;
			}
		};
	},

	toggleInlineInfo: (app: App): Command => {
		return {
			id: ReviewView.TYPE + "-toggle-inline-info",
			name: t.review.actions.toggleInlineInfo,
			checkCallback: (checking: boolean) => {
				const reviewView = getFacade(app);
				if (reviewView !== null && reviewView.toggleShowMetadata !== null) {
					if (!checking)
						reviewView.toggleShowMetadata();
					return true;
				}
				return false;
			}
		};
	},

	showInfoModal: (app: App): Command => {
		return {
			id: ReviewView.TYPE + "-open-info",
			name: "Show info",
			checkCallback: (checking: boolean) => {
				const reviewView = getFacade(app);
				if (reviewView !== null) {
					if (!checking)
						new ReviewItemInfoModal(app, reviewView.reviewState, reviewView.sortOrder, reviewView.reviewItemInfo()).open();
					return true;
				}
				return false;
			}
		};
	},
};

function getFacade(app: App) {
	return app.workspace.getActiveViewOfType(ReviewView)?.getFacade() ?? null;
}
