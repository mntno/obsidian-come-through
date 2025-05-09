import { DeclarationRange } from "declarations/Declaration";
import { AlternateHeadingsDeclarationCommand, DeclarationCommandAssistant, DeclarationCommandInterface } from "declarations/CommandDeclaration";
import { CardDeclaration, IDScope, IncompleteDeclarationSpecification } from "declarations/CardDeclaration";
import { NoteID, CardID, FullID } from "FullID";
import { App, CachedMetadata, CacheItem, HeadingCache, SectionCache, TFile } from "obsidian";
import { asNoteID, fullIDFromDeclaration } from "TypeAssistant";

//#region Exported

export interface ParseOptions {
	contentRead?: ContentReadOptions,
	likelyNoteIDs?: NoteID[],
}

/**
 * Options regarding how the content of cards are populated.
 */
export interface ContentReadOptions {
	hideCardSectionMarker?: boolean;
	hideDeclarationBlock?: boolean;
}

/**
 * Contains auxiliary information collected during the parsing process.
 */
export interface PostParseInfo {

	/** Declarations that were encountered but needs to be complemented before they can be used. */
	incompleteDeclarationInfos: DeclarationInfo[],

	invalidDeclarationCommands: DeclarationCommandInfo[],

	multipleDefinedIDs: FullID[],

	invalidYaml: {
		source: string,
		section: SectionCache,
		error: Error,
	}[],
}

/**
 * All info needed to extract a {@link CardDeclaration|declaration block} from a note.
 */
export interface DeclarationInfo extends DeclarationInfoBase {
	/** The declaration candidate. */
	declaration: IncompleteDeclarationSpecification,
}

export interface DeclarationCommandInfo extends DeclarationInfoBase {
	command: DeclarationCommandInterface,
}

interface DeclarationInfoBase {
	/** The note where the {@link declaration} was found. */
	noteID: NoteID,
	/** {@link SectionCache|Section} in {@link noteID} where {@link declaration} was found. */
	section: SectionCache,
	/** The location of the {@link declaration} within the {@link section}. */
	location: DeclarationRange,
}

/**
 * Represents a complete card that can be displayed to the user, e.g., for review.
 * The {@link FullID.cardID} part of both {@link frontID} and {@link backID} are expected to be equal.
 */
export type ParsedCard = {
	frontID: FullID;
	frontMarkdown: string;
	backID: FullID;
	backMarkdown: string;
}

/**
 * Represents a card that potentially was only partly found.
 * It can only be turned into a complete {@link ParsedCard|card} that can be reviewed if all values are non-null.
 * Use {@link FileParser.isComplete} to check.
 */
export type MaybeParsedCard = {
	frontID?: FullID;
	frontMarkdown?: string;
	backID?: FullID;
	backMarkdown?: string;
}

export type ParsedCardResult = {
	complete: ParsedCard | null;
	incomplete: MaybeParsedCard | null;
}

/**
 * Base {@link Error} thrown from {@link FileParser}.
 */
export class FileParserError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "FileParserError";
	}
}

export type IDFilter = (id: FullID) => boolean;

//#endregion

//#region Internal

/**
 * Info needed to read the {@link ContentInfo|content} associated with {@link id}.
 */
interface IdentifiedContentInfo {
	id: FullID;
	scope: IDScope;
	contentInfo: ContentInfo
}

const FULL_ID_REGEX = /(front|f|back|b)@([^\s]+)/i;

type ParseResult = Record<CardID, MaybeParsedCard>;

type IdentifiedContentInfoFilter = (id: IdentifiedContentInfo) => boolean;
type ParsedCardBreaker = (info: IdentifiedContentInfo, card: MaybeParsedCard) => boolean;

interface PopulationPredicate {
	/**
	 * Which {@link IdentifiedContentInfo|info} to include when iterating content.
	 *
	 * This usually not known for both sides so be careful not to exclude files
	 * that might contain the content being searched for.
	 *
	 * Can be used to avoid unnecessary processing.
	 */
	iterationFilter?: IdentifiedContentInfoFilter,

	/** Whether to stop iterating. Use to avoid unnecessary processing. */
	isDone?: ParsedCardBreaker,
}

const SECTION_TYPE_HEADING = "heading";
const SECTION_TYPE_CODE = "code";

type ContentRange = {
	start: number;
	end: number;
}

/** A part of a file's content delimited by two {@link SectionCache} */
type SectionRange = {
	/** If `null`, starts at the beginning.*/
	start: SectionCache | CacheItem | null;
	/** If `null`, there's no end delimiter, thus ends at the end. */
	end: SectionCache | CacheItem | null;
}

/**
 * Info needed to read content declared in a certain {@link section}.
 */
interface ContentInfo {
	/**
	 * The section where the id is declared.
	 *
	 * Look at {@link SectionCache.type} to find the location of the ID declaration in the Markdown structure, e.g., "heading" or "code".
	*/
	section: SectionCache;

	range: SectionRange;
}

//#endregion

export class FileParser {

	//#region Get ID

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

		// Look for IDs declarations in headings
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

	//#endregion

	//#region Get Card

	public static async getAllCards(app: App, options?: ParseOptions) {

		const parseResult: ParseResult = {};

		for (const file of app.vault.getFiles())
			await this.getContentFromFile(file, app, parseResult, undefined, options);

		return this.processParseResult(parseResult);
	}

	public static async getCard(id: FullID, app: App, options?: ParseOptions) {

		const predicate: PopulationPredicate = {
			iterationFilter: (idContentInfo) => {

				// For unique ids. If also filtering on noteID, then only this file will be looked at,
				// while the other side is in another file and thus won't be found.
				if (idContentInfo.scope == IDScope.UNIQUE)
					return idContentInfo.id.isCardEqual(id);

				// Should work for file-scoped IDs.
				if (idContentInfo.scope == IDScope.NOTE)
					return idContentInfo.id.isEqual(id, true);

				throw new Error(`Unrecognized ID scope for ID: ${idContentInfo.id}`);
			},
			isDone: (idContentInfo, maybeParsedCard) => {
				if (!this.isComplete(maybeParsedCard))
					return false;

				if (idContentInfo.scope == IDScope.UNIQUE)
					return maybeParsedCard.frontID.isCardEqual(id);

				if (idContentInfo.scope == IDScope.NOTE)
					return maybeParsedCard.frontID.isEqual(id, true);

				throw new Error(`Unrecognized ID scope for ID: ${idContentInfo.id}`);
			}
		};

		const cardID = id.cardIDOrThrow();
		const parseResult: ParseResult = {};

		// Start with the most likely file that will contain both sides of the card.
		for (const file of this.getAllFilesSortedByLikelihood(id, app, options?.likelyNoteIDs)) {

			await this.getContentFromFile(file, app, parseResult, predicate, options);

			// As soon as both sides are found, stop iterating through the rest of the files.
			if (Object.hasOwn(parseResult, cardID) && this.isComplete(parseResult[cardID]))
				break;
		}

		const notFound: ParsedCardResult = { complete: null, incomplete: null };
		if (!Object.hasOwn(parseResult, cardID))
			return notFound;

		const separated = this.processParseResult(parseResult);
		const resultCard = separated[cardID];

		return resultCard ?? notFound;
	}

	/**
	 * Separates those cards that are completed (i.e. both sides were found), with those uncompleted (only one side found).
	 * @param maybeIncompleteCards
	 * @returns
	 */
	private static processParseResult(maybeIncompleteCards: ParseResult) {

		const complete: Record<CardID, ParsedCardResult> = {};

		for (const cardId in maybeIncompleteCards) {
			const maybe = maybeIncompleteCards[cardId];
			if (this.isComplete(maybe)) {
				complete[cardId] = {
					complete: maybe,
					incomplete: null,
				};
			} else {
				complete[cardId] = {
					complete: null,
					incomplete: maybe,
				};
			}
		}
		return complete;
	}

	private static isComplete(card: MaybeParsedCard): card is ParsedCard {
		return (
			card.frontID &&
			typeof card.frontMarkdown === 'string' &&
			card.backID &&
			typeof card.backMarkdown === 'string'
		) ? true : false;
	}

	//#endregion

	/**
	 * Searches the {@link text} for a {@link FullID | ID}.
	 *
	 * @param text
	 * @param noteID
	 * @returns
	 */
	private static findFullIDInText(text: string, noteID: NoteID) {

		const match = FULL_ID_REGEX.exec(text);

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
	 * @param section The {@link SectionCache|section} to search within {@link fileContent}.
	 * @param noteID
	 * @param fileContent
	 * @param parseInfo
	 * @returns
	 */
	private static getDeclarationFromSection(section: SectionCache, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {
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

	private static getAutoDeclarationsFromSection(section: SectionCache, cache: CachedMetadata, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {

		let generatedDeclarations: { declaration: CardDeclaration, range: SectionRange }[] = [];

		if (!this.isCodeSection(section))
			return generatedDeclarations;

		const source = fileContent.slice(section.position.start.offset, section.position.end.offset);
		const assistant = DeclarationCommandAssistant.createFromCodeSection(source);
		if (!assistant)
			return generatedDeclarations;

		const command = assistant.parse((parseError) => {
			parseInfo?.invalidYaml.push({
				source,
				section,
				error: parseError
			});
		});
		if (!command)
			return generatedDeclarations;

		const addInvalidCommand = (command: DeclarationCommandInterface) => {
			parseInfo?.invalidDeclarationCommands.push({
				noteID,
				command: command,
				section,
				location: assistant.yamlRange,
			});
		}

		if (!DeclarationCommandAssistant.isTypeValid(command)) {
			addInvalidCommand(command);
			return generatedDeclarations;
		}

		if (DeclarationCommandAssistant.conformsToAlternateHeadings(command)) {

			if (!DeclarationCommandAssistant.isAlternateHeadingsValid(command)) {
				addInvalidCommand(command);
				return generatedDeclarations;
			}

			generatedDeclarations = [
				...generatedDeclarations,
				...this.processAlternateHeadingsCommand(section, command, cache, parseInfo)
			];
		}

		return generatedDeclarations;
	}

	/**
	* @param section Where the {@link command} is declared.
	* @param command
	* @param cache
	* @param parseInfo
	* @returns An array of all auto generated {@link CardDeclaration|declarations} along with their {@link SectionRange|range}.
	*/
	private static processAlternateHeadingsCommand(section: SectionCache, command: AlternateHeadingsDeclarationCommand, cache: CachedMetadata, parseInfo?: PostParseInfo) {

		const autoGenerated: { declaration: CardDeclaration, range: SectionRange }[] = [];

		let counter = 0;
		const processHeadings = (parentStart: HeadingCache, childStart: HeadingCache, childEnd: HeadingCache | null) => {

			// Ignore headings on unspecified levels
			if (childStart.level != parentStart.level + command.level)
				return;

			const isFront = counter++ % 2 == 0;
			const id = isFront ? childStart.heading : autoGenerated.last()!.declaration.id;

			autoGenerated.push({
				declaration: new CardDeclaration(
					id,
					isFront ? "front" : "back",
					IDScope.NOTE,
					command.deckID,
					true),
				range: {
					start: childStart,
					end: childEnd,
				},
			});
		}

		this.rangeForSectionDelimitedByHeadings(section, cache, processHeadings);

		return autoGenerated;
	}

	//#region Get Content

	private static async getContentFromFile(
		file: TFile,
		app: App,
		result: ParseResult,
		predicate?: PopulationPredicate,
		options?: ParseOptions) {

		const fileContent = await this.cachedRead(app, file);

		this.getContentFromInfos(
			fileContent,
			this.findAllContentInfosInFile(
				asNoteID(file),
				fileContent,
				this.fileCacheOrThrow(app, file)
			),
			result,
			predicate,
			options);
	}

	/**
	 *
	 * @param noteID
	 * @param fileContent
	 * @param cache
	 * @returns
	 */
	private static findAllContentInfosInFile(noteID: NoteID, fileContent: string, cache: CachedMetadata) {

		const cardInfos: IdentifiedContentInfo[] = [];

		//#region Headings

		const headings: HeadingCache[] = cache.headings ?? [];
		const numberOfHeadings = headings.length;
		for (let headingIndex = 0; headingIndex < numberOfHeadings; headingIndex++) {

			const currentHeading = headings[headingIndex];
			const id = this.findFullIDInText(currentHeading.heading, noteID);
			if (!id)
				continue;

			// Find the end position by looking at the next heading at the same level or lesser.
			let nextFrontHeadingStartPos: HeadingCache | null = null;
			let nextHeadingIndex = headingIndex + 1;

			while (nextHeadingIndex < numberOfHeadings && nextFrontHeadingStartPos === null) {
				const nextHeading = headings[nextHeadingIndex];
				if (nextHeading.level <= currentHeading.level)
					nextFrontHeadingStartPos = nextHeading;
				nextHeadingIndex += 1;
			}

			cardInfos.push({
				id: id,
				scope: IDScope.NOTE,
				contentInfo: {
					range: {
						start: currentHeading,
						end: nextFrontHeadingStartPos,
					},
					section: {
						type: SECTION_TYPE_HEADING,
						position: currentHeading.position,
					}
				}
			});
		}

		//#endregion

		//#region Sections

		for (const section of cache.sections ?? []) {

			const declaration = this.getDeclarationFromSection(section, noteID, fileContent);
			if (!declaration)
				continue;

			cardInfos.push({
				id: fullIDFromDeclaration(declaration, noteID),
				scope: declaration.idScope,
				contentInfo: {
					section: section,
					range: this.rangeForSectionDelimitedByHeadings(section, cache),
				}
			});
		}

		for (const section of cache.sections ?? []) {
			this.getAutoDeclarationsFromSection(section, cache, noteID, fileContent)
				.forEach(processed => {
					cardInfos.push({
						id: fullIDFromDeclaration(processed.declaration, noteID),
						scope: processed.declaration.idScope,
						contentInfo: {
							section: section, // When declaration.autoGenerated is `true`, this points to the section that contains the command, as the actual card declarations don't exist.
							range: processed.range,
						}
					});
				});
		}

		//#endregion

		return cardInfos;
	}

	/**
	 * Finds the start and end positions in a file, using its {@link cache},
	 * that the given {@link section} declares as its content.
	 *
	 * @param section One of {@link CachedMetadata.sections} of {@link cache}.
	 * @param cache Cache of the file which the returned {@link ContentInfo} refers to.
	 * @param inBetweenCallback
	 * @returns
	 */
	private static rangeForSectionDelimitedByHeadings(
		section: SectionCache,
		cache: CachedMetadata,
		inBetweenCallback?: (parentStart: HeadingCache, childStart: HeadingCache, childEnd: HeadingCache | null, childNumber: number, index: number, array: HeadingCache[]) => void): SectionRange {

		return this.rangeForSection<HeadingCache>(
			section,
			cache.headings ?? [],
			(start, endCandidate) => {
				// A section ends as soon as a heading on the same level as the start heading, or lower, appears.
				return start.level >= endCandidate.level;
			},
			inBetweenCallback === undefined ? undefined : (parentStart, childStart, childNumber, currentIndex, allHeadings) => {

				// Find the next heading at the same level or lower.
				let childEnd: HeadingCache | null = null;
				for (let nextIndex = currentIndex + 1; nextIndex < allHeadings.length; nextIndex++) {
					childEnd = allHeadings[nextIndex];
					if (childStart.level >= childEnd.level)
						break;
				}

				inBetweenCallback(parentStart, childStart, childEnd, childNumber, currentIndex, allHeadings);
			});
	}

	/**
	* Finds the range that is associated and defined by {@link section} as its boundries.
	*
	* @param section
	* @param possibleEndDelimiters
	* @param endPredicate Each call passes a delimiter in {@link possibleEndDelimiters}. Return `true` to assert that the given delimiter marks the end of the range to be returned.
	* @param inBetweenCallback Called for each delimiter in {@link possibleEndDelimiters} where {@link endPredicate} returned `false`.
	* @returns
	*/
	private static rangeForSection<T extends CacheItem>(
		section: SectionCache,
		possibleEndDelimiters: T[],
		endPredicate: (start: T, endCandidate: T) => boolean,
		inBetweenCallback?: (start: T, section: T, sectionNumber: number, index: number, array: T[]) => void): SectionRange {

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

			for (let nextHeadingIndex = delimiterCounter + 1; nextHeadingIndex < numberOfDelimiters; nextHeadingIndex++) {
				const maybeEndDelimiter = possibleEndDelimiters[nextHeadingIndex];
				if (endPredicate(startDelimiter, maybeEndDelimiter)) {
					range.end = maybeEndDelimiter;
					break;
				}
				else {
					inBetweenCallback?.(
						startDelimiter,
						maybeEndDelimiter,
						nextHeadingIndex - (delimiterCounter + 1),
						nextHeadingIndex,
						orderedDelimiters);
				}
			}

			break;
		}

		return range;
	}

	/**
	 * Reads all headings and their contents from {@link fileContent},
	 * referenced by {@link contentInfos}, into {@link result}.
	 * @param fileContent
	 * @param contentInfos
	 * @param result
	 * @param options
	 */
	private static getContentFromInfos(
		fileContent: string,
		contentInfos: IdentifiedContentInfo[],
		result: ParseResult,
		predicate?: PopulationPredicate,
		options?: ParseOptions) {

		const getContent = (sideInfo: IdentifiedContentInfo, cardSideInfos: IdentifiedContentInfo[]) => {
			return this.getContentFromInfo(fileContent, sideInfo, cardSideInfos, options);
		};

		const filteredContentInfos = predicate?.iterationFilter ? contentInfos.filter(i => {
			return predicate.iterationFilter!(i);
		}) : contentInfos;

		for (const idContentInfo of filteredContentInfos) {
			const cardID = idContentInfo.id.cardIDOrThrow();

			if (!Object.hasOwn(result, cardID))
				result[cardID] = {};

			const card = result[cardID];
			if (idContentInfo.id.isFrontSide) {
				card.frontMarkdown = getContent(idContentInfo, contentInfos);
				card.frontID = idContentInfo.id;
			}
			else {
				card.backMarkdown = getContent(idContentInfo, contentInfos);
				card.backID = idContentInfo.id;
			}

			if (predicate?.isDone && predicate.isDone(idContentInfo, card))
				break;
		}
	}

	/**
	 * Gets the whole content of a heading section.
	 *
	 * @param fileContent The file's content.
	 * @param info The side to read from {@link fileContent}.
	 * @param allInfos All sides in {@link fileContent}, so that they can be excluded.
	 * @param options
	 * @returns
	 */
	private static getContentFromInfo(
		fileContent: string,
		info: IdentifiedContentInfo,
		allInfos: IdentifiedContentInfo[],
		options?: ParseOptions): string {

		const {
			hideCardSectionMarker: removeHeading = false,
			hideDeclarationBlock = true,
		} = options?.contentRead || {};

		const contentInfo = info.contentInfo;
		const startDelimiterStartOffset = contentInfo.range.start?.position.start.offset ?? 0;
		const startDelimiterEndOffset = contentInfo.range.start?.position.end.offset ?? 0;
		const endDelimiterStartOffset = contentInfo.range.end?.position.start.offset;
		const endOffset = endDelimiterStartOffset ?? fileContent.length;

		const rangesToExclude: ContentRange[] = [];

		// Range of substring before the content to be returned.
		if (hideDeclarationBlock && contentInfo.section.type === SECTION_TYPE_HEADING) {

			// Remove everything before the heading
			rangesToExclude.push({
				start: 0,
				end: startDelimiterStartOffset
			});

			// Remove the part of the heading consisting of the ID
			const heading = fileContent.slice(startDelimiterStartOffset, startDelimiterEndOffset);
			const match = FULL_ID_REGEX.exec(heading);
			if (match) {
				const matchStartIndex = startDelimiterStartOffset + match.index;
				const matchEndIndex = matchStartIndex + match[0].length;
				rangesToExclude.push({
					start: matchStartIndex,
					end: matchEndIndex
				});
			}

			// If nothing was entered but the id, show the card ID.
		}
		else {
			rangesToExclude.push({
				start: 0,
				end: removeHeading ? startDelimiterEndOffset : startDelimiterStartOffset
			});
		}

		// Find ranges that are within the content to be returned that should be excluded.
		for (const info of allInfos) {
			const section = info.contentInfo.section;

			if (section.type === SECTION_TYPE_CODE) {

				if (section.position.start.offset > startDelimiterEndOffset && section.position.start.offset < endOffset) {

					const rangeToExclude = {
						start: section.position.start.offset,
						end: section.position.end.offset
					};

					if (hideDeclarationBlock || contentInfo.section.position.start.offset != rangeToExclude.start)
						rangesToExclude.push(rangeToExclude);
				}
			}
		}

		// Range of substring after the content to be returned.
		rangesToExclude.push({
			start: endOffset,
			end: fileContent.length
		});

		return this.subStringExcludingRanges(fileContent, rangesToExclude);
	}

	/**
	 * @param fileContent
	 * @param excludeRanges
	 * @returns A subset of {@link fileContent} excluding what is referenced by {@link excludeRanges}.
	 */
	private static subStringExcludingRanges(fileContent: string, excludeRanges: ContentRange[]) {
		if (excludeRanges.length == 0)
			return "";

		const sorted = excludeRanges.sort((a, b) => {
			return a.start - b.start;
		});

		const rangesToJoin: string[] = [];
		let startIndex = 0;

		for (const range of sorted) {
			rangesToJoin.push(fileContent.slice(startIndex, range.start));
			startIndex = range.start + (range.end - range.start);
		}
		rangesToJoin.push(fileContent.slice(startIndex));

		return rangesToJoin.join(""); // If [separator is] omitted, the array elements are separated with a comma.
	}

	//#endregion

	//#region Helpers


	private static async cachedRead(app: App, file: TFile) {
		return await app.vault.cachedRead(file);
	}

	private static fileCacheOrThrow(app: App, file: TFile) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache)
			throw new FileParserError(`No cached metadata available for ${file.path}.`);
		return cache;
	}

	private static getFileFromID(id: FullID, app: App) {
		return app.vault.getFileByPath(id.noteID);
	}

	/**
	 * In most cases the front and back sides of a card will be declared in the same file.
	 * Either way, at least one side will be declared in the file sorted first by this method.
	 * @param id The id whose declaration is expected to be found in the first file returned by this method.
	 * @param app
	 * @param hints
	 * @returns Returns all files with the most likely file sorted first.
	 */
	private static getAllFilesSortedByLikelihood(id: FullID, app: App, hints: NoteID[] = []) {
		// Note: finding the index and then inserting at index 0 is not necessarily more efficient.
		return app.vault.getFiles().sort((fileA, fileB) => {
			if (fileA.path == id.noteID)
				return -1;
			if (fileB.path == id.noteID)
				return 1;

			if (hints.includes(fileA.path))
				return -1;
			if (hints.includes(fileB.path))
				return 1;

			return 0;
		});
	}

	/**
	 * Once you have the {@link HeadingCache} there's no use for the corresponding {@link SectionCache}.
	 * This is just for completeness.
	 */
	private static findSectionCacheForHeading(headingCache: HeadingCache, cache: CachedMetadata): SectionCache | null {
		return cache.sections?.find(
			(section) =>
				section.type === SECTION_TYPE_HEADING &&
				section.position.start.line === headingCache.position.start.line &&
				section.position.start.col === headingCache.position.start.col &&
				section.position.end.line === headingCache.position.end.line &&
				section.position.end.col === headingCache.position.end.col
		) ?? null;
	}

	private static createSectionCacheFromHeading(headingCache: HeadingCache) {
		return {
			type: SECTION_TYPE_HEADING,
			position: headingCache.position,
		} satisfies SectionCache;
	}

	private static isCodeSection(section: SectionCache) {
		return section.type === SECTION_TYPE_CODE;
	}

	//#endregion
}
