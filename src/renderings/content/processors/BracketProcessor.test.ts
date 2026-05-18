import type { PreProcessorParameter } from "#/renderings/content/processors/types";
import type { BracketToken } from "#/renderings/content/processors/BracketProcessor";
import { BracketProcessor } from "#/renderings/content/processors/BracketProcessor";
import { HtmlTag } from "#/utils/dom/constants";
import { describe, expect, it } from "vitest";

function process(enabled: BracketToken[], markdown: string): string {
	const param = { markdown } as PreProcessorParameter;
	new BracketProcessor({ enabled }).handleMarkdown(param);
	return param.markdown;
}

describe("BracketProcessor", () => {

	describe("Square brackets", () => {
		it("wraps [content] in <small>", () => {
			expect(process(["["], "[content]")).toBe(`<${HtmlTag.SMALL}>\\[content\\]</${HtmlTag.SMALL}>`);
		});

		it("wraps escaped \\[content\\] same as [content]", () => {
			expect(process(["["], "\\[content\\]")).toBe(`<${HtmlTag.SMALL}>\\[content\\]</${HtmlTag.SMALL}>`);
		});

		it("handles mixed [a] [[wiki]] [b]", () => {
			expect(process(["["], "[a] [[wiki]] [b]"))
				.toBe(`<${HtmlTag.SMALL}>\\[a\\]</${HtmlTag.SMALL}> [[wiki]] <${HtmlTag.SMALL}>\\[b\\]</${HtmlTag.SMALL}>`);
		});

		it("does not double-wrap inside <small>", () => {
			expect(process(["["], "<small>[content]</small>")).toBe(`<small>\\[content\\]</small>`);
		});

		it("handles multi-line content", () => {
			expect(process(["["], "[(1) Actually.\n\n(1) B.]"))
				.toBe(`<${HtmlTag.SMALL}>\\[(1) Actually.\n\n(1) B.\\]</${HtmlTag.SMALL}>`);
		});

		it("strips trailing backslash before closing bracket [text\\]", () => {
			expect(process(["["], "[text\\]")).toBe(`<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>`);
		});

		it("handles nested different brackets [(b)]", () => {
			expect(process(["["], "[(b)]")).toBe(`<${HtmlTag.SMALL}>\\[(b)\\]</${HtmlTag.SMALL}>`);
		});

		it("passes through unmatched [text", () => {
			expect(process(["["], "[text")).toBe("[text");
		});

		it("wraps adjacent [a][b] separated by space", () => {
			expect(process(["["], "[a] [b]"))
				.toBe(`<${HtmlTag.SMALL}>\\[a\\]</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>\\[b\\]</${HtmlTag.SMALL}>`);
		});

		it("wraps bracket surrounded by words: a[text]b", () => {
			expect(process(["["], "a[text]b")).toBe(`a<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>b`);
		});

		it("wraps whitespace [ ]", () => {
			expect(process(["["], "[ ]")).toBe(`<${HtmlTag.SMALL}>\\[ \\]</${HtmlTag.SMALL}>`);
		});

		it("passes through - [x] (task checked)", () => {
			expect(process(["["], "- [x]")).toBe("- [x]");
		});

		it("passes through - [ ] (task unchecked)", () => {
			expect(process(["["], "- [ ]")).toBe("- [ ]");
		});

		it("wraps [x] without - prefix", () => {
			expect(process(["["], "[x]")).toBe(`<${HtmlTag.SMALL}>\\[x\\]</${HtmlTag.SMALL}>`);
		});

		it("wraps [ab] after - (too long for checkbox)", () => {
			expect(process(["["], "- [ab]")).toBe(`- <${HtmlTag.SMALL}>\\[ab\\]</${HtmlTag.SMALL}>`);
		});

		it("wraps [world] on same line as checkbox", () => {
			expect(process(["["], "- [x] Hello [world]"))
				.toBe(`- [x] Hello <${HtmlTag.SMALL}>\\[world\\]</${HtmlTag.SMALL}>`);
		});

		it("passes through multiple checkboxes across lines", () => {
			const input = "hello\n-   [x] 1\n- [ ] 2\nthere";
			expect(process(["["], input)).toBe(input);
		});

		it("passes through checkbox after <br>", () => {
			const input = "some text<br>\n- [x] ok\nyes";
			expect(process(["["], input)).toBe(input);
		});
	});

	describe("Link integration", () => {
		it("preserves links alongside wrapped brackets", () => {
			const input = "![[note]] [text] ![](img.jpg)";
			const expected = "![[note]] " + `<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>` + " ![](img.jpg)";
			expect(process(["["], input)).toBe(expected);
		});
	});

	describe("Code passthrough", () => {
		it("preserves inline code with parentheses: `(parens)`", () => {
			expect(process(["((", "("], "`(parens)`")).toBe("`(parens)`");
		});

		it("preserves inline code with curly braces: `{braces}`", () => {
			expect(process(["{{", "{"], "`{braces}`")).toBe("`{braces}`");
		});

		it("preserves inline code with square brackets: `[square]`", () => {
			expect(process(["["], "`[square]`")).toBe("`[square]`");
		});

		it("preserves inline code with escaped angle: `\\<angle\\>`", () => {
			expect(process(["<"], "`\\<angle\\>`")).toBe("`\\<angle\\>`");
		});

		it("preserves triple-backtick fenced block with brackets", () => {
			const input = "```\n[a] (b) {c}\n```";
			expect(process(["[", "<", "<<", "((", "{{", "(", "{"], input)).toBe(input);
		});

		it("preserves four-backtick fenced block with brackets", () => {
			const input = "````\n(hello) [world]\n````";
			expect(process(["[", "(", "(("], input)).toBe(input);
		});

		it("processes brackets outside inline code", () => {
			expect(process(["[", "(", "(("], "`[code]` [text] `{more}`"))
				.toBe("`[code]` " + `<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>` + " `{more}`");
		});

		it("preserves inline code next to wrapped brackets", () => {
			expect(process(["[", "(", "(("], "text `(x)` (wrap) `[y]`"))
				.toBe("text `(x)` " + `<${HtmlTag.SMALL}>(wrap)</${HtmlTag.SMALL}>` + " `[y]`");
		});
	});

	describe("Angle brackets", () => {
		it("wraps escaped \\<text\\>", () => {
			expect(process(["<"], "\\<text\\>")).toBe(`<${HtmlTag.SMALL}>\\<text\\></${HtmlTag.SMALL}>`);
		});

		it("ignores unescaped <text>", () => {
			expect(process(["<"], "<text>")).toBe("<text>");
		});

		it("does not double-wrap inside <small>", () => {
			expect(process(["<"], "<small>\\<x\\></small>")).toBe(`<small>\\<x\\></small>`);
		});

		it("passes through escaped double \\<\\<non\\>\\> when << is not enabled", () => {
			expect(process(["<"], "\\<\\<non\\>\\>")).toBe("\\<\\<non\\>\\>");
		});

		it("wraps escaped double \\<\\<non\\>\\> when << is enabled", () => {
			expect(process(["<<"], "\\<\\<non\\>\\>"))
				.toBe(`<${HtmlTag.SMALL}>\\<\\<non\\>\\></${HtmlTag.SMALL}>`);
		});

		it("wraps single escaped \\<facilisis\\> while preserving escaped double \\<\\<non\\>\\>", () => {
			expect(process(["<"], "\\<facilisis\\> \\<\\<non\\>\\>"))
				.toBe(`<${HtmlTag.SMALL}>\\<facilisis\\></${HtmlTag.SMALL}> \\<\\<non\\>\\>`);
		});

		it("wraps escaped double when both << and < are enabled", () => {
			expect(process(["<<", "<"], "\\<\\<non\\>\\>"))
				.toBe(`<${HtmlTag.SMALL}>\\<\\<non\\>\\></${HtmlTag.SMALL}>`);
		});

		it("processes singles but not disabled angle doubles", () => {
			expect(process(["<", "{", "("], "\\<\\<b\\>\\> {c} (d)"))
				.toBe(`\\<\\<b\\>\\> <${HtmlTag.SMALL}>{c}</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>(d)</${HtmlTag.SMALL}>`);
		});
	});

	describe("Parentheses", () => {
		it("wraps (text)", () => {
			expect(process(["((", "("], "(text)")).toBe(`<${HtmlTag.SMALL}>(text)</${HtmlTag.SMALL}>`);
		});

		it("wraps escaped \\(text\\)", () => {
			expect(process(["((", "("], "\\(text\\)")).toBe(`<${HtmlTag.SMALL}>(text)</${HtmlTag.SMALL}>`);
		});

		it("wraps double ((text))", () => {
			expect(process(["((", "("], "((text))")).toBe(`<${HtmlTag.SMALL}>((text))</${HtmlTag.SMALL}>`);
		});

		it("does not double-wrap inside <small>", () => {
			expect(process(["((", "("], "<small>(content)</small>")).toBe(`<small>(content)</small>`);
		});

		it("wraps whitespace ( )", () => {
			expect(process(["((", "("], "( )")).toBe(`<${HtmlTag.SMALL}>( )</${HtmlTag.SMALL}>`);
		});
	});

	describe("Curly braces", () => {
		it("wraps {text}", () => {
			expect(process(["{{", "{"], "{text}")).toBe(`<${HtmlTag.SMALL}>{text}</${HtmlTag.SMALL}>`);
		});

		it("wraps escaped \\{text\\}", () => {
			expect(process(["{{", "{"], "\\{text\\}")).toBe(`<${HtmlTag.SMALL}>{text}</${HtmlTag.SMALL}>`);
		});

		it("wraps double {{text}}", () => {
			expect(process(["{{", "{"], "{{text}}")).toBe(`<${HtmlTag.SMALL}>{{text}}</${HtmlTag.SMALL}>`);
		});

		it("wraps braces containing wiki link: {[[Default]]}", () => {
			expect(process(["{{", "{"], "{[[Default]]}")).toBe(`<${HtmlTag.SMALL}>{[[Default]]}</${HtmlTag.SMALL}>`);
		});

		it("wraps braces containing inline link", () => {
			expect(process(["{{", "{"], "{[file](../../folder/file.md#file%20[ref1])}"))
				.toBe(`<${HtmlTag.SMALL}>{[file](../../folder/file.md#file%20[ref1])}</${HtmlTag.SMALL}>`);
		});

		it("wraps whitespace { }", () => {
			expect(process(["{{", "{"], "{ }")).toBe(`<${HtmlTag.SMALL}>{ }</${HtmlTag.SMALL}>`);
		});
	});

	describe("Empty brackets", () => {
		it("passes through empty []", () => {
			expect(process(["["], "[]")).toBe("[]");
		});

		it("passes through empty ()", () => {
			expect(process(["("], "()")).toBe("()");
		});

		it("passes through empty {}", () => {
			expect(process(["{"], "{}")).toBe("{}");
		});

		it("passes through empty <<>>", () => {
			expect(process(["<<"], "<<>>")).toBe("<<>>");
		});
	});

	describe("Doubles", () => {
		it("wraps <<a>>", () => {
			expect(process(["<<"], "<<a>>")).toBe(`<${HtmlTag.SMALL}><<a>></${HtmlTag.SMALL}>`);
		});

		it("wraps ((b))", () => {
			expect(process(["(("], "((b))")).toBe(`<${HtmlTag.SMALL}>((b))</${HtmlTag.SMALL}>`);
		});

		it("wraps {{c}}", () => {
			expect(process(["{{"], "{{c}}")).toBe(`<${HtmlTag.SMALL}>{{c}}</${HtmlTag.SMALL}>`);
		});

		it("wraps a double bracket even when its single form could also match", () => {
			expect(process(["(", "(("], "((b))")).toBe(`<${HtmlTag.SMALL}>((b))</${HtmlTag.SMALL}>`);
			expect(process(["{", "{{"], "{{c}}")).toBe(`<${HtmlTag.SMALL}>{{c}}</${HtmlTag.SMALL}>`);
		});
	});

	describe("Mixed content", () => {
		it("handles all single types: [a] (b) {c} \\<d\\>", () => {
			expect(process(["[", "<", "<<", "((", "{{", "(", "{"], "[a] (b) {c} \\<d\\>"))
				.toBe(`<${HtmlTag.SMALL}>\\[a\\]</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>(b)</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>{c}</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>\\<d\\></${HtmlTag.SMALL}>`);
		});

		it("handles all doubles: <<a>> ((b)) {{c}}", () => {
			expect(process(["[", "<", "<<", "((", "{{", "(", "{"], "<<a>> ((b)) {{c}}"))
				.toBe(`<${HtmlTag.SMALL}><<a>></${HtmlTag.SMALL}> <${HtmlTag.SMALL}>((b))</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>{{c}}</${HtmlTag.SMALL}>`);
		});
	});

	describe("Obsidian callouts", () => {
	it("preserves callout marker [!NOTE]", () => {
		expect(process(["["], "[!NOTE]")).toBe("[!NOTE]");
	});

	it("preserves callout marker [!WARNING]", () => {
		expect(process(["["], "[!WARNING]")).toBe("[!WARNING]");
	});

	it("preserves full callout syntax > [!NOTE] Title", () => {
		const input = "> [!NOTE] Title\n> This is a note callout";
		expect(process(["["], input)).toBe(input);
	});

	it("preserves full callout syntax > [!WARNING] Title", () => {
		const input = "> [!WARNING] Title\n> Warning content here";
		expect(process(["["], input)).toBe(input);
	});

	it("preserves callout with lowercase type > [!note]", () => {
		const input = "> [!note] Lowercase\n> still works";
		expect(process(["["], input)).toBe(input);
	});

	it("preserves callout in multi-line content with other brackets", () => {
		const input = "> [!INFO] Info\n> Details here\n\nSome [wrapped] content.";
		const expected = "> [!INFO] Info\n> Details here\n\nSome " + `<${HtmlTag.SMALL}>\\[wrapped\\]</${HtmlTag.SMALL}>` + " content.";
		expect(process(["[", "(", "{"], input)).toBe(expected);
	});

	it("preserves callout when mixed with all bracket types", () => {
		const input = "> [!TIP] Tip\n> Useful (advice)\n\nRegular [text] and {curly}";
		const expected =
			"> [!TIP] Tip\n> Useful " + `<${HtmlTag.SMALL}>(advice)</${HtmlTag.SMALL}>` +
			"\n\nRegular " + `<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>` +
			" and " + `<${HtmlTag.SMALL}>{curly}</${HtmlTag.SMALL}>`;
		expect(process(["[", "(", "{", "(("], input)).toBe(expected);
	});
});

describe("No brackets", () => {
		it("passes through plain content unchanged", () => {
			expect(process(["["], "content")).toBe("content");
		});
	});

	describe("Bracket type disabled", () => {
		it("passes through {text} when { not enabled", () => {
			expect(process(["["], "{text}")).toBe("{text}");
		});

		it("passes through (text) when ( not enabled", () => {
			expect(process(["["], "(text)")).toBe("(text)");
		});

		it("passes through \\<text\\> when < not enabled", () => {
			expect(process(["["], "\\<text\\>")).toBe("\\<text\\>");
		});

		it("processes [text] when [ is enabled but { is not", () => {
			expect(process(["["], "[text]")).toBe(`<${HtmlTag.SMALL}>\\[text\\]</${HtmlTag.SMALL}>`);
		});

		it("processes nothing when enabled is empty", () => {
			expect(process([], "(a) {b} [c] \\<d\\>")).toBe("(a) {b} [c] \\<d\\>");
		});

		it("processes only [ and { when enabled = ['[', '{']", () => {
			expect(process(["[", "{"], "[a] (b) {c} \\<d\\>"))
				.toBe(`<${HtmlTag.SMALL}>\\[a\\]</${HtmlTag.SMALL}> (b) <${HtmlTag.SMALL}>{c}</${HtmlTag.SMALL}> \\<d\\>`);
		});

		it("wraps braces containing wiki link when only { enabled", () => {
			expect(process(["{"], "{[[Default]]}")).toBe(`<${HtmlTag.SMALL}>{[[Default]]}</${HtmlTag.SMALL}>`);
		});

		it("wraps braces containing inline link when only { enabled", () => {
			expect(process(["{"], "{[file](../../folder/file.md#file%20[ref1])}"))
				.toBe(`<${HtmlTag.SMALL}>{[file](../../folder/file.md#file%20[ref1])}</${HtmlTag.SMALL}>`);
		});

		it("passes through {{text}} when {{ is not enabled", () => {
			expect(process(["{", "("], "{{text}}")).toBe("{{text}}");
		});

		it("passes through ((text)) when (( is not enabled", () => {
			expect(process(["{", "("], "((text))")).toBe("((text))");
		});

		it("processes singles but not disabled doubles", () => {
			expect(process(["{", "("], "((b)) {c} (d) {{e}}"))
				.toBe(`((b)) <${HtmlTag.SMALL}>{c}</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>(d)</${HtmlTag.SMALL}> {{e}}`);
		});

		it("passes through <<text>> when << is not enabled", () => {
			expect(process(["<"], "<<text>>")).toBe("<<text>>");
		});

		it("passes through <<text>> when only ( and { enabled", () => {
			expect(process(["{", "("], "<<text>>")).toBe("<<text>>");
		});

		it("processes enabled doubles while preserving disabled ones", () => {
			expect(process(["{", "{{", "("], "((x)) {{y}} {z}"))
				.toBe(`((x)) <${HtmlTag.SMALL}>{{y}}</${HtmlTag.SMALL}> <${HtmlTag.SMALL}>{z}</${HtmlTag.SMALL}>`);
		});

		it("preserves inline code containing {{ when {{ is not enabled", () => {
			expect(process(["{", "("], "`{{code}}`")).toBe("`{{code}}`");
		});

		it("passes through all disabled doubles together", () => {
			expect(process(["{", "("], "{{a}} ((b)) <<c>>")).toBe("{{a}} ((b)) <<c>>");
		});
	});
});
