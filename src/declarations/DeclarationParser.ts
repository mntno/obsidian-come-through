import { FullID, IDFilter, NoteID } from "#/data/FullID";
import { CommandableAssistant, CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable } from "#/declarations/CommandDeclarationParser";
import { DeclarationConstants } from "#/declarations/constants";
import { DeclarationCodec, YamlParseErrorCallback } from "#/declarations/DeclarationCodec";
import { CardDeclarable, DefaultableCardDeclarable, ExplicitDeclarationAssistant } from "#/declarations/ExplicitDeclaration";
import { ParserRegistry } from "#/declarations/ParserRegistry";
import { asNoteID, fullIDFromDeclaration } from "#/TypeAssistant";
import { UnexpectedUndefinedError } from "#/utils/errors";
import { FileParser, OffsetRange, SectionRange } from "#/utils/obs/FileParser";
import { App, CachedMetadata, CacheItem, FrontMatterCache, HeadingCache, SectionCache, TFile } from "obsidian";

/**
 * Contains auxiliary information collected during the parsing process.
 */
export interface PostParseInfo {

	/** Declarations that were encountered but needs to be complemented before they can be used. */
	incompleteDeclarationInfos: DeclarationInfo[];

	invalidDeclarationCommands: DeclarationCommandInfo[];

	multipleDefinedIDs: FullID[];

	invalidYaml: {
		source: string;
		section: SectionCache;
		error: Error;
	}[],
}

/**
 * All info needed to extract a {@link CardDeclarable | declaration block} from a note.
 */
export interface DeclarationInfo extends DeclarationInfoBase {
	/** The declaration candidate. */
	declaration: DefaultableCardDeclarable;
}

export interface DeclarationCommandInfo extends DeclarationInfoBase {
	command: CommandableDeclarable;
}

/** Info needed to find a raw declaration string within a file's content. */
interface DeclarationInfoBase {
	/** The note where the declaration was found. */
	noteID: NoteID;
	/** The {@link SectionCache} in {@link noteID} where declaration was found. */
	section: SectionCache;
	/** The location of the declaration within the {@link section}. */
	location: OffsetRange;
}

export class DeclarationParser extends FileParser {

	protected static readonly FULL_ID_REGEX = /(front|f|back|b)@([^\s]+)/i;

	/**
		* Returns `true` as soon as any hint of a declaration is found in {@link file};
		*
		* @todo This method returns `true` as soon as a code block is found — irregardless of its language.
		* @todo This method is somewhat redundant with {@link getAllIDsFromMetadata} in where they look for declarations.
		*
		* @param file
		* @param app
		* @param fileContent If content is known, this method can accurately determine whether {@link file} contains declarations.
		* @returns
		*/
	public static containsDeclarations(file: TFile, app: App, fileContent?: string) {

		let cache;
		try {
			cache = this.fileCacheOrThrow(app, file);
		}
		catch (error) {
			console.error(error);
			return false;
		}

		const noteID = asNoteID(file);

		// Check frontmatter for explicit declaration
		if (cache.frontmatter) {
			for (const key of DeclarationConstants.Frontmatter.KEYS)
				if (Object.hasOwn(cache.frontmatter, key))
					return true;
		}

		// Check there headings that contain an ID
		if (cache.headings) {
			for (const currentHeading of cache.headings)
				if (this.findFullIDInText(currentHeading.heading, noteID) !== null)
					return true;
		}

		if (cache.sections) {
			for (const section of cache.sections) {
				if (this.isCodeSection(section)) {
					if (fileContent) {
						const info = DeclarationParser.parseCodeBlock(this.extractContentFromSection(section, fileContent));
						if (info !== null && DeclarationConstants.CodeBlock.isSupportedLanguage(info.language))
							return true;
					}
					else {
						// It's not possible to get the language of a code block without reading the file content, which is async, and this method must be sync.
						// So true is returned as soon as a code block is found, even though it may not be a declaration.
						return true;
					}
				}
			}
		}

		return false;
	}

	public static async containsDeclarationsAsync(file: TFile, app: App) {
		const fileContent = await this.cachedRead(app, file)
		return this.containsDeclarations(file, app, fileContent);
	}

	public static async getAllIDsInFile(file: TFile, app: App, filter?: IDFilter) {
		return this.getAllIDsFromMetadata(
			asNoteID(file),
			await this.cachedRead(app, file),
			this.fileCacheOrThrow(app, file),
			filter);
	}

	/**
		* Finds all declared {@link FullID|ids} in {@link fileContent} of {@link noteID} based on the provided {@link cache}.
		*
		* @see {@link containsDeclarations}
		*
		* @param noteID
		* @param fileContent
		* @param cache The cache for the {@link file}
		* @param filter
		* @returns
		*/
	public static getAllIDsFromMetadata(noteID: NoteID, fileContent: string, cache: CachedMetadata, filter?: IDFilter) {

		const ids: FullID[] = [];
		const parseInfo: PostParseInfo = {
			incompleteDeclarationInfos: [],
			invalidDeclarationCommands: [],
			invalidYaml: [],
			multipleDefinedIDs: [],
		};

		// Used to detect if IDs were declared more than once.
		const parsedIDs = new Set<string>();

		const checkExistance = (id: FullID) => {
			const str = id.toString();
			if (parsedIDs.has(str)) {
				parseInfo.multipleDefinedIDs.push(id);
				return true;
			}
			else {
				parsedIDs.add(str);
				return false;
			}
		};

		// Check frontmatter for explicit declaration
		if (cache.frontmatter) {
			const declaration = this.getDeclarationFromFrontmatter(cache.frontmatter, noteID, parseInfo);
			if (declaration) {
				const id = fullIDFromDeclaration(declaration, noteID);
				if (!checkExistance(id) && (filter === undefined || filter(id)))
					ids.push(id);
			}
		}

		// Check there headings that contain an ID
		for (const currentHeading of cache.headings ?? []) {
			const id = this.findFullIDInText(currentHeading.heading, noteID);
			if (id !== null && !checkExistance(id)) {
				if (filter === undefined || filter(id))
					ids.push(id);
			}
		}

		// Look for declarations in root level Markdown blocks.
		for (const section of cache.sections ?? []) {

			const createAndAddIDFromDeclaration = (declaration: CardDeclarable) => {
				const id = fullIDFromDeclaration(declaration, noteID);
				if (!checkExistance(id) && (filter === undefined || filter(id)))
					ids.push(id);
			}

			// Explicit declarations
			const explicitDecl = this.getDeclarationFromSection(section, noteID, fileContent, parseInfo);
			if (explicitDecl !== null)
				createAndAddIDFromDeclaration(explicitDecl);

			// Auto generated declarations
			this.getAutoDeclarationsFromSection(section, cache, noteID, fileContent, parseInfo)
				.map(processed => processed.declaration)
				.forEach(declaration => createAndAddIDFromDeclaration(declaration));
		}

		return {
			ids,
			output: parseInfo,
		};
	}

	/**
	 * Searches the {@link text} for a {@link FullID | ID}.
	 *
	 * @param text
	 * @param noteID
	 * @returns
	 */
	protected static findFullIDInText(text: string, noteID: NoteID) {

		const match = this.FULL_ID_REGEX.exec(text);

		if (match !== null) {
			const kind = match[1]?.toLowerCase();
			const cardID = match[2];

			if (kind !== undefined && cardID !== undefined) {
				const isFront = kind[0] === 'f';
				const isBack = kind[0] === 'b';

				if (isFront || isBack)
					return FullID.create(noteID, cardID, isFront);
			}
		}

		return null;
	}

	/**
		* @param frontmatter
		* @returns The first declaration found in {@link frontmatter}.
		*/
	protected static getDeclarationFromFrontmatter(frontmatter: FrontMatterCache, noteID: NoteID, parseInfo?: PostParseInfo) {
		for (const key of DeclarationConstants.Frontmatter.KEYS) {
			const declaration = DeclarationParser.declarationFromFrontmatter(frontmatter[key], (incomplete, location) => {
				parseInfo?.incompleteDeclarationInfos.push({
					noteID: noteID,
					declaration: incomplete,
					section: DeclarationParser.createFrontmatterSectionWithKey(key),
					location: location,
				});
			});
			if (declaration !== null)
				return declaration;
		}
		return null;
	}

	/**
	 * @param section The {@link SectionCache|section} to search within {@link fileContent}.
	 * @param noteID
	 * @param fileContent
	 * @param parseInfo
	 * @returns
	 */
	protected static getDeclarationFromSection(section: SectionCache, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {
		if (!this.isCodeSection(section))
			return null;

		const source = FileParser.extractContentFromSection(section, fileContent);

		return DeclarationParser.createExplicitDeclaration(
			source,
			(parseError) => {
				parseInfo?.invalidYaml.push({
					source,
					section,
					error: parseError
				});
			},
			(incomplete, range) => {
				parseInfo?.incompleteDeclarationInfos.push({
					noteID: noteID,
					declaration: incomplete,
					section: section,
					location: range,
				});
			}
		);
	}

	/**
		* @param section The {@link SectionCache|section} to search within {@link fileContent}.
		* @param command
		* @param cache
		* @param parseInfo
		* @returns An array of all auto generated {@link CardDeclarationAssistant|declarations} along with their {@link SectionRange|range}.
		*/
	protected static getAutoDeclarationsFromSection(section: SectionCache, cache: CachedMetadata, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {

		if (!this.isCodeSection(section))
			return [];

		const source = fileContent.slice(section.position.start.offset, section.position.end.offset);

		const parser = DeclarationParser.createCommandDeclarationParser(
			source,
			(parseError) => {
				parseInfo?.invalidYaml.push({
					source,
					section,
					error: parseError
				})
			},
			(invalidCommand, range) => {
				parseInfo?.invalidDeclarationCommands.push({
					noteID,
					command: invalidCommand,
					section,
					location: range,
				});
			}
		);

		if (parser !== null) {
			this.headingRangeForSection(section, cache, (commandDeclarationSection, inBetweenDelimiter, _sectionNumber, index, delimiters) => {
				parser.parse(commandDeclarationSection.level, inBetweenDelimiter, index, delimiters);
			});
		}

		return parser ? parser.generatedDeclarations : [];
	}

	/**
		* Finds the range to the next heading on the same level (or lower) as the heading that the given {@link section} belongs to.
		*
		* @param section
		* @param cache
		* @param inBetweenCallback Called for each {@link HeadingCache} or {@link SectionCache} between the range to be returned.
		* @returns The {@link SectionRange} that starts with the heading the given {@link section} belongs to, and ends with the subsequent heading on the same level or lower.
		*/
	protected static headingRangeForSection(
		section: SectionCache,
		cache: CachedMetadata,
		inBetweenCallback?: (parentStart: HeadingCache, section: CacheItem, sectionNumber: number, index: number, delimiters: CacheItem[]) => void): SectionRange {

		const relevantSections = [
			...cache.headings ?? [],
			...cache.sections?.filter(p => p.type === this.SECTION_TYPE_THEMATICBREAK) ?? []
		];

		return this.rangeForSection(
			section,
			relevantSections,
			(start, endCandidate) => {
				// A heading section range ends as soon as a heading on the same level as the start heading, or lower, appears.
				if (this.isHeadingCache(start) && this.isHeadingCache(endCandidate))
					return start.level >= endCandidate.level;
				return false;
			},
			inBetweenCallback === undefined ? undefined : (parentStart, section, sectionNumber, currentIndex, delimiters) => {
				if (this.isHeadingCache(parentStart))
					inBetweenCallback(parentStart, section, sectionNumber, currentIndex, delimiters);
				else
					console.error("Expected heading");
			});
	}

	/**
		* Attempts to create a {@link CardDeclarable} from {@link source}.
		*
		* @param source The code block including the three ticks at the beginning and end.
		* @param onParseError
		* @param incompleteCallback Invoked if content of {@link source} is recognized but is missing required properties.
		* @returns `null` if {@link source} is not recognized or it contains invalid YAML.
	*/
	private static createExplicitDeclaration(
		source: string,
		onParseError?: YamlParseErrorCallback,
		incompleteCallback?: (incomplete: DefaultableCardDeclarable, range: OffsetRange) => void) {

		const info = DeclarationParser.parseAndCheckCodeBlock(source);
		if (info === null)
			return null;

		const obj = DeclarationCodec.tryFromYaml(info.content, onParseError);
		if (obj === null)
			return null;

		const declaration = DeclarationParser.tryCreateDeclaration(obj);

		if (declaration === null && ExplicitDeclarationAssistant.Defaultable.is(obj) && incompleteCallback)
			incompleteCallback(obj, info.location);

		return declaration;
	}

	protected static declarationFromFrontmatter(obj: Record<string, unknown>, incompleteCallback?: (incomplete: DefaultableCardDeclarable, range: OffsetRange) => void) {
		const declaration = DeclarationParser.tryCreateDeclaration(obj);

		if (declaration === null && ExplicitDeclarationAssistant.Defaultable.is(obj) && incompleteCallback) {
			// This position should really be the position in the front matter YAML where the declaration is.
			// But, since this is the frontmatter, there's no need slice strings as editing is done with `obsidian` `FileManager.processFrontMatter`.
			incompleteCallback(obj, { start: 0, end: 0 });
		}

		return declaration;
	}

	/**
		* Attempts to create a {@link CommandDeclarationParsable} from {@link source}.
		*
		* @param source The raw code block text string of the command declaration.
		* @param onParseError The formatting of {@link source} invalid YAML.
		* @param onInvalidType
		* @returns `null` if {@link source} is not recognized.
		*/
	private static createCommandDeclarationParser(
		source: string,
		onParseError?: YamlParseErrorCallback,
		onInvalidType?: (command: CommandableDeclarable, range: OffsetRange) => void): CommandDeclarationParsable | null {

		const info = DeclarationParser.parseAndCheckCodeBlock(source);
		if (!info)
			return null;

		const obj = DeclarationCodec.tryFromYaml(info.content, onParseError);
		const commandable = obj !== null && CommandableAssistant.is(obj) ? obj : null;

		let parser: CommandDeclarationParsable | null = null;
		if (commandable !== null) {

			parser = ParserRegistry.tryCreate(commandable);

			if (parser === null && onInvalidType)
				onInvalidType(commandable, info.location);
		}

		return parser;
	}

	/**
		* Checks if this a code block with one of the expected languages; if so, parses it.
		* @param source The code block including the three ticks at the beginning and end.
		* @returns `null` is {@link source} is not a code block or if the block's language is unexpected.
		*/
	private static parseAndCheckCodeBlock(source: string) {
		const info = FileParser.parseCodeBlock(source);

		if (info !== null && !DeclarationConstants.CodeBlock.isSupportedLanguage(info.language))
			return null;

		return info;
	}

	/** @returns `null` if the {@link obj} is not a valid {@link CardDeclarable} */
	private static tryCreateDeclaration(obj: Record<string, unknown>) {
		return ExplicitDeclarationAssistant.is(obj) ? ExplicitDeclarationAssistant.createWithUniqueScope(obj) : null;
	}

	/**
		* Finds the {@link SectionRange|range} that is associated and defined by {@link section} as its boundries.
		*
		* The start delimiter is defined as the first delimiter located before {@link section} is located.
		*
		* @param section A section (such as a code block) that is located within, and thus define, the returned range.
		* @param possibleEndDelimiters
		* @param endPredicate Each call passes a delimiter in {@link possibleEndDelimiters}. Return `true` to assert that the given delimiter marks the end of the range to be returned.
		* @param inBetweenCallback Called for each delimiter in {@link possibleEndDelimiters} where {@link endPredicate} returned `false`.
		* @returns
		*/
	private static rangeForSection(
		section: SectionCache,
		possibleEndDelimiters: CacheItem[],
		endPredicate: (start: CacheItem, endCandidate: CacheItem) => boolean,
		inBetweenCallback?: (start: CacheItem, section: CacheItem, sectionNumber: number, index: number, delimiters: CacheItem[]) => void): SectionRange {

		const range: SectionRange = {
			start: null,
			end: null,
		}

		const numberOfDelimiters = possibleEndDelimiters.length;
		const orderedDelimiters = possibleEndDelimiters.sort((a, b) => a.position.start.offset - b.position.start.offset);

		// Start at bottom. The first delimiter that's not after the section is the start delimiter the section belongs to.
		for (let delimiterCounter = numberOfDelimiters - 1; delimiterCounter >= 0; delimiterCounter--) {
			const delimiter = orderedDelimiters[delimiterCounter];
			if (delimiter === undefined)
				throw new UnexpectedUndefinedError();

			// Delimiter is after section
			if (delimiter.position.start.offset > section.position.end.offset)
				continue;

			range.start = delimiter;

			// The start delimiter has been found. Now start walking toward the bottom again and let the predicates decide when the end delimiter is found.
			for (let nextHeadingIndex = delimiterCounter + 1; nextHeadingIndex < numberOfDelimiters; nextHeadingIndex++) {
				const maybeEndDelimiter = orderedDelimiters[nextHeadingIndex];
				if (maybeEndDelimiter === undefined)
					throw new UnexpectedUndefinedError();
				if (endPredicate(delimiter, maybeEndDelimiter)) {
					range.end = maybeEndDelimiter;
					break;
				}
				else {
					inBetweenCallback?.(
						delimiter,
						maybeEndDelimiter,
						nextHeadingIndex - (delimiterCounter + 1), // Zero-based index of the in-between delimiter.
						nextHeadingIndex,
						orderedDelimiters);
				}
			}

			break;
		}

		return range;
	}

	/**
	 * Once you have the {@link HeadingCache} there's no use for the corresponding {@link SectionCache}.
	 * This is just for completeness.
	 */
	private static findSectionCacheForHeading(headingCache: HeadingCache, cache: CachedMetadata): SectionCache | null {
		return cache.sections?.find(
			(section) =>
				section.type === this.SECTION_TYPE_HEADING &&
				section.position.start.line === headingCache.position.start.line &&
				section.position.start.col === headingCache.position.start.col &&
				section.position.end.line === headingCache.position.end.line &&
				section.position.end.col === headingCache.position.end.col
		) ?? null;
	}

	private static createSectionCacheFromHeading(headingCache: HeadingCache) {
		return {
			type: this.SECTION_TYPE_HEADING,
			position: headingCache.position,
		} satisfies SectionCache;
	}
}
