import { Env } from "env";
// Make sure you're doing import { moment} from 'obsidian' so that you don't import another copy — https://docs.obsidian.md/oo24/plugin#Performance
import { moment } from "obsidian"; // TODO: Use Luxon
import { Str } from "utils/ts";
// @ts-expect-error
import { DateTime as LuxonDateTime } from "luxon";

const TIME_FORMAT = "LT";
const DATE_FORMAT = "MMM D, LT";

export const DateTime = {
	toTimeString: (date: Date) => moment(date).format(TIME_FORMAT),
	toString: (date: Date) => moment(date).format(DATE_FORMAT),

	dateStringFromIso: (iso8601: string): string => {
		Env.assert(!Str.is(iso8601 as unknown), "Expected an ISO string.");
		return moment(iso8601).format(DATE_FORMAT);
	},

	dateFromIso: (iso8601: string): Date => {
		Env.assert(!Str.is(iso8601 as unknown), "Expected an ISO string.");
		return moment(iso8601).toDate();
	},

	toIso: (date: Date) => date.toISOString(),

	/**
		* @param date
		* @param compareDate
		* @returns `true` if {@link compareDate} is later than {@link date}.
		*/
	isDateLater: (date: Date, compareDate: Date): boolean => compareDate.getTime() - date.getTime() > 0 ? true : false,

	diffString: (now: Date, otherDate: Date): string => {
		const dtNow = LuxonDateTime.fromJSDate(now);
		const dtOther = LuxonDateTime.fromJSDate(otherDate);

		const options = {
			// [toHuman](https://moment.github.io/luxon/api-docs/index.html#durationtohuman)
			showZeros: false, // Show all units previously used by the duration even if they are zero
			listStyle: "long",

			// [locale options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#locale_options)

			// [style options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#style_options)
			unitDisplay: "long",

			// [digit options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#digit_options)
			minimumIntegerDigits: 1,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
			//minimumSignificantDigits: 1,
			//maximumSignificantDigits: 21,

			// [other options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#other_options)
			signDisplay: "never",
		};

		const diff = dtOther.diff(dtNow);
		const humanizedString = diff.shiftTo("years", "months", "days").toHuman(options);

		return diff.as("milliseconds") < 0 ? `${humanizedString} ago` : `In ${humanizedString}`;
	},
} as const;
