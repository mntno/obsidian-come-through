import { ContentRange } from "#/content/types";
import { Str } from "#/utils/ts";


export const StringManipulator = {

	/**
	 * @param fileContent The full file content to process.
	 * @param excludeRanges Ranges to exclude from the result. Overlapping and nested ranges are handled.
	 * @param replaceRange An optional range to replace with a given text.
	 * @returns A subset of {@link fileContent} excluding {@link excludeRanges}, with {@link replaceRange} substituted if provided.
	 */
	subStringByRanges(this: void, fileContent: string, excludeRanges: ContentRange[], replaceRange?: { range: ContentRange, text: string }) {
		function rangesOverlap(a: ContentRange, b: ContentRange) {
			return a.start < b.end && b.start < a.end;
		}

		if (excludeRanges.length === 0 && !replaceRange)
			return fileContent;

		const sortedExclude = [...excludeRanges].sort((a, b) => a.start - b.start);

		let mergedStart: number | null = null;
		let mergedEnd: number | null = null;

		if (replaceRange) {
			for (const range of sortedExclude) {
				if (rangesOverlap(range, replaceRange.range)) {
					if (mergedStart === null)
						mergedStart = Math.min(range.start, replaceRange.range.start);
					else
						mergedStart = Math.min(mergedStart, range.start);
					mergedEnd = Math.max(mergedEnd ?? 0, range.end, replaceRange.range.end);
				}
			}
		}

		const finalRanges: { range: ContentRange, replacement?: string }[] = [];
		let replacementAdded = false;

		for (const range of sortedExclude) {
			// mergedStart/mergedEnd are null if no overlaps were found, resulting in a range that can never overlap
			if (replaceRange && rangesOverlap(range, { start: mergedStart ?? Infinity, end: mergedEnd ?? -1 })) {
				if (!replacementAdded) {
					finalRanges.push({ range: { start: mergedStart!, end: mergedEnd! }, replacement: replaceRange.text });
					replacementAdded = true;
				}
			} else {
				finalRanges.push({ range });
			}
		}

		if (replaceRange && !replacementAdded)
			finalRanges.push({ range: replaceRange.range, replacement: replaceRange.text });

		finalRanges.sort((a, b) => a.range.start - b.range.start);

		const rangesToJoin: string[] = [];
		let lastIndex = 0;

		for (const entry of finalRanges) {
			if (entry.range.start < lastIndex) {
				if (entry.range.end > lastIndex)
					lastIndex = entry.range.end;
				continue;
			}

			rangesToJoin.push(fileContent.slice(lastIndex, entry.range.start));
			if (entry.replacement !== undefined)
				rangesToJoin.push(entry.replacement);
			lastIndex = entry.range.end;
		}

		rangesToJoin.push(fileContent.slice(lastIndex));
		return rangesToJoin.join(Str.EMPTY);
	},
}
