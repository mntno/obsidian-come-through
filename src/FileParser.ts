import { DeclarationBlock, IncompleteDeclarationSpecification } from "DeclarationBlock";
import { FullID } from "FullID";
import { App, CachedMetadata, HeadingCache, SectionCache, TFile } from "obsidian";
import { CardID, NoteID } from "Statistics";

//#region Exported

export interface ParserSettings {
  hideCardSectionMarker?: boolean;
  hideDeclarationBlock?: boolean;
}

export interface PostParseInfo {  
  incompleteDeclarationInfos: IncompleteDeclarationInfo[],
}

export interface IncompleteDeclarationInfo {
  noteID: NoteID,
  frontSide?: boolean, 
  declaration: IncompleteDeclarationSpecification,
  section: SectionCache,
}

/** Represents one whole card. {@link CardID} of both {@link FullID}s is the cards id and expected to be equal. */
export type ParsedCard = {
  frontID: FullID;
  frontMarkdown: string;
  backID: FullID;
  backMarkdown: string;
}

export type IncompleteParsedCard = {
  frontID?: FullID;
  frontMarkdown?: string;
  backID?: FullID;
  backMarkdown?: string;
}

export class FileParserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FileParserError";
  }
}

export class FileParseNotFound extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FileParseNotFound";
  }
}

//#endregion

//#region Internal

const FRONT_BACK_AT_REGEX = /(front|f|back|b)@([^\s]+)/i;

/**
 * Carries info for a particular {@link FullID} needed to find and read its associated contents.
 */
interface CardSideInfo {
  id: FullID;
  span: HeadingSpan;
}

type IDFilter = (id: FullID) => {
  filter: boolean;
  stop: (id: FullID) => boolean;
}

type HeadingSpan = {
  start: HeadingCache;
  end: HeadingCache | null;
  declarationBlock: SectionCache | null; 
}

//#endregion

/**
 * Parses a file. Based on a "parse type", knows where cards and their IDs are expected to be found.
 */
export class FileParser {

  //#region Get ID

  public static async getAllIDsInFile(file: TFile, app: App, filter?: (id: FullID) => boolean) {
    return this.getAllIDsFromMetadata(
      file,
      await this.cachedRead(app, file),
      this.fileCacheOrThrow(app, file),
      filter);
  }

  /**
   * 
   * @param file File to parse for IDs.
   * @param fileContents 
   * @param cache The cache for the {@link file}
   * @param filter 
   * @returns 
   */
  public static getAllIDsFromMetadata(file: TFile, fileContents: string, cache: CachedMetadata, filter?: (id: FullID) => boolean) {
    const ids: FullID[] = [];
    const noteID = this.noteIDFromFile(file);
    const output: PostParseInfo = {
      incompleteDeclarationInfos: [],
    };
    
    for (const currentHeading of cache.headings ?? []) {
      const id = this.findIDInText(currentHeading.heading, noteID);
      if (id && (filter === undefined || (filter && filter(id))))
        ids.push(id);
    }

    // Go through all "root level Markdown blocks".
    for (const section of cache.sections ?? []) {
      const id = this.getIDFromCodeBlock(section, noteID, fileContents, output);
      if (id && (filter === undefined || (filter && filter(id))))
        ids.push(id);
    }

    return { 
      ids,
      output,
    };
  }

  //#endregion

  //#region Get Card

  /**
   * Returns all cards in the vault.
   * @param app 
   * @param options 
   * @returns 
   */
  public static async getAllCards(app: App, options?: ParserSettings) {

    const output: Record<CardID, IncompleteParsedCard> = {};

    for (const file of app.vault.getFiles())
      await this.populate(file, app, output, undefined, options);

    return this.separateCompleted(output);
  }

  public static async getCard(id: FullID, app: App, options?: ParserSettings) {

    const file = this.getFileFromID(id, app);
    if (!file)
      throw new FileParserError(`Could not find "${id.noteID}"`);

    let foundFront = false;
    let foundBack = false;

    const cardID = id.cardIDOrThrow();
    const output: Record<CardID, IncompleteParsedCard> = {};

    await this.populate(
      file,
      app,
      output,
      (parsedID) => ({
        filter: parsedID.isEqual(id, true), // Let both sides through
        stop: (idd) => {
          if (idd.isFrontSide)
            foundFront = true;
          if (!idd.isFrontSide)
            foundBack = true;
          return foundFront && foundBack;
        }
      }),
      options);

    // The front side was not found 
    if (Object.keys(output).length == 0)
      throw new FileParserError(`Expected to find id ${cardID} in "${id.noteID}"`);

    const separated = this.separateCompleted(output);

    const resultCard = separated[cardID];
    console.assert(resultCard);
    if (!resultCard)
      throw new FileParserError(`Expected to find id ${cardID} in "${id.noteID}"`);

    // Both sides were found in the same file.
    if (resultCard.complete)
      return resultCard;

    // TODO: Only look or missing side.
    const getAllCardsResult = await this.getAllCards(app, options);

    const resultCard2 = getAllCardsResult[cardID];
    console.assert(resultCard2);
    if (!resultCard2)
      throw new FileParserError(`Expected to find id ${cardID} in "${id.noteID}"`);

    return resultCard2;
  }

  private static async populate(
    file: TFile,
    app: App,
    output: Record<CardID, IncompleteParsedCard>,
    filter?: IDFilter,
    options?: ParserSettings) {

    const fileContent = await this.cachedRead(app, file);
    const cache = this.fileCacheOrThrow(app, file);
    const cardSpans = this.findCardSideInfosInFile(this.noteIDFromFile(file), fileContent, cache, filter, options);
    await this.readHeadingSections(fileContent, cardSpans, output, options);
  }

  /**
   * Separates those cards that are completed (i.e. both sides were found), with those uncompleted (only one side found).
   * @param nullableRecord 
   * @returns 
   */
  private static separateCompleted(maybeIncompleteCards: Record<CardID, IncompleteParsedCard>) {
    
    const complete: Record<CardID, { 
      complete: ParsedCard | null, 
      incomplete: IncompleteParsedCard | null 
    }> = {};
    
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

  private static isComplete(card: IncompleteParsedCard): card is ParsedCard {
    return card.frontID && typeof card.frontMarkdown === 'string' && card.backID && typeof card.backMarkdown === 'string' ? true : false;
  }

  //#endregion

  /**
   * Searches the {@link text} for a {@link FullID | ID}.
   * 
   * @param text 
   * @param noteID 
   * @returns 
   */
  private static findIDInText(text: string, noteID: NoteID) {

    const match = FRONT_BACK_AT_REGEX.exec(text);

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

  private static getIDFromCodeBlock(section: SectionCache, noteID: NoteID, fileContent: string, output?: PostParseInfo) {
    const sectionType = "code";
    if (section.type !== sectionType)
      return null;

    const codeBlock = fileContent.slice(section.position.start.offset, section.position.end.offset);
    const declaration = DeclarationBlock.parseCodeBlock(codeBlock, (incomplete) => {
      output?.incompleteDeclarationInfos.push({
        noteID: noteID,        
        declaration: incomplete,
        section: section,
      });
    });

    if (declaration) {
      if (!FullID.isSideValid(declaration.side))
        throw new FileParserError(`Invalid value for "side": ${declaration.side}`);
      
      return new FullID(noteID, declaration.id, declaration.side);
    }

    return null;
  }

  //#region Read Headings

  /**
   * Finds all {@link CardSideInfo}s in {@link file}.
   * @param file 
   * @param app 
   * @param options 
   * @returns 
   */
  private static findCardSideInfosInFile(
    noteID: NoteID,
    fileContent: string,
    cache: CachedMetadata,
    predicate?: IDFilter,
    options?: ParserSettings) {

    const headings = cache.headings;
    if (!headings || headings.length == 0)
      return [];

    const cardInfos: CardSideInfo[] = [];
    const numberOfHeadings = headings.length;

    for (let headingIndex = 0; headingIndex < numberOfHeadings; headingIndex++) {

      const currentHeading = headings[headingIndex];
      const id = this.findIDInText(currentHeading.heading, noteID);
      if (!id)
        continue;

      const filter = predicate?.(id);

      if (filter === undefined || filter.filter) {

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
          span: {
            start: currentHeading,
            end: nextFrontHeadingStartPos,
            declarationBlock: null,
          }
        })

        if (filter && filter.stop(id))
          return cardInfos;
      }
    }

    // Go through all "root level Markdown blocks".
    for (const section of cache.sections ?? []) {
      const id = this.getIDFromCodeBlock(section, noteID, fileContent);
      if (!id)
        continue;

      const filter = predicate?.(id);

      if (filter === undefined || filter.filter) {
        const span = this.headingSpanOfSection(section, cache);
        if (!span)
          continue;

        cardInfos.push({
          id: id,
          span: {
            start: span.start,
            end: span.end,
            declarationBlock: section,
          }
        });

        if (filter && filter.stop(id))
          return cardInfos;
      }
    }

    return cardInfos;
  }

  private static headingSpanOfSection(section: SectionCache, cache: CachedMetadata): HeadingSpan | null {
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

      const span: HeadingSpan = {
        start: orderedHeadings[headingCounter],
        end: null,
        declarationBlock: section,
      }

      let nextHeadingIndex = headingCounter + 1;
      if (nextHeadingIndex < numberOfHeadings)
        span.end = headings[nextHeadingIndex];

      return span;
    }

    return null;
  }

  /**
   * Reads all headings and their contents from {@link file}, defined by {@link headingSpans}, into {@link cardInfoRecord} .
   * @param fileContent 
   * @param headingSpans 
   * @param cardInfoRecord 
   * @param options 
   */
  private static async readHeadingSections(
    fileContent: string,
    headingSpans: CardSideInfo[],
    cardInfoRecord: Record<CardID, IncompleteParsedCard>,
    options?: ParserSettings) {

    const readHeadingSection = (data: CardSideInfo) =>
      this.readHeadingSection(data.span, fileContent, options);

    for (const headingSpan of headingSpans) {
      const cardID = headingSpan.id.cardID!;

      if (!Object.prototype.hasOwnProperty.call(cardInfoRecord, cardID))
        cardInfoRecord[cardID] = {};

      const cardInfo = cardInfoRecord[cardID];
      if (headingSpan.id.isFrontSide) {
        cardInfo.frontMarkdown = readHeadingSection(headingSpan);
        cardInfo.frontID = headingSpan.id;
      }
      else {
        cardInfo.backMarkdown = readHeadingSection(headingSpan);
        cardInfo.backID = headingSpan.id;
      }
    }
  }

  /**
   * Reads the whole content of a heading section.
   * 
   * @param heading Heading cache on the file.
   * @param nextHeading `null` if {@link heading} was the last heading in the file. 
   * @param markdown The file's content.
   * @param removeHeading `true` to skip reading the heading.
   * @returns 
   */
  private static readHeadingSection(span: HeadingSpan, markdown: string, options?: ParserSettings): string {
        
    const {
      hideCardSectionMarker: removeHeading = false,
      hideDeclarationBlock = true,
    } = options || {};

    const frontHeadingStartPos = span.start.position.start.offset;
    const frontHeadingEndPos = span.start.position.end.offset;
    const nextHeadingStartPos = span.end?.position.start.offset;

    let content = (nextHeadingStartPos ? markdown.slice(frontHeadingEndPos, nextHeadingStartPos) : markdown.slice(frontHeadingEndPos));

    if (hideDeclarationBlock && span.declarationBlock) {
      const blockStartOffset = span.declarationBlock.position.start.offset - frontHeadingEndPos;
      const blockLength = span.declarationBlock.position.end.offset - span.declarationBlock.position.start.offset;
      const beforeBlock = content.slice(0, blockStartOffset);
      content = beforeBlock + content.slice(blockStartOffset + blockLength);
    }

    if (removeHeading) {
      return content.trimStart();
    } else {
      const heading = markdown.slice(frontHeadingStartPos, frontHeadingEndPos);
      const headingWithoutID = heading.replace(FRONT_BACK_AT_REGEX, "");

      // If nothing was entered but the id, show the card ID.
      if (headingWithoutID.replaceAll("#", "").trim().length == 0) {
        try {
          return FullID.cardIDFromString(heading) + content;
        }
        catch {
          return heading + content;;
        }
      }
      else
        return headingWithoutID + content;
    }
  }

  //#endregion

  //#region Helpers

  private static noteIDFromFile(file: TFile): NoteID {
    return file.path;
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

  //#endregion
}