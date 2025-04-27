import { parseYaml, stringifyYaml } from "obsidian";
import { UniqueID } from "UniqueID";

export type DeclarationSide = "front" | "back";

export interface DeclarationSpecification extends Omit<IncompleteDeclarationSpecification, 'side' | 'id'> {
  side: DeclarationSide;
  id: string;
}

/**
 * The minimum required propertes that need to be specified before 
 * default values and/or generated values can be applied
 * to turn it into a {@link DeclarationSpecification}.
 */
export interface IncompleteDeclarationSpecification {
  /** Side needs to be specfied. Only if "front" can an ID be auto generated. */
  side: string;
  id?: string;
  deckID?: string;
}

export interface DeclarationLocation {
  start: number,
  end: number,
}

const DeclarationUserKeyName = {
  DECK: "deck"
};

const DeclarationInterfacePropertyName = {
  CARD_ID: "id",
  SIDE: "side",
  DECK_ID: "deckID",
};

export class DeclarationBlock implements DeclarationSpecification {

  public static readonly LANGUAGE = "comethrough";
  public static readonly LANGUAGE_SHORT = "ct";

  public readonly id: string;
  public readonly side: DeclarationSide;

  private constructor(id: string, side: DeclarationSide) {
    this.id = id;
    this.side = side.trim().toLowerCase() as DeclarationSide;
  }

  //#region 

  /**
   * @param source The code block including the three ticks at the beginning and end.
   * @param incompleteCallback Invoked if content of {@link source} is recognized but is missing required properties.
   * @returns `null` if this block is unknown.
  */
  public static parseCodeBlock(source: string, incompleteCallback?: (incomplete: IncompleteDeclarationSpecification, position: DeclarationLocation) => void) {

    const location = this.contentOfCodeBlock(source);
    if (!location)
      return null;

    const yamlString = source.slice(location.start, location.end);

    const declaration = this.tryParseAsYaml(yamlString);
    if (!declaration)
      return null;

    if (this.conformsToDeclarationSpecification(declaration))
      return new this(declaration.id, declaration.side);

    if (this.conformsToIncompleteDeclarationSpecification(declaration) && incompleteCallback)
      incompleteCallback(declaration, location);

    return null;
  }

  /**   
   * @param source The code block including the three ticks at the beginning and end.
   * @returns The string inside the code block or `null` if {@link source} or code "language" is unexpected.
  */
  private static contentOfCodeBlock(source: string): DeclarationLocation | null {
    const firstLine = source.split("\n", 1).first();
    if (!firstLine)
      return null;

    const language = firstLine.slice(this.CODE_BLOCK_MARKER_LENGTH).trim();
    if (language !== this.LANGUAGE && language !== this.LANGUAGE_SHORT)
      return null;

    const secondLineOffset = firstLine.length + 1; // Add \n back    
    return { start: secondLineOffset, end: source.length - this.CODE_BLOCK_MARKER_LENGTH }
  }
  private static readonly CODE_BLOCK_MARKER_LENGTH = 3;

  //#endregion

  //#region 

  public static canComplete(decl: IncompleteDeclarationSpecification) {
    if (!this.conformsToIncompleteDeclarationSpecification(decl))
      return false;

    if (Object.hasOwn(decl, this.PROPERTY.ID) && this.isIDValid(decl.id))
      return false;

    if (!this.isFrontSide(decl))
      return false;

    return true;
  }

  /**
   * Completes a {@link IncompleteDeclarationSpecification} by assigning default and generated values
   * to non-required properties.
   * 
   * @param decl 
   * @returns `null` if {@link canComplete} returns `false`.
   */
  public static tryToComplete(decl: IncompleteDeclarationSpecification, preventIDs?: Set<string>) {
    if (!this.canComplete(decl))
      return null;

    const complete = {
      ...decl,
      ...{
        id: UniqueID.generateID(preventIDs)
      }
    } as DeclarationSpecification;

    return complete;
  }

  /**
   * May use if already checked with {@link canComplete}.
   * @param decl 
   * @returns Result of calling {@link tryToComplete}.
   */
  public static completeOrThrow(decl: IncompleteDeclarationSpecification, preventIDs?: Set<string>) {
    const maybeCompleted = this.tryToComplete(decl, preventIDs);
    if (maybeCompleted === null)
      throw new Error("Could not complete given declaration block.");
    return maybeCompleted;
  }

  //#endregion

  public static copyWithDeck(declaration: IncompleteDeclarationSpecification, deckID: string | undefined): IncompleteDeclarationSpecification {
    return {
      ...declaration,
      ...{
        deckID: deckID,
      }
    }
  }

  //#region  Yaml

  /**
   * 
   * @param source Will be converted to lower case before parsing.
   * @param onParseError Called when YAML was incorrect.
   * @returns `null` if a parsing {@link source} failed.
   */
  public static tryParseAsYaml(source: string, onParseError?: (error: Error) => void) {
    let parsedObject: Record<string, any> | null = null;

    try {
      parsedObject = parseYaml(source.toLowerCase());
      if (parsedObject)
        this.fromUserFriendlyKeys(parsedObject);
    }
    catch (error) {
      if (error instanceof Error && error.name === "YAMLParseError")
        onParseError?.(error);
      else
        throw error;
    }

    return parsedObject;
  }

  public static toString(declaration: DeclarationSpecification | IncompleteDeclarationSpecification) {
    this.toUserFriendlyKeys(declaration);
    return stringifyYaml(declaration);
  }

  /**
   * Transform user friendly YAML keys to interface/class properties.
   * Opposite of {@link toUserFriendlyKeys}.
   * 
   * @param obj 
   */
  private static fromUserFriendlyKeys(obj: Record<string, any>) {
    if (Object.hasOwn(obj, DeclarationUserKeyName.DECK)) {
      const deckID = obj[DeclarationUserKeyName.DECK];
      delete obj[DeclarationUserKeyName.DECK];
      obj[DeclarationInterfacePropertyName.DECK_ID] = deckID;
    }
  }

  private static toUserFriendlyKeys(obj: Record<string, any>) {
    if (Object.hasOwn(obj, DeclarationInterfacePropertyName.DECK_ID)) {
      const deckID = obj[DeclarationInterfacePropertyName.DECK_ID];
      delete obj[DeclarationInterfacePropertyName.DECK_ID];
      obj[DeclarationUserKeyName.DECK] = deckID;
    }
  }

  //#endregion

  //#region 

  /**
   * @returns `true` if {@link obj} conforms to {@link DeclarationSpecification}.
   */
  public static conformsToDeclarationSpecification(obj: any): obj is DeclarationSpecification {
    return (
      typeof obj === 'object' && obj !== null &&
      this.validateSide(obj) &&
      this.validateDeck(obj) &&
      this.isIDValid(obj.id)
    );
  }

  /**
   * Check if {@link obj} conforms to {@link IncompleteDeclarationSpecification}.
   * @param obj 
   * @returns `false` if {@link obj} is `null`.
   */
  public static conformsToIncompleteDeclarationSpecification(obj: any): obj is IncompleteDeclarationSpecification {
    return (
      typeof obj === 'object' && obj !== null &&
      this.validateSide(obj) &&
      this.validateDeck(obj)
    );
  }

  private static isIDValid(value?: any) {
    return typeof value === 'string' && UniqueID.isValid(<string>value);
  }

  private static validateSide(obj: Record<string, any>) {
    if (Object.hasOwn(obj, DeclarationInterfacePropertyName.SIDE)) {
      const value = obj[DeclarationInterfacePropertyName.SIDE];
      if (typeof value === 'string')
        return [...this.frontSideValues, ...this.backSideValues].includes((<string>value).trim().toLowerCase());
    }
    return false;
  }

  private static validateDeck(obj: Record<string, any>) {
    if (Object.hasOwn(obj, DeclarationInterfacePropertyName.DECK_ID)) {
      const value = obj[DeclarationInterfacePropertyName.DECK_ID];
      if (value === undefined)
        return true;
      return typeof value === 'string' && UniqueID.isValid(<string>value);
    }
    else {
      return true;
    }
  }

  public static isFrontSide(d: DeclarationSpecification | IncompleteDeclarationSpecification, throwIfNotValid = false) {
    if (throwIfNotValid && !this.validateSide(d))
      throw new Error(`Side is not valid: ${d.side}`);
    return DeclarationBlock.frontSideValues.includes(d.side);
  }

  public get isFrontSide() {
    return DeclarationBlock.isFrontSide(this);
  }

  static readonly PROPERTY = {
    ID: "id"
  } as const;

  private static readonly frontSideValues = ["f", "front"];
  private static readonly backSideValues = ["b", "back"];

  //#endregion
}
