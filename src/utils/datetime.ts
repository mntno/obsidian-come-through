import { Env } from "#/env";
import { Api } from "#/utils/obs/api";
import { Str } from "#/utils/ts";
import { DateTime as LxnDateTime, Settings, ToRelativeOptions } from "luxon";

Settings.defaultLocale = Api.App.getLanguage();

const TIME_FORMAT = LxnDateTime.TIME_SIMPLE;
const DATE_FORMAT = LxnDateTime.DATETIME_MED;

export const DateTime = {
	toTimeString: (date: Date) => LxnDateTime.fromJSDate(date).toLocaleString(TIME_FORMAT),
	toString: (date: Date) => LxnDateTime.fromJSDate(date).toLocaleString(DATE_FORMAT),

	dateStringFromIso: (iso8601: string): string => {
		Env.assert(Str.isNonEmpty(iso8601), "Expected an ISO string.");
		return LxnDateTime.fromISO(iso8601).toLocaleString(DATE_FORMAT);
	},

	dateFromIso: (iso8601: string): Date => {
		Env.assert(Str.isNonEmpty(iso8601), "Expected an ISO string.");
		return LxnDateTime.fromISO(iso8601).toJSDate();
	},

	toIso: (date: Date) => date.toISOString(),

	/**
		* @param date
		* @param compareDate
		* @returns `true` if {@link compareDate} is later than {@link date}.
		*/
	isDateLater: (date: Date, compareDate: Date): boolean => compareDate.getTime() - date.getTime() > 0,

	/**
	 * @param now
	 * @param otherDate
	 * @returns `null` if the diff calculation failes or if the given dates are invalid.
	 */
	diffString: (now: Date, otherDate: Date): string | null => {
		const dtNow = LxnDateTime.fromJSDate(now);
		const dtOther = LxnDateTime.fromJSDate(otherDate);
		return dtOther.toRelative({
			base: dtNow,
			style: "long", //"narrow", "short",
			//unit: "day",
			round: true,
			rounding: "trunc",
			padding: 0,
		} satisfies ToRelativeOptions);
	},
};
