import { StringManipulator } from "#/content/str";
import { ContentRange } from "#/content/types";
import { CardID, FullID, NoteID } from "#/data/FullID";
import { ContentSectionProvider } from "#/declarations/CommandDeclarationParser";
import { DeclarationConstants } from "#/declarations/constants";
import { DeclarationParser } from "#/declarations/DeclarationParser";
import { IDScope } from "#/declarations/ExplicitDeclaration";
import { Env } from "#/env";
import { asNoteID, fullIDFromDeclaration } from "#/TypeAssistant";
import { UnexpectedUndefinedError } from "#/utils/errors";
import { Api } from "#/utils/obs/api";
import { FullSectionRange, SectionRange, SectionType } from "#/utils/obs/FileParser";
import { Arr, Str } from "#/utils/ts";
import { App, CachedMetadata, HeadingCache, SectionCache, TFile } from "obsidian";

/**
	* The result of attempting to retrieve the content of a particular {@link FullID}.
	* Returned by {@link ContentParser.getAllCards}, {@link ContentParser.getCardFromFile} and {@link ContentParser.getCard}.
	*/
export type ParsedCardResult = {
	complete: ParsedCard | null;
	incomplete: MaybeParsedCard | null;
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
 * Represents a card whose content potentially was only partly found (e.g., only the front side).
 *
 * It can only be turned into a complete {@link ParsedCard|card} that can be reviewed if all values
 * are non-null (also see {@link ContentParser.isComplete}).
 */
export type MaybeParsedCard = {
	frontID?: FullID;
	frontMarkdown?: string;
	backID?: FullID;
	backMarkdown?: string;
}

export interface ParseOptions {
	contentRead?: ContentReadOptions;
}

export interface GetCardParseOptions extends ParseOptions {
	likelyNoteIDs: NoteID[] | null;
}

/**
 * Options regarding how the content of cards are populated.
 */
export interface ContentReadOptions {
	hideCardSectionMarker?: boolean;
	hideDeclarationBlock?: boolean;
}

/**
 * Info needed to read the all content associated with a particular ID:
 * the {@link FullID|ID}, its {@link IDScope|scope}, and {@link ContentInfo|info}
 * on where the content is supposed to be found.
 */
interface IdentifiedContentInfo {
	id: FullID;
	scope: IDScope;
	contentInfo: ContentInfo;
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

	containerRange: SectionRange;

	provider?: ContentSectionProvider;
}

interface PopulationPredicate {
	/**
	 * Which {@link IdentifiedContentInfo|info} to include when iterating content.
	 *
	 * This usually not known for both sides so be careful not to exclude files
	 * that might contain the content being searched for.
	 *
	 * Can be used to avoid unnecessary processing.
	 */
	iterationFilter?: IdentifiedContentInfoFilter;

	/** Whether to stop iterating. Use to avoid unnecessary processing. */
	isDone?: ParsedCardBreaker;
}

type IdentifiedContentInfoFilter = (id: IdentifiedContentInfo) => boolean;
type ParsedCardBreaker = (info: IdentifiedContentInfo, card: MaybeParsedCard) => boolean;

/** Used internally while  content  */
type ParseResult = Record<CardID, MaybeParsedCard>;

export class ContentParser extends DeclarationParser {

	public static async getAllCards(app: App, options?: ParseOptions) {

		const parseResult: ParseResult = {};

		for (const file of app.vault.getFiles())
			await this.getContentFromFile(file, app, parseResult, undefined, options);

		return this.processParseResult(parseResult);
	}

	public static async getCardFromFile(file: TFile, app: App, options?: ParseOptions) {
		const parseResult: ParseResult = {};
		await this.getContentFromFile(file, app, parseResult, undefined, options);
		return this.processParseResult(parseResult);
	}

	public static async getCard(id: FullID, app: App, options?: GetCardParseOptions) {

		const predicate: PopulationPredicate = {
			iterationFilter: (idContentInfo) => {

				switch (idContentInfo.scope) {
					case IDScope.Unique:
						// For unique ids. If also filtering on noteID, then only this file will be looked at,
						// while the other side is in another file and thus won't be found.
						return idContentInfo.id.isCardEqual(id);

					case IDScope.Note:
						// Should work for file-scoped IDs.
						return idContentInfo.id.isEqual(id, true);
				}
			},
			isDone: (idContentInfo, maybeParsedCard) => {
				if (!this.isComplete(maybeParsedCard))
					return false;

				switch (idContentInfo.scope) {
					case IDScope.Unique:
						return maybeParsedCard.frontID.isCardEqual(id);

					case IDScope.Note:
						return maybeParsedCard.frontID.isEqual(id, true);
				}
			}
		};

		const cardID = id.cardIDOrThrow();
		const parseResult: ParseResult = {};

		// Start with the most likely file that will contain both sides of the card.
		for (const file of this.getAllFilesSortedByLikelihood(id, app, Arr.nonEmpty(options?.likelyNoteIDs))) {

			await this.getContentFromFile(file, app, parseResult, predicate, options);

			// As soon as both sides are found, stop iterating through the rest of the files.
			const maybeCard = parseResult[cardID];
			if (maybeCard !== undefined && this.isComplete(maybeCard))
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

		for (const [cardId, maybe] of Object.entries(maybeIncompleteCards)) {
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
		return card.frontID !== undefined && Str.is(card.frontMarkdown) && card.backID !== undefined && Str.is(card.backMarkdown);
	}

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

		// Look for declarations in headings
		const headings = Arr.orEmpty(cache.headings);
		const numberOfHeadings = headings.length;
		for (let headingIndex = 0; headingIndex < numberOfHeadings; headingIndex++) {

			const currentHeading = Arr.expAt(headings, headingIndex);
			const id = this.findFullIDInText(currentHeading.heading, noteID);
			if (!id)
				continue;

			// Find the end position by looking at the next heading at the same level or lesser.
			let nextFrontHeadingStartPos: HeadingCache | null = null;
			let nextHeadingIndex = headingIndex + 1;

			while (nextHeadingIndex < numberOfHeadings && nextFrontHeadingStartPos === null) {
				const nextHeading = headings[nextHeadingIndex];
				if (nextHeading !== undefined && nextHeading.level <= currentHeading.level)
					nextFrontHeadingStartPos = nextHeading;
				nextHeadingIndex += 1;
			}

			cardInfos.push({
				id: id,
				scope: IDScope.Note,
				contentInfo: {
					section: This.create.sectionCache(SectionType.Heading, currentHeading.position),
					containerRange: This.create.sectionRange(currentHeading, nextFrontHeadingStartPos),
				}
			});
		}

		// Look for a declaration in the frontmatter
		if (cache.frontmatter) {
			for (const key of DeclarationConstants.Frontmatter.KEYS) {
				const maybeDeclaration = Api.Frontmatter.recordFrom(cache.frontmatter, key);
				const declaration = maybeDeclaration !== undefined ? This.declarationFromFrontmatter(maybeDeclaration) : null;
				if (declaration !== null) {
					cardInfos.push({
						id: fullIDFromDeclaration(declaration, noteID),
						scope: declaration.idScope,
						contentInfo: {
							section: This.create.frontmatterSectionWithKey(key),
							containerRange: FullSectionRange,
						}
					});
				}
			}
		}

		// Go through the rest of the section cache.
		for (const section of Arr.orEmpty(cache.sections)) {

			const declaration = This.getDeclarationFromSection(section, noteID, fileContent);
			if (declaration === null)
				continue;

			cardInfos.push({
				id: fullIDFromDeclaration(declaration, noteID),
				scope: declaration.idScope,
				contentInfo: {
					section: section,
					containerRange: This.headingRangeForSection(section, cache),
				}
			});
		}

		for (const section of Arr.orEmpty(cache.sections)) {
			This.getAutoDeclarationsFromSection(section, cache, noteID, fileContent, undefined, { useProvider: true })
				.forEach(processed => {
					cardInfos.push({
						id: fullIDFromDeclaration(processed.declaration, noteID),
						scope: processed.declaration.idScope,
						contentInfo: {
							section: section, // When declaration.autoGenerated is `true`, this points to the section that contains the command, as the actual card declarations don't exist.
							containerRange: processed.containerRange,
							provider: processed.provider,
						}
					});
				});
		}

		return cardInfos;
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
			if (card === undefined)
				throw new UnexpectedUndefinedError();

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

		const {
			section: idSection,
			containerRange,
			provider,
		} = info.contentInfo;

		const startDelimiterStartOffset = containerRange.start?.position.start.offset ?? 0;
		const startDelimiterEndOffset = containerRange.start?.position.end.offset ?? 0;
		const endDelimiterStartOffset = containerRange.end?.position.start.offset;
		const endOffset = endDelimiterStartOffset ?? fileContent.length;

		const rangesToExclude: ContentRange[] = [];

		// Range of substring before the content to be returned.
		if (hideDeclarationBlock && idSection.type === SectionType.Heading) {

			// Remove everything before the heading
			rangesToExclude.push({
				start: 0,
				end: startDelimiterStartOffset
			});

			// Remove the part of the heading consisting of the ID
			const heading = fileContent.slice(startDelimiterStartOffset, startDelimiterEndOffset);
			const match = this.FULL_ID_REGEX.exec(heading);
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
			const infoSection = info.contentInfo.section;

			if (infoSection.type === SectionType.Code) {

				if (infoSection.position.start.offset > startDelimiterEndOffset && infoSection.position.start.offset < endOffset) {

					const rangeToExclude = This.create.offsetRangeFromSection(infoSection);

					if (hideDeclarationBlock || idSection.position.start.offset !== rangeToExclude.start)
						rangesToExclude.push(rangeToExclude);
				}
			}
		}

		// Range of substring after the content to be returned.
		rangesToExclude.push({
			start: endOffset,
			end: fileContent.length
		});

		Env.log.p("getContentFromInfo: provider", provider)
		if (provider !== undefined) {
			rangesToExclude.push(...provider.rangesToExclude(This.create.offsetRange(startDelimiterEndOffset, endOffset)));
			return StringManipulator.subStringByRanges(fileContent, rangesToExclude, { range: provider.rangeToInclude(), text: provider.text() });
		} else {
			return StringManipulator.subStringByRanges(fileContent, rangesToExclude)
		}
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
		return app.vault.getMarkdownFiles().sort((fileA, fileB) => {
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
}

const This = ContentParser;
