import { Env } from "env";
import { setTooltip } from "obsidian";
import { NextItem, Rating } from "scheduling/types";
import { ReviewItemInfo } from "scheduling/ReviewItemInfo";
import { ReviewSortOrder } from "scheduling/types";
import { DateTime } from "utils/datetime";
import { TableRowCreator, TableSectionCreator } from "utils/dom/table";
import { ElementCreator } from "utils/ElementCreator";
import { KeyValue } from "utils/ts";
import { ReviewState } from "views/review/types";

export function createRatingButtons(nextItemsWithInfo: { item: NextItem, info: ReviewItemInfo }[], reviewState: ReviewState, _sortOrder: ReviewSortOrder, cb: (button: HTMLButtonElement, rating: Rating) => void) {
	Env.log.d("createRatingButtons");

	const ratingButtonsContainer = createDiv({ cls: "rating-buttons" });

	// If width is not sufficient for four buttons on one line, this container is used to make two buttons wrap instead of one at the time.
	let pairContainer: HTMLDivElement | null = null;
	const ratingButtons: HTMLButtonElement[] = [];

	for (const next of nextItemsWithInfo) {

		if (ratingButtons.length % 2 == 0 || pairContainer === null)
			pairContainer = ratingButtonsContainer.createDiv({ cls: "button-pair" });

		ratingButtons.push(pairContainer.createEl("button", undefined, (button) => {

			setTooltip(button, next.info.due)
			button.createDiv(undefined, el => {
				el.createSpan({ text: ReviewItemInfo.Convert.ratingAsString(next.item.reviewLog.rating) });
				el.createSpan({ text: `${ReviewItemInfo.Convert.timeDiffMsg(next.info.dueDate, reviewState.date)}` });
			});

			cb(button, next.item.reviewLog.rating);
		}));
	}

	return ratingButtonsContainer;
}

export function createMetadataEl(
	reviewState: ReviewState,
	sortOrder: ReviewSortOrder,
	info: ReviewItemInfo,
	creator: ElementCreator,
	showMoreInfoCb?: (button: HTMLButtonElement) => void) {
	Env.log.d("createMetadataEl");

	const stats = reviewState.reviewedItem.statistics;
	const reviewDate = reviewState.date;
	const colSpan = { "colspan": "2" };

	const addDue = (row: TableRowCreator) => {
		row.add((col) => {
			col.add({ text: `${info.isStatisticsDue(reviewDate) ? "Due now" : "Due"}` })
			col.add({ text: info.due, attr: colSpan });
		});
	};

	const addDueTotals = (row: TableRowCreator) => {
		if (!KeyValue.isNotEmpty(reviewState.totalDueBefore))
			return;

		const entries = Array.from(reviewState.totalDueBefore.entries());
		const lastIndex = entries.length - 1;

		let col = row.add((col) => {
			col.add({ text: "Ratings left before…", attr: { "rowspan": `${entries.length}` } });
		});

		entries.forEach(([date, value], index) => {
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
				timeString = "noon";
			} else if (isToday && hours === 20 && minutes === 0) {
				timeString = "8 this evening";
			} else if (isTomorrow && hours === 4 && minutes === 0) {
				timeString = "4 tomorrow morning";
			} else {
				timeString = DateTime.toTimeString(date);
			}

			col.add({ text: timeString });
			col.add({ text: `${value}` });

			if (index < lastIndex)
				col = row.add();
		});
	};

	const addRetrievability = (row: TableRowCreator) => {
		row.add((col) => {
			//const hasDueDatePassed = scheduler.isStatisticsDue(stats, reviewDate);
			col.add({ text: "Retrievability", attr: { "rowspan": 2 } });
			col.add({ text: `Now: ${info.retrievabilityAsString(reviewDate)}`, attr: colSpan });
			row.add().add({ text: `At due date: ${info.retrievabilityAsString(info.dueDate)}`, attr: colSpan });
		});
	};

	const addRetrievabilityTotals = (row: TableRowCreator) => {
		if (!KeyValue.isNotEmpty(reviewState.totalRetrievabilityBelow))
			return;

		const entries = Array.from(reviewState.totalRetrievabilityBelow.entries());
		const lastIndex = entries.length - 1;

		let col = row.add((col) => {
			col.add({ text: "Ratings left below…", attr: { "rowspan": `${entries.length}` } });
		});

		entries.forEach(([threshold, value], index) => {
			col.add({ text: `${threshold * 100}%` });
			col.add({ text: `${value}` });

			if (index < lastIndex)
				col = row.add();
		});
	};

	const tableBuilder = (section: TableSectionCreator) => {

		section.setHeader((row) => {
			row.add((col) => {
				col.add({ text: "Info", attr: { colSpan: 3 } });
				// col.add({ text: sortOrder, attr: colSpan });
			});
		});

		section.addBody((row) => {

			if (sortOrder === "retrievability") {
				addRetrievability(row);
				addRetrievabilityTotals(row);
				addDue(row);
			}
			else {
				addDue(row);
				addDueTotals(row);
				addRetrievability(row);
			}

			row.add((col) => {
				col.add({ text: "Last reviewed" })
				const date = info.lastReview;
				col.add({
					text: date !== null ? DateTime.toString(date) : "This is the first review.",
					attr: colSpan
				});
			});

			row.add((col) => {
				col.add({ text: "Ratings" })
				col.add({ text: `${stats.r}`, attr: colSpan });
			});

		});

		if (showMoreInfoCb) {
			section.setFooter(row => {
				row.add((col) => {
					col.add({ attr: { colSpan: 3 } }, el => {
						showMoreInfoCb(el.createEl("button", { text: "See more", "cls": "center" }));
					});
				});
			});
		}
	};

	creator.table(tableBuilder, {
		wrapperClasses: ["statistics"],
	});
}
