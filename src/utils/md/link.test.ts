import { Link } from "#/utils/md/link";
import { describe, expect, it } from "vitest";

describe("Link", () => {
	describe("is", () => {
		it("matches inline links [text](url)", () => {
			expect(Link.is("[text](url)")).toBe(true);
		});

		it("matches inline links with path", () => {
			expect(Link.is("[file](../../folder/file.md#file%20[ref1])")).toBe(true);
		});

		it("matches reference-style links [text][ref]", () => {
			expect(Link.is("[see more][ref]")).toBe(true);
		});

		it("matches wiki links [[Default]]", () => {
			expect(Link.is("[[Default]]")).toBe(true);
		});

		it("matches image syntax ![](img.jpg)", () => {
			expect(Link.is("![](img.jpg)")).toBe(true);
		});

		it("matches image syntax ![alt](img.jpg)", () => {
			expect(Link.is("![alt](img.jpg)")).toBe(true);
		});

		it("matches image with external URL", () => {
			expect(Link.is("![alt](https://example.com/image.png)")).toBe(true);
		});

		it("matches image with parentheses in alt text and URL", () => {
			expect(Link.is("![a note (important)](../../../folder/file.md#heading%20(has%20parens))")).toBe(true);
		});

		it("matches embedded wiki ![[note]]", () => {
			expect(Link.is("![[note]]")).toBe(true);
		});

		it("matches empty embedded wiki ![[]]", () => {
			expect(Link.is("![[]]")).toBe(true);
		});

		it("does not match single bracket [text]", () => {
			expect(Link.is("[text]")).toBe(false);
		});

		it("does not match unclosed wiki [[broken", () => {
			expect(Link.is("[[broken")).toBe(false);
		});
	});

	describe("replace", () => {
		it("calls replacer for each matched link", () => {
			const matches: string[] = [];
			Link.replace("[a](x) [[b]]", (m) => {
				matches.push(m);
				return m;
			});
			expect(matches).toEqual(["[a](x)", "[[b]]"]);
		});

		it("does not call replacer for unmatched brackets", () => {
			let called = false;
			const result = Link.replace("[text]", () => { called = true; return ""; });
			expect(called).toBe(false);
			expect(result).toBe("[text]");
		});
	});
});
