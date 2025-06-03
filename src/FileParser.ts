import { App, CacheItem, HeadingCache, Pos, SectionCache, TFile } from "obsidian";

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

/** A part of a file's content delimited by two {@link SectionCache} */
export type SectionRange = {
	/** If `null`, starts at the beginning.*/
	start: SectionCache | CacheItem | null;
	/** If `null`, there's no end delimiter, thus ends at the end. */
	end: SectionCache | CacheItem | null;
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
	externalType: "frontmatter" //| "backmatter"
}


export abstract class FileParser {

	protected static readonly SECTION_TYPE_HEADING = "heading";
	protected static readonly SECTION_TYPE_CODE = "code";
	protected static readonly SECTION_TYPE_THEMATICBREAK = "thematicBreak";

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

	protected static createFrontmatterSectionWithKey(key: string): ExternalSectionCache {
		return { ...FrontmatterSection, ... { id: key } };
	}

	protected static isCodeSection(section: SectionCache) {
		return section.type === this.SECTION_TYPE_CODE;
	}

	public static isExternalSectionCache(section: CacheItem): section is ExternalSectionCache {
		return FileParser.isSectionCache(section) && Object.hasOwn(section, "externalType");
	}

	protected static isHeadingCache(cache: CacheItem): cache is HeadingCache {
		return Object.hasOwn(cache, "heading") && Object.hasOwn(cache, "level");
	}

	protected static isSectionCache(cache: CacheItem): cache is SectionCache {
		// `id` may not exist; cannot be used.
		return Object.hasOwn(cache, "type");
	}

	protected static isSectionType(cache: CacheItem, type: string): cache is SectionCache {
		return this.isSectionCache(cache) && cache.type === type;
	}
}
