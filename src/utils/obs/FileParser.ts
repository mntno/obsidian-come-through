import { App, CacheItem, HeadingCache, Loc, Pos, SectionCache, TFile } from "obsidian";
import { Arr, UNARY_UNION_SUPPRESS } from "#/utils/ts";

interface FileParserErrorOptions extends ErrorOptions {
	type: "file cache unavailable";
	file: TFile;
	[key: string]: unknown;
}

/**
 * Base {@link Error} thrown from {@link FileParser}.
 */
export class FileParserError extends Error {
	constructor(message: string, options: FileParserErrorOptions) {
		super(message, options);
		this.name = "FileParserError";
		this.options = options;
	}
	private readonly options: FileParserErrorOptions;
	public get type() {
		return this.options.type;
	}
	public get file() {
		return this.options.file;
	}
}

export type OffsetRange = {
	start: number;
	end: number;
};

/** A part of a file's content delimited by two {@link SectionCache} */
export type SectionRange = {
	/** If `null`, starts at the beginning.*/
	start: SectionCache | CacheItem | null;
	/** If `null`, there's no end delimiter, thus ends at the end. */
	end: SectionCache | CacheItem | null;
}

export type CodeBlockInfo = {
	/** May be an empty string if language is not specified. */
	language: string;
	/** The location of the content relative to the first tick of the block. */
	location: OffsetRange;
	content: string;
}

/** Represents the unlimited range. */
export const FullSectionRange: SectionRange = {
	start: null,
	end: null,
};

/** Used to represent the the absence of a position. */
const NoPosition: Pos = {
	start: { line: 0, col: 0, offset: 0 },
	end: { line: 0, col: 0, offset: 0 },
}

/** Set `id` to the YAML key in the frontmatter where the declaration is. See {@link FileParser.createFrontmatterSectionWithKey} */
const FrontmatterSection: ExternalSectionCache = {
	externalType: "frontmatter",
	type: "yaml",
	position: NoPosition
}

/**
* Sections of the file that are not part of the actual Markdown.
*/
interface ExternalSectionCache extends SectionCache {
	externalType: "frontmatter" | typeof UNARY_UNION_SUPPRESS //| "backmatter"
}

/** Values of {@link SectionCache.type}. {@link FileParser.isSectionCacheWithType} */
export const SectionType = {
	Heading: "heading",
	Code: "code",
	ThematicBreak: "thematicBreak",
	Table: "table",
} as const;

export type SectionType = typeof SectionType[keyof typeof SectionType];

/**
	* Provides a set of common helpers for interpreting the structure and metadata of markdown files.
	* @abstract
	*/
export abstract class FileParser {

	protected static fileCacheOrThrow(app: App, file: TFile) {
		const cache = app.metadataCache.getFileCache(file);
		if (cache)
			return cache;

		throw new FileParserError(
			`No cached metadata available for ${file.path}.`, {
			type: "file cache unavailable",
			file: file,
		});
	}

	protected static async cachedRead(app: App, file: TFile) {
		return await app.vault.cachedRead(file);
	}

	protected static isSectionCache(cache: CacheItem): cache is SectionCache {
		// `id` may not exist; cannot be used.
		return Object.hasOwn(cache, "type");
	}

	protected static isSectionCacheWithType(cache: CacheItem | SectionCache, type: SectionType): cache is SectionCache {
		return this.isSectionCache(cache) && cache.type === type;
	}

	protected static isCodeSection(section: SectionCache) {
		return FileParser.isSectionCacheWithType(section, SectionType.Code);
	}

	public static isExternalSectionCache(section: CacheItem): section is ExternalSectionCache {
		return FileParser.isSectionCache(section) && Object.hasOwn(section, "externalType");
	}

	protected static isHeadingCache(cache: CacheItem): cache is HeadingCache {
		return Object.hasOwn(cache, "heading") && Object.hasOwn(cache, "level");
	}

	protected static asHeadingCache(cache: CacheItem): HeadingCache | null {
		return FileParser.isHeadingCache(cache) ? cache : null;
	}

	/**
	 * @param source The code block including the three ticks at the beginning and end. See {@link extractContentFromSection}.
	 * @returns `null` is {@link source} is not a code block.
	 */
	public static parseCodeBlock(source: string): CodeBlockInfo | null {
		const firstLine = source.split("\n", 1).first();
		if (!firstLine)
			return null;

		// Make sure there are at least three ticks/tildes on first line
		if (firstLine.length < FileParser.CODE_BLOCK_MARKER_LENGTH)
			return null;

		const language = firstLine.slice(FileParser.CODE_BLOCK_MARKER_LENGTH).trim();
		const location = {
			start: firstLine.length + 1, // Add \n back
			end: source.length - FileParser.CODE_BLOCK_MARKER_LENGTH
		};

		return {
			language,
			location,
			content: source.slice(location.start, location.end),
		};
	}
	private static readonly CODE_BLOCK_MARKER_LENGTH = 3;

	protected static readonly create = {

		frontmatterSectionWithKey(key: string): ExternalSectionCache {
			return { ...FrontmatterSection, ... { id: key } };
		},

		cacheItem(start: Loc, end?: Loc): CacheItem {
			return {
				position: {
					start: start,
					end: end !== undefined ? end : start,
				}
			};
		},

		offsetRange: (start: number, end: number): OffsetRange => ({ start, end }),

		offsetRangeFromSection(section: SectionCache): OffsetRange {
			return {
				start: section.position.start.offset,
				end: section.position.end.offset
			};
		},

		sectionCache(type: string, position: Pos): SectionCache {
			return { type: type, position: position };
		},

		sectionRange(start: SectionCache | CacheItem | null, end: SectionCache | CacheItem | null): SectionRange {
			return { start: start, end: end };
		},
	};

	protected static readonly content = {
		/**
		 * @param section
		 * @param fileContent The full content of the file the section belongs to.
		 * @returns The raw text of the section, clamped to the length of {@link fileContent}.
		 */
		fromSection(section: SectionCache, fileContent: string): string {
			return fileContent.slice(
				Math.min(section.position.start.offset, fileContent.length),
				Math.min(section.position.end.offset, fileContent.length)
			);
		},
	};

	protected static readonly find = {
		/**
			* Find the end delimiter, i.e., the next heading at the same level or lower.
			* @param headingLevel The level the heading to return must be equal or lower to.
			* @param index The index in {@link delimiters} to start searching from.
			* @param delimiters
			* @returns `null` if a next heading on the same level or lower was not found.
			*/
		nextHeading(headingLevel: number, index: number, delimiters: CacheItem[]) {
			for (let nextIndex = index + 1; nextIndex < delimiters.length; nextIndex++) {
				const nextDelimiter = Arr.expAt(delimiters, nextIndex);
				if (This.isHeadingCache(nextDelimiter) && headingLevel >= nextDelimiter.level)
					return nextDelimiter;
			}
			return null;
		},

		previousAndNextHeading(index: number, delimiters: CacheItem[]): { previous: HeadingCache | null, next: HeadingCache | null } {
			let previous: HeadingCache | null = null;

			for (let prevIndex = index - 1; prevIndex >= 0; prevIndex--) {
				const delimiter = Arr.expAt(delimiters, prevIndex);
				if (This.isHeadingCache(delimiter)) {
					previous = delimiter;
					break;
				}
			}

			return {
				previous,
				next: previous === null ? null : This.find.nextHeading(previous.level, index, delimiters)
			};
		},
	};
}

const This = FileParser;
