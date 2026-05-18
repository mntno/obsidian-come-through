import type { ReviewSortOrder } from "#/scheduling/types";

export interface PluginSettings {
	/** Trimmed. */
	uiPrefix: string;

	hideCardSectionMarker: boolean;
	hideDeclarationInReadingView: boolean;

	/** Defines the time duration in seconds after which "removed" metadata items are eligible for permanent deletion. Items with a "removed date" property older than the current time minus this threshold will be purged. Must be a non-negative integer. */
	removedItemsPurgeThreshold: number;

	/** Use when none is specified. */
	defaultScheduler: string;
	schedulers: Record<string, SchedulerSetting>;

	processors: ProcessorSettings;
}

// ---------------------------------------------------------------------------

export interface ProcessorSettings {
	brackets: Partial<Record<BracketId, BracketSetting>>;
	// preventMultiplePlayback: boolean;
	// applyLangTagsToNonLatinScripts: boolean;
}

export const BRACKET_IDS = [
	"squareBrackets",
	"angleBrackets",
	"doubleAngle",
	"doubleParentheses",
	"doubleCurly",
	"parentheses",
	"curlyBraces",
] as const;
export type BracketId = (typeof BRACKET_IDS)[number];

export interface BracketSetting {
	/** Whether the bracket and its contents are processed. */
	enabled: boolean;
	// color
	// size
}

// ---------------------------------------------------------------------------

export type SchedulerSetting = FsrsScheduler | FixedIntervalScheduler;

export interface FsrsScheduler {
	type: "fsrs";
	config: FsrsSchedulerConfigSettingItem;
}

export interface FixedIntervalScheduler {
	type: "fixedInterval";
	config: FixedIntervalSchedulerConfigSettingItem;
}

export interface SchedulerConfigSettingItem {
	enableFuzz: boolean;
}

export interface FsrsSchedulerConfigSettingItem extends SchedulerConfigSettingItem {
	reviewSortOrder: ReviewSortOrder;
}

export interface FixedIntervalSchedulerConfigSettingItem extends SchedulerConfigSettingItem {
	intervalMin: number;
}
