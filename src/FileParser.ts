import { DeclarationBlock, DeclarationLocation, IncompleteDeclarationSpecification } from "DeclarationBlock";
import { NoteID, CardID, FullID } from "FullID";
import { App, CachedMetadata, HeadingCache, SectionCache, TFile } from "obsidian";
import { asNoteID } from "TypeAssistant";

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
  multipleDefinedIDs: FullID[],
}

/**
 * All info needed to extract a {@link DeclarationBlock|declaration block} from a note.
 */
export interface DeclarationInfo {
  /** The declaration candidate. */
  declaration: IncompleteDeclarationSpecification,
  /** The note where the {@link declaration} was found. */
  noteID: NoteID,
  /** {@link SectionCache|Section} in {@link noteID} where {@link declaration} was found. */
  section: SectionCache,
  /** The location of the {@link declaration} within the {@link section}. */
  location: DeclarationLocation,
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
  contentInfo: ContentInfo
}

/**
 * Used if the {@link ContentInfo.section} is was a {@link DeclarationBlock}.
 */
interface DeclCardSideInfo extends IdentifiedContentInfo {
  declaration: DeclarationBlock;
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

  /** Start position in the file that {@link section} declares as its content. */
  start: HeadingCache;

  /** End delimiter in the file that {@link section} declares as its content.
   * 
   * Will be `null` if {@link start} was the last heading in the file (on the same level or lower),
   * in which case the rest of the content, to EOF, is included.
   * 
   * @todo Probably should be a {@link SectionCache} instead.
   */
  end: HeadingCache | null;
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
      multipleDefinedIDs: [],
    };

    // Used to detect if ids were declared more than once.
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

    for (const currentHeading of cache.headings ?? []) {
      const id = this.findFullIDInText(currentHeading.heading, noteID);
      if (id && !checkExistance(id)) {
        if (filter === undefined || (filter && filter(id)))
          ids.push(id);
      }
    }

    for (const section of cache.sections ?? []) {
      const declaration = this.getDeclarationFromSection(section, noteID, fileContent, parseInfo);
      if (declaration) {
        const id = this.fullIDFromDeclaration(declaration, noteID);
        if (!checkExistance(id) && (filter === undefined || (filter && filter(id))))
          ids.push(id);
      }
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
        const sectionType = idContentInfo.contentInfo.section.type;

        // For unique ids. If also filtering on noteID, then only this file will be looked at,
        // while the other side is in another file and thus won't be found.
        if (sectionType === SECTION_TYPE_CODE)
          return idContentInfo.id.isCardEqual(id);

        // Should work for file-scoped IDs.
        if (sectionType === SECTION_TYPE_HEADING)
          return idContentInfo.id.isEqual(id, true);

        throw new Error(`Not Supported: ${sectionType}`);
      },
      isDone: (idContentInfo, maybeParsedCard) => {
        if (!this.isComplete(maybeParsedCard))
          return false;

        const sectionType = idContentInfo.contentInfo.section.type;
        if (sectionType === SECTION_TYPE_CODE)
          return maybeParsedCard.frontID.isCardEqual(id);

        if (sectionType === SECTION_TYPE_HEADING)
          return maybeParsedCard.frontID.isEqual(id, true);

        throw new Error(`Not Supported: ${sectionType}`);
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
   * 
   * Only `code` section types are supported. `null` is returned for all other types.
   * 
   * @param section The {@link SectionCache|section} to search within {@link fileContent}.
   * @param noteID 
   * @param fileContent 
   * @param parseInfo 
   * @returns 
   */
  private static getDeclarationFromSection(section: SectionCache, noteID: NoteID, fileContent: string, parseInfo?: PostParseInfo) {
    if (section.type !== SECTION_TYPE_CODE)
      return null;

    const codeBlock = fileContent.slice(section.position.start.offset, section.position.end.offset);
    const declaration = DeclarationBlock.parseCodeBlock(codeBlock, (incomplete, location) => {
      parseInfo?.incompleteDeclarationInfos.push({
        noteID: noteID,
        declaration: incomplete,
        section: section,
        location: location,
      });
    });

    return declaration;
  }

  //#region Get Content

  private static async getContentFromFile(
    file: TFile,
    app: App,
    result: ParseResult,
    predicate?: PopulationPredicate,
    options?: ParseOptions) {

    const fileContent = await this.cachedRead(app, file);

    await this.getContentFromInfos(
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
        contentInfo: {
          start: currentHeading,
          end: nextFrontHeadingStartPos,
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

      const contentInfo = this.contentInfoFromSection(section, cache);
      if (!contentInfo)
        continue;

      cardInfos.push({
        id: this.fullIDFromDeclaration(declaration, noteID),
        contentInfo: contentInfo,
        declaration: declaration,
      } as DeclCardSideInfo);
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
   * @returns `null` if no content found.
   */
  private static contentInfoFromSection(section: SectionCache, cache: CachedMetadata): ContentInfo | null {
    const headings = cache.headings;
    if (!headings || headings.length == 0)
      return null;

    const numberOfHeadings = headings.length;
    const orderedHeadings = headings.sort((a, b) => a.position.start.offset - b.position.start.offset);

    // Start at bottom. The first heading that's not after the section is the heading the section belongs to.
    for (let headingCounter = numberOfHeadings - 1; headingCounter >= 0; headingCounter--) {

      // Heading is after section
      if (orderedHeadings[headingCounter].position.start.offset > section.position.end.offset)
        continue;

      const info: ContentInfo = {
        start: orderedHeadings[headingCounter],
        end: null,
        section: section,
      }

      let nextHeadingIndex = headingCounter + 1;
      if (nextHeadingIndex < numberOfHeadings)
        info.end = headings[nextHeadingIndex];

      return info;
    }

    return null;
  }

  /**
   * Reads all headings and their contents from {@link fileContent}, 
   * referenced by {@link contentInfos}, into {@link result}.
   * @param fileContent 
   * @param contentInfos 
   * @param result 
   * @param options 
   */
  private static async getContentFromInfos(
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
    const headingStartOffset = contentInfo.start.position.start.offset;
    const headingEndOffset = contentInfo.start.position.end.offset;
    const nextHeadingStartOffset = contentInfo.end?.position.start.offset;
    const endOffset = nextHeadingStartOffset ?? fileContent.length;

    const rangesToExclude: ContentRange[] = [];

    // Range of substring before the content to be returned.
    if (hideDeclarationBlock && contentInfo.section.type === SECTION_TYPE_HEADING) {
      
      // Remove everything before the heading
      rangesToExclude.push({
        start: 0,
        end: headingStartOffset
      });
      
      // Remove the part of the heading consisting of the ID
      const heading = fileContent.slice(headingStartOffset, headingEndOffset);
      const match = FULL_ID_REGEX.exec(heading);
      if (match) {
        const matchStartIndex = headingStartOffset + match.index;
        const matchEndIndex = matchStartIndex + match[0].length;
        rangesToExclude.push({
          start: matchStartIndex,
          end: matchEndIndex
        });
      }
      
      /*
      // If nothing was entered but the id, show the card ID.
      if (headingWithoutID.replaceAll("#", "").trim().length == 0) {
        try {
          return FullID.cardIDFromString(heading) + allContentInSection;
        }
        catch {
          return heading + allContentInSection;;
        }
      }
      */
    }
    else {
      rangesToExclude.push({
        start: 0,
        end: removeHeading ? headingEndOffset : headingStartOffset
      });
    }

    // Find ranges that are within the content to be returned that should be excluded.
    for (const info of allInfos) {
      const section = info.contentInfo.section;

      if (section.type === SECTION_TYPE_CODE) {

        if (section.position.start.offset > headingEndOffset && section.position.start.offset < endOffset) {

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

    return this.subStringExcludingSpans(fileContent, rangesToExclude);
  }

  /**   
   * @param fileContent 
   * @param excludeRanges 
   * @returns A subset of {@link fileContent} excluding what is refereced by {@link excludeRanges}.
   */
  private static subStringExcludingSpans(fileContent: string, excludeRanges: ContentRange[]) {
    if (excludeRanges.length == 0)
      return "";

    const sorted = excludeRanges.sort((a, b) => {
      return a.start - b.start;
    });

    const rangesToJoin: string[] = [];
    let startIndex = 0;

    for (const range of sorted) {
      ;
      rangesToJoin.push(fileContent.slice(startIndex, range.start));
      startIndex = range.start + (range.end - range.start);
    }
    rangesToJoin.push(fileContent.slice(startIndex));

    return rangesToJoin.join(""); // If [separator is] omitted, the array elements are separated with a comma.
  }

  //#endregion

  //#region Helpers

  private static fullIDFromDeclaration(declaration: DeclarationBlock, noteID: NoteID) {
    return FullID.create(noteID, declaration.id, DeclarationBlock.isFrontSide(declaration, true));
  }

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

  //#endregion
}