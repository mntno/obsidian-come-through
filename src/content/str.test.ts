import { describe, it, expect } from "vitest"
import { StringManipulator } from '#/content/str'

// Text:        0         1         2         3         4         5
//              012345678901234567890123456789012345678901234567890123
const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ";

const { subStringByRanges } = StringManipulator;

describe("subStringByRanges", () => {

	describe("Basic", () => {
		it("No ranges", () => {
			expect(subStringByRanges(text, [])).toBe(text);
		});

		it("Empty string", () => {
			expect(subStringByRanges("", [{ start: 0, end: 0 }])).toBe("");
		});

		it("Exclude one range", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }]))
				.toBe(text.slice(0, 10) + text.slice(20));
		});

		it("Exclude two non-overlapping ranges", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }, { start: 30, end: 40 }]))
				.toBe(text.slice(0, 10) + text.slice(20, 30) + text.slice(40));
		});

		it("Exclude ranges passed in reverse order", () => {
			expect(subStringByRanges(text, [{ start: 30, end: 40 }, { start: 10, end: 20 }]))
				.toBe(text.slice(0, 10) + text.slice(20, 30) + text.slice(40));
		});

		it("Exclude at start of string", () => {
			expect(subStringByRanges(text, [{ start: 0, end: 10 }]))
				.toBe(text.slice(10));
		});

		it("Exclude at end of string", () => {
			expect(subStringByRanges(text, [{ start: 40, end: text.length }]))
				.toBe(text.slice(0, 40));
		});

		it("Exclude entire string", () => {
			expect(subStringByRanges(text, [{ start: 0, end: text.length }])).toBe("");
		});

		it("Zero-length exclude range (no-op)", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 10 }])).toBe(text);
		});

		it("Single character exclude", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 11 }]))
				.toBe(text.slice(0, 10) + text.slice(11));
		});
	});

	describe("Overlapping / nested excludes", () => {
		it("Overlapping excludes 10-25 and 15-35", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 25 }, { start: 15, end: 35 }]))
				.toBe(text.slice(0, 10) + text.slice(35));
		});

		it("Nested excludes — 10-40 contains 15-25", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 40 }, { start: 15, end: 25 }]))
				.toBe(text.slice(0, 10) + text.slice(40));
		});

		it("Three contiguous overlapping excludes forming a chain", () => {
			expect(subStringByRanges(text, [{ start: 5, end: 15 }, { start: 12, end: 25 }, { start: 22, end: 35 }]))
				.toBe(text.slice(0, 5) + text.slice(35));
		});

		it("All excludes overlap each other", () => {
			expect(subStringByRanges(text, [{ start: 5, end: 30 }, { start: 10, end: 35 }, { start: 15, end: 40 }]))
				.toBe(text.slice(0, 5) + text.slice(40));
		});

		it("Adjacent excludes (touching but not overlapping)", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }, { start: 20, end: 30 }]))
				.toBe(text.slice(0, 10) + text.slice(30));
		});
	});

	describe("Replace, no overlapping excludes", () => {
		it("Replace only, no excludes", () => {
			expect(subStringByRanges(text, [], { range: { start: 10, end: 20 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(20));
		});

		it("Replace at start of string", () => {
			expect(subStringByRanges(text, [], { range: { start: 0, end: 10 }, text: "XXXXX" }))
				.toBe("XXXXX" + text.slice(10));
		});

		it("Replace at end of string", () => {
			expect(subStringByRanges(text, [], { range: { start: 40, end: text.length }, text: "XXXXX" }))
				.toBe(text.slice(0, 40) + "XXXXX");
		});

		it("Replace with empty string (effectively an exclude)", () => {
			expect(subStringByRanges(text, [], { range: { start: 10, end: 20 }, text: "" }))
				.toBe(text.slice(0, 10) + text.slice(20));
		});

		it("Replace with longer text", () => {
			expect(subStringByRanges(text, [], { range: { start: 10, end: 15 }, text: "XXXXXXXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXXXXXXX" + text.slice(15));
		});

		it("Replace with shorter text", () => {
			expect(subStringByRanges(text, [], { range: { start: 10, end: 20 }, text: "X" }))
				.toBe(text.slice(0, 10) + "X" + text.slice(20));
		});

		it("Replace with single character range", () => {
			expect(subStringByRanges(text, [], { range: { start: 10, end: 11 }, text: "X" }))
				.toBe(text.slice(0, 10) + "X" + text.slice(11));
		});

		it("Replace adjacent to exclude (touching but not overlapping)", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }], { range: { start: 20, end: 30 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(30));
		});

		it("Exclude adjacent to replace on the other side", () => {
			expect(subStringByRanges(text, [{ start: 20, end: 30 }], { range: { start: 10, end: 20 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(30));
		});
	});

	describe("Replace overlapping excludes", () => {
		it("Exclude 10-20, replace 15-25 (replace ends after exclude)", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }], { range: { start: 15, end: 25 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(25));
		});

		it("Exclude 10-20, replace 5-15 (replace starts before exclude)", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }], { range: { start: 5, end: 15 }, text: "XXXXX" }))
				.toBe(text.slice(0, 5) + "XXXXX" + text.slice(20));
		});

		it("Replace entirely inside exclude — exclude 10-30, replace 15-25", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 30 }], { range: { start: 15, end: 25 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(30));
		});

		it("Replace contains exclude entirely — replace 10-30, exclude 15-25", () => {
			expect(subStringByRanges(text, [{ start: 15, end: 25 }], { range: { start: 10, end: 30 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(30));
		});

		it("Replace identical to exclude", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }], { range: { start: 10, end: 20 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(20));
		});

		it("Replace overlapping two excludes", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }, { start: 30, end: 40 }], { range: { start: 15, end: 35 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(40));
		});

		it("Replace overlapping two excludes that themselves overlap", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 25 }, { start: 20, end: 35 }], { range: { start: 15, end: 30 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + "XXXXX" + text.slice(35));
		});

		it("Replace not overlapping excludes, excludes still applied", () => {
			expect(subStringByRanges(text, [{ start: 10, end: 20 }], { range: { start: 25, end: 30 }, text: "XXXXX" }))
				.toBe(text.slice(0, 10) + text.slice(20, 25) + "XXXXX" + text.slice(30));
		});
	});
});
