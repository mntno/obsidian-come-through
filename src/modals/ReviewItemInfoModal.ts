import { BaseModal } from "#/modals/BaseModal";
import { ReviewItemInfo } from "#/scheduling/ReviewItemInfo";
import { ReviewSortOrder } from "#/scheduling/types";
import { DateTime } from "#/utils/datetime";
import { TableSectionCreator } from "#/utils/dom/table";
import { KeyValue, Str } from "#/utils/ts";
import { ReviewState } from "#/views/review/types";
import { App } from "obsidian";

export class ReviewItemInfoModal extends BaseModal {

	private reviewState: ReviewState;
	private info: ReviewItemInfo;
	private now: Date;

	constructor(app: App, reviewState: ReviewState, sortOrder: ReviewSortOrder, info: ReviewItemInfo) {
		super(app, { fullscreenOnLimitedScreenSpace: true });

		this.reviewState = reviewState;
		this.info = info;
		this.now = new Date();

		const stats = reviewState.reviewedItem.statistics;

		this.setTitle("Info");

		//this.createSetting("Queue", { isHeading: true })

		this.createSetting("Total units")
			.setDesc("The total number of review units in the current queue.")
			.controlEl.appendText(this.reviewState.numberOfItems.toString());
		this.createSetting("Sort order")
			.controlEl.appendText(sortOrder === "due" ? "Due date" : "Retrievability");

		this.addDueTotals();
		this.addRetrievabilityTotals();

		this.createSetting("Current review unit", { isHeading: true })
			.setDesc("Content that is currently in review.")

		if (sortOrder === "retrievability") {
			this.addRetrievability();
			//this.addRetrievabilityTotals();
			this.addDue();
		}
		else {
			this.addDue();
			//this.addDueTotals();
			this.addRetrievability();
		}

		const lastReviewDate = info.lastReview
		this.createSetting("Last reviewed")
			.controlEl.append(lastReviewDate === null ? "This is the first review." : createFragment(f => {
				f.appendText(DateTime.toString(lastReviewDate));
				const diff = DateTime.diffString(this.now, lastReviewDate);
				if (diff !== null) {
					f.createEl("br");
					f.appendText(diff);
				}
			}));

		this.createSetting("Scheduled days")
			.setDesc("The number of days between the last rating and the next determined due date. Also known as the repetition interval.")
			.controlEl.appendText(`${stats.sd}`);

		this.createSetting("Stage")
			.setDesc(createFragment(f => {
				f.createEl("p", { text: "This review unit’s current stage in the learning process. One of New, Learning, Review, Relearning." });
			}))
			.controlEl.appendText(this.info.state);

		this.createSetting("Ratings")
			.setDesc("Total number of times this review unit has been rated.")
			.controlEl.appendText(`${stats.r}`);

		this.createSetting("Lapses")
			.setDesc("Total number of times you have forgotten this review unit after it was considered learned. In other words, each time you rated Again when the state was Review.")
			.controlEl.appendText(`${stats.l}`);

		this.createSetting("Created")
			.controlEl.appendText(info.created);



		this.addDoneButton(true);
	}

	private addDue() {
		const isDue = this.info.isStatisticsDue(this.reviewState.date);
		this.createSetting("Due")
			.setDesc(`This review unit’s due date.`)
			.controlEl.append(createFragment(f => {
				f.appendText(this.info.due);
				const diff = DateTime.diffString(this.now, this.info.dueDate);
				if (isDue && diff !== null) {
					f.createEl("br");
					f.appendText(diff);
				}
			}));
	};

	private addDueTotals() {
		if (!KeyValue.isNotEmpty(this.reviewState.totalDueBefore))
			return;

		const reviewDate = this.reviewState.date;
		const entries = Array.from(this.reviewState.totalDueBefore.entries());

		const el = this.createSetting("Ratings left")
			.setDesc("The number of review units left in the current review queue.");

		new TableSectionCreator(el.controlEl.createEl("table")).addBody(rowCreator => {
			entries.forEach(([date, value], _index) => {
				let timeString: string;
				const hours = date.getHours();
				const minutes = date.getMinutes();

				const today = new Date(reviewDate);
				today.setHours(0, 0, 0, 0);

				const tomorrow = new Date(today);
				tomorrow.setDate(today.getDate() + 1);

				const dayAfterTomorrow = new Date(tomorrow);
				dayAfterTomorrow.setDate(tomorrow.getDate() + 1);

				const isToday = date.getTime() >= today.getTime() && date.getTime() < tomorrow.getTime();
				const isTomorrow = date.getTime() >= tomorrow.getTime() && date.getTime() < dayAfterTomorrow.getTime();

				if (isToday && hours === 12 && minutes === 0) {
					timeString = "Before noon:";
				} else if (isToday && hours === 20 && minutes === 0) {
					timeString = "Before 8 this evening:";
				} else if (isTomorrow && hours === 4 && minutes === 0) {
					timeString = "Before 4 tomorrow morning:";
				} else {
					timeString = DateTime.toTimeString(date);
				}

				rowCreator.add(colCreator => {
					colCreator.add({ text: timeString });
					colCreator.add({ text: `${Str.NON_BREAKING_SPACE}${value}` });
				});
			});
		});
	}

	private addRetrievability() {

		// Retrievability is the statistical likelihood that you will have a successful recall, which in practice means you will end up rating the card 'Hard', 'Good', or 'Easy' — and not 'Again'
		const el = this.createSetting("Retrievability")
			.setDesc("The estimated probability that you will be able to recall this review unit right now, i.e., the likelihood you will rate Hard, Good, or Easy.");

		new TableSectionCreator(el.controlEl.createEl("table")).addBody(rowCreator => {
			rowCreator.add((col) => {
				col.add({ text: "Now:" });
				col.add({ text: `${Str.NON_BREAKING_SPACE}${this.info.retrievabilityAsString(this.reviewState.date)}` });
			});
			rowCreator.add((col) => {
				col.add({ text: "At due date:" });
				col.add({ text: `${Str.NON_BREAKING_SPACE}${this.info.retrievabilityAsString(this.info.dueDate)}` });
			});
		});
	};

	private addRetrievabilityTotals() {
		if (!KeyValue.isNotEmpty(this.reviewState.totalRetrievabilityBelow))
			return;

		const entries = Array.from(this.reviewState.totalRetrievabilityBelow.entries());
		const el = this.createSetting("Ratings left")
			.setDesc("The number of review units left in the current review queue below the given retrievability.");

		new TableSectionCreator(el.controlEl.createEl("table")).addBody(rowCreator => {
			entries.forEach(([threshold, value], _index) => {
				rowCreator.add((col) => {
					col.add({ text: `Below ${threshold * 100}%:` });
					col.add({ text: `${Str.NON_BREAKING_SPACE}${value}` });
				});
			});
		});
	};
}
