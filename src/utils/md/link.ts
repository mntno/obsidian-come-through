/**
 * Matches markdown link constructs to protect from bracket processing.
 *
 * Examples:
 * ```
 * [text](url)        → inline link
 * ![alt](img.jpg)    → image link
 * [text][ref]        → reference link
 * [[wiki link]]      → wiki link
 * [text]             → NOT matched (single bracket — left for processing)
 * [[broken           → NOT matched (unclosed wiki link)
 * ```
 */
const MD_LINKS = /!?\[(?:[^[\]]*)\]\((?:[^()]|\([^()]*\))*\)|!?\[(?:[^[\]]*)\]\[(?:[^[\]]*)\](?!\()|\[\[(?:[^[\]]*)\]\]/g;

export const Link = {
	is(text: string): boolean {
		MD_LINKS.lastIndex = 0;
		return MD_LINKS.test(text);
	},
	replace(text: string, replacer: (match: string) => string): string {
		return text.replace(MD_LINKS, replacer);
	},
};
