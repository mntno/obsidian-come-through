import { Env } from "#/env";
import { ContentRendererProcessor } from "#/renderings/content/processors/bases";
import { ContentRendererPreProcessor, PreProcessorParameter } from "#/renderings/content/processors/types";
import { HtmlTag } from "#/utils/dom/constants";
import { Link } from "#/utils/md/link";
import { Str } from "#/utils/ts";

const BRACKET_TOKENS = [
	"(", "((",
	"{", "{{",
	"<", "<<",
	"[",
] as const;

export type BracketToken = (typeof BRACKET_TOKENS)[number];

export type BracketProcessorConfig = {
	enabled: BracketToken[];
};

interface BracketProcessorEntry {
	readonly regex: RegExp;
	readonly replacer: (match: string, inner: string, offset: number, str: string) => string;
}

export class BracketProcessor extends ContentRendererProcessor<BracketProcessorConfig> implements ContentRendererPreProcessor {

	private static readonly SMALL_OPEN_GLOBAL = new RegExp(`<${HtmlTag.SMALL}>`, "g");
	private static readonly SMALL_CLOSE_GLOBAL = new RegExp(`</${HtmlTag.SMALL}>`, "g");
	private static readonly LINK_MARKER = "\x00";
	private static readonly LINK_PLACEHOLDER = new RegExp(`${BracketProcessor.LINK_MARKER}(\\d+)${BracketProcessor.LINK_MARKER}`, "g");
	private static readonly CODE_MARKER = "\x01";
	private static readonly CODE_PLACEHOLDER = new RegExp(`${BracketProcessor.CODE_MARKER}(\\d+)${BracketProcessor.CODE_MARKER}`, "g");
	private static readonly CODE = /(`{3,})([\s\S]*?)\1|(`{1,2})([\s\S]*?)\3/g;
	private static readonly DOUBLE_MARKER = "\x02";
	private static readonly DOUBLE_PLACEHOLDER = new RegExp(`${BracketProcessor.DOUBLE_MARKER}(\\d+)${BracketProcessor.DOUBLE_MARKER}`, "g");
	// Masks every double-bracket form so a disabled double is preserved verbatim.
	// `\<\<` is the escaped form of `<<`; it must be masked as well, otherwise the
	// `<` single would partially match `\<\<x\>\>` as `\<x\>` when `<<` is disabled.
	private static readonly DOUBLE_REGEX = /\(\([\s\S]+?\)\)|\{\{[\s\S]+?\}\}|\\<\\<[\s\S]+?\\>\\>/g;

	private static readonly ALL_BRACKETS: Record<BracketToken, BracketProcessorEntry> = {
		// Matches [content] but excludes:
		// - [[wiki links]]     via (?!\[)
		// - [!callouts]        via (?!!\w+)
		// - checkbox prefixes  via isCheckboxLine in the replacer
		"[":  { regex: /(?:\\?)\[(?!\[)(?!!\w+)([\s\S]+?)\]/g, replacer: (() => {
			const base = BracketProcessor.makeReplacer("\\[", "\\]");
			return (match, inner, offset, str) =>
				inner.length === 1 && BracketProcessor.isCheckboxLine(str.slice(0, offset))
					? match
					: base(match, inner, offset, str);
		})() },
		// Matches (content) or \(content\)
		"(":  { regex: /(?:\\?)\(([\s\S]+?)\)/g, replacer: BracketProcessor.makeReplacer("(", ")") },
		// Matches ((content))
		"((": { regex: /\(\(([\s\S]+?)\)\)/g, replacer: BracketProcessor.makeReplacer("((", "))") },
		// Matches {content} or \{content\}
		"{":  { regex: /(?:\\?)\{([\s\S]+?)\}/g, replacer: BracketProcessor.makeReplacer("{", "}") },
		// Matches {{content}}
		"{{": { regex: /\{\{([\s\S]+?)\}\}/g, replacer: BracketProcessor.makeReplacer("{{", "}}") },
		// Matches escaped \<content\>
		"<":  { regex: /\\<([\s\S]+?)\\>/g, replacer: BracketProcessor.makeReplacer("\\<", "\\>") },
		// Matches <<content>> or escaped \<\<content\>\>
		"<<": { regex: /\\?<\\?<([\s\S]+?)\\?>\\?>/g, replacer: (() => {
			return (match: string, inner: string, offset: number, str: string): string => {
				const cleanInner = inner.replace(/\\$/, "");
				const before = str.slice(0, offset);
				const openLength = match.startsWith("\\<\\<") ? 4 : match.startsWith("\\<") || match.startsWith("<\\") ? 3 : 2;
				const open = match.slice(0, openLength);
				const close = match.slice(openLength + inner.length);
				if (BracketProcessor.insideSmall(before))
					return `${open}${cleanInner}${close}`;
				return `<${HtmlTag.SMALL}>${open}${cleanInner}${close}</${HtmlTag.SMALL}>`;
			};
		})() },
	};

	public handleMarkdown(param: PreProcessorParameter): void {
		Env.log.d("BracketProcessor:handleMarkdown");
		param.markdown = BracketProcessor.process(param.markdown, this.config.enabled);
	}

	private static process(content: string, enabled: BracketToken[]): string {
		if (enabled.length === 0) // Do nothing
			return content;

		const codes: string[] = [];
		const masked = content.replace(BracketProcessor.CODE, (match: string) => {
			codes.push(match);
			return `${BracketProcessor.CODE_MARKER}${codes.length - 1}${BracketProcessor.CODE_MARKER}`;
		});

		if (enabled.includes("[") && masked.includes("["))
			return BracketProcessor.processSquareBrackets(masked, enabled, codes);

		const processed = BracketProcessor.applyProcessors(masked, enabled);
		return processed.replace(BracketProcessor.CODE_PLACEHOLDER, (_, id: string) => codes[Number(id)]!);
	}

	/**
	 * Handles content that contains `[` when `[` is in the enabled list.
	 *
	 * Markdown link syntax (`[[wiki]]`, `[text](url)`, `[text][ref]`) contains
	 * square brackets that would otherwise be matched by the `[` bracket processor.
	 * These links must be masked before processing so they are preserved as-is.
	 */
	private static processSquareBrackets(masked: string, enabled: BracketToken[], codes: string[]): string {
		const links: string[] = [];
		const linkMasked = Link.replace(masked, (match) => {
			links.push(match);
			return `${BracketProcessor.LINK_MARKER}${links.length - 1}${BracketProcessor.LINK_MARKER}`;
		});

		const processed = BracketProcessor.applyProcessors(linkMasked, enabled);

		let result = processed.replace(BracketProcessor.LINK_PLACEHOLDER, (_, id: string) => links[Number(id)]!);
		result = result.replace(BracketProcessor.CODE_PLACEHOLDER, (_, id: string) => codes[Number(id)]!);
		return result;
	}

	private static readonly br = "<br>";

	private static isCheckboxLine(before: string): boolean {
		if (before.length === 0)
			return false;
		const idx = Math.max(before.lastIndexOf(Str.LF), before.lastIndexOf(BracketProcessor.br));
		if (idx === -1)
			return /^\s*-\s+$/.test(before);
		const separator = before[idx] === Str.LF ? Str.LF : BracketProcessor.br;
		return /^\s*-\s+$/.test(before.slice(idx + separator.length));
	}

	/** Whether {@link str} has more open `<small>` than close `</small>` tags. */
	private static insideSmall(str: string): boolean {
		const opens = str.match(BracketProcessor.SMALL_OPEN_GLOBAL);
		const closes = str.match(BracketProcessor.SMALL_CLOSE_GLOBAL);
		return (opens?.length ?? 0) > (closes?.length ?? 0);
	}

	/** Returns a replacer that wraps content between {@link escOpen} and {@link escClose} in `<small>`, unless already inside one. */
	private static makeReplacer(escOpen: string, escClose: string): (match: string, inner: string, offset: number, str: string) => string {
		return (_match: string, inner: string, offset: number, str: string): string => {
			const cleanInner = inner.replace(/\\$/, "");
			const before = str.slice(0, offset);
			if (BracketProcessor.insideSmall(before))
				return `${escOpen}${cleanInner}${escClose}`;
			return `<${HtmlTag.SMALL}>${escOpen}${cleanInner}${escClose}</${HtmlTag.SMALL}>`;
		};
	}

	/** Applies each enabled bracket processor to {@link text} sequentially via string replacement. */
	private static applyProcessors(text: string, enabled: BracketToken[]): string {

		// Doubles are processed before singles so a single does not match inside a double,
		// e.g. `(` must not match the inner `(b)` of `((b))`.
		const ordered = [...BRACKET_TOKENS].sort((a, b) => b.length - a.length);

		const doubles: string[] = [];
		let result = text;
		// Only mask when at least one double type is disabled. Disabled doubles are
		// hidden behind a placeholder so they pass through untouched and no enabled
		// single can match inside them; enabled doubles are left in place and
		// processed below. Hidden content is restored verbatim at the end.
		if (!enabled.includes("((") || !enabled.includes("{{") || !enabled.includes("<<")) {
			result = result.replace(BracketProcessor.DOUBLE_REGEX, (match: string): string => {
				const type: BracketToken = match.startsWith("((") ? "((" : match.startsWith("{{") ? "{{" : "<<";
				if (enabled.includes(type))
					return match;
				doubles.push(match);
				return `${BracketProcessor.DOUBLE_MARKER}${doubles.length - 1}${BracketProcessor.DOUBLE_MARKER}`;
			});
		}

		for (const name of ordered) {
			if (!enabled.includes(name))
				continue;
			const bracket = BracketProcessor.ALL_BRACKETS[name];
			result = result.replace(bracket.regex, bracket.replacer);
		}

		if (doubles.length === 0)
			return result;
		return result.replace(BracketProcessor.DOUBLE_PLACEHOLDER, (_, id: string) => doubles[Number(id)]!);
	}
}
