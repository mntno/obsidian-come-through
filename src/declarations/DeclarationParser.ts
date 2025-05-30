import { CardDeclaration, DefaultableCardDeclarable } from "declarations/CardDeclaration";
import { CommandableDeclarable, CommandDeclarationAssistant } from "declarations/CommandDeclaration";
import { Declaration, DeclarationRange } from "declarations/Declaration";
import { FileParser, SectionRange } from "FileParser";
import { FullID, IDFilter, NoteID } from "FullID";
import { App, CachedMetadata, CacheItem, FrontMatterCache, HeadingCache, SectionCache, TFile } from "obsidian";
import { asNoteID, fullIDFromDeclaration } from "TypeAssistant";

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
 * All info needed to extract a {@link CardDeclaration|declaration block} from a note.
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
	location: DeclarationRange;
}

export class DeclarationParser extends FileParser {

	protected static readonly FULL_ID_REGEX = /(front|f|back|b)@([^\s]+)/i;

	public static async getAllIDsInFile(file: TFile, app: App, filter?: IDFilter) {
		return this.getAllIDsFromMetadata(
			asNoteID(file),
			await this.cachedRead(app, file),
			this.fileCacheOrThrow(app, file),
			filter);
	}

	/**
	 * Finds all declared {@link FullID|ids} in {@link fileContent} of {@link noteID} based on the provided {@link cache}.
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

		// Check frontmatter for card declaration
		if (cache.frontmatter) {
			const declaration = this.getDeclarationFromFrontmatter(cache.frontmatter);
			if (declaration) {
				const id = fullIDFromDeclaration(declaration, noteID);
				if (!checkExistance(id) && (filter === undefined || (filter && filter(id))))
					ids.push(id);
			}
		}

		// Look for ID declarations in headings
		for (const currentHeading of cache.headings ?? []) {
			const id = this.findFullIDInText(currentHeading.heading, noteID);
			if (id && !checkExistance(id)) {
				if (filter === undefined || (filter && filter(id)))
					ids.push(id);
			}
		}

		// Look for declarations in root level Markdown blocks.
		for (const section of cache.sections ?? []) {

			const createAndAddIDFromDeclaration = (declaration: CardDeclaration) => {
				const id = fullIDFromDeclaration(declaration, noteID);
				if (!checkExistance(id) && (filter === undefined || (filter && filter(id))))
					ids.push(id);
			}

			// Explicit declarations
			const explicitDecl = this.getDeclarationFromSection(section, noteID, fileContent, parseInfo);
			if (explicitDecl)
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

		if (match) {
			const kind = match[1].toLowerCase();
			const isFront = kind[0] === 'f';
			const isBack = kind[0] === 'b';
			const cardID = match[2];

			if (isFront || isBack)
				return FullID.create(noteID, cardID, isFront);
		}

		return null;
	}

	/**
		* @param frontmatter
		* @returns The first declaration found in {@link frontmatter}.
		*/
	protected static getDeclarationFromFrontmatter(frontmatter: FrontMatterCache) {
		for (const key of Declaration.supportedFrontmatterKeys) {
			const maybeDeclaration = frontmatter[key];
			if (CardDeclaration.conformsToDefaultable(maybeDeclaration) && CardDeclaration.conformsToDeclarable(maybeDeclaration))
				return maybeDeclaration;
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

		const source = fileContent.slice(section.position.start.offset, section.position.end.offset);

		return CardDeclaration.parseCodeBlock(
			source,
			(parseError) => {
				parseInfo?.invalidYaml.push({
					source,
					section,
					error: parseError
				});
			},
			(incomplete, location) => {
				parseInfo?.incompleteDeclarationInfos.push({
					noteID: noteID,
					declaration: incomplete,
					section: section,
					location: location,
				});
			}
		);
	}

	/**
		* @param section The {@link SectionCache|section} to search within {@link fileContent}.
		* @param command
		* @param cache
		* @param parseInfo
		* @returns An array of all auto generated {@link CardDeclaration|declarations} along with their {@link SectionRange|range}.
		*/
	protected static getAutoDeclarationsFromSection(section: SectionCache, cache: CachedMetadata, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {

		if (!this.isCodeSection(section))
			return [];

		const source = fileContent.slice(section.position.start.offset, section.position.end.offset);

		const parser = CommandDeclarationAssistant.createParser(
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

		if (parser) {
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

			// Delimiter is after section
			if (orderedDelimiters[delimiterCounter].position.start.offset > section.position.end.offset)
				continue;

			const startDelimiter = orderedDelimiters[delimiterCounter];
			range.start = startDelimiter;

			// The start delimiter has been found. Now start walking toward the bottom again and let the predicates decide when the end delimiter is found.
			for (let nextHeadingIndex = delimiterCounter + 1; nextHeadingIndex < numberOfDelimiters; nextHeadingIndex++) {
				const maybeEndDelimiter = orderedDelimiters[nextHeadingIndex];
				if (endPredicate(startDelimiter, maybeEndDelimiter)) {
					range.end = maybeEndDelimiter;
					break;
				}
				else {
					inBetweenCallback?.(
						startDelimiter,
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
