const AlternateHeadingsCommandNames = [
	"alternate headings", "alt headings", "ah",
] as const;

const HeadingAndDelimiterCommandNames = [
	"heading and delimiter", "hd",
] as const;

const HeadingIsFrontCommandNames = [
	"heading is front", "hf",
] as const;

const TableCommandNames = [
	"table",
] as const;

const AllCommandNames = [
	...AlternateHeadingsCommandNames,
	...HeadingAndDelimiterCommandNames,
	...HeadingIsFrontCommandNames,
	...TableCommandNames,
] as const

export type CommandName = typeof AllCommandNames[number];

export const Commands = {
	Name: {
		All: AllCommandNames,
		AlternateHeadings: AlternateHeadingsCommandNames,
		HeadingAndDelimiter: HeadingAndDelimiterCommandNames,
		HeadingIsFront: HeadingIsFrontCommandNames,
		Table: TableCommandNames,
		exists: (name: string): name is CommandName => (AllCommandNames as readonly string[]).includes(name),
	}
};
