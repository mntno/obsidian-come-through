import { App, CacheItem, HeadingCache, Pos, SectionCache, TFile } from "obsidian";

/**
 * Base {@link Error} thrown from {@link FileParser}.
 */
export class FileParserError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "FileParserError";
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
	start: { line: 0, col: 0, offset: 0},
	end: { line: 0, col: 0, offset: 0},
}

export const FrontmatterSection: ExternalSectionCache = {
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
		if (!cache)
			throw new FileParserError(`No cached metadata available for ${file.path}.`);
		return cache;
	}

	protected static async cachedRead(app: App, file: TFile) {
		return await app.vault.cachedRead(file);
	}

	protected static isCodeSection(section: SectionCache) {
		return section.type === this.SECTION_TYPE_CODE;
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
