import { parseYaml, stringifyYaml, setIcon } from "obsidian";
import { PLUGIN_ICON } from "UIAssistant";

export interface DeclarationSpecification {
  side: string;
  id: string;
}

/**
 * The minimum that needs to be specified before default values and/or generated values can be applied
 * to turn it into a {@link DeclarationSpecification}.
 */
export interface IncompleteDeclarationSpecification {
  /** Side needs to be specfied. Only if "front" can id be auto generated. */
  side: string;
  id?: string;
}

export class DeclarationBlock implements DeclarationSpecification {

  public static readonly LANGUAGE = "comethrough";
  public static readonly LANGUAGE_SHORT = "ct";

  public readonly id: string;
  public readonly side: string

  private constructor(id: string, side: string) {
    this.id = id;
    this.side = side.trim().toLowerCase();
  }

  /**
   * @param source The code block including the three ticks at the beginning and end.
   * @returns `null` if this block is unknown. If known, then throws if yaml does not confirm with {@link DeclarationSpecification}.
  */
  public static parseCodeBlock(source: string, incompleteCallback?: (incomplete: IncompleteDeclarationSpecification) => void) {

    const yamlString = this.contentOfCodeBlock(source);
    if (!yamlString)
      return null;

    const declaration = parseYaml(yamlString);
    if (this.conformsToDeclarationSpecification(declaration))
      return new this(declaration.id, declaration.side);
    
    if (this.conformsToIncompleteDeclarationSpecification(declaration) && incompleteCallback)
      incompleteCallback(declaration);

    return null;
  }

  /**   
   * @param source The code block including the three ticks at the beginning and end.
   * @returns The string inside the code block or `null` if {@link source} or code "language" is unexpected.
  */
  private static contentOfCodeBlock(source: string) {
    const firstLine = source.split("\n", 1).first();
    if (!firstLine)
      return null;

    const language = firstLine.slice(this.CODE_BLOCK_MARKER_LENGTH).trim();
    if (language !== this.LANGUAGE && language !== this.LANGUAGE_SHORT)
      return null;

    const secondLineOffset = firstLine.length + 1; // Add \n back
    return source.slice(secondLineOffset, source.length - this.CODE_BLOCK_MARKER_LENGTH);
  }
  private static readonly CODE_BLOCK_MARKER_LENGTH = 3;

  public static replace(data: string, incomplete: IncompleteDeclarationSpecification, complete: DeclarationSpecification) {            
    return data.replace(this.toString(incomplete), this.toString(complete));    
  }

  private static ensureIDInCodeBlock(source: string) {
    const yamlString = this.contentOfCodeBlock(source);
    return yamlString ? this.ensureID(parseYaml(yamlString)) : null;
  }

  public static ensureID(decl: IncompleteDeclarationSpecification) {

    if (!this.conformsToIncompleteDeclarationSpecification(decl))
      return null;

    if (Object.hasOwn(decl, "id") && this.isIDValid(decl.id))
      return null;

    if (!this.isFrontSide(decl))
      return null;    

    const complete = { 
      ...decl, 
      ...{ 
        id: this.generateID(), 
        side: decl.side 
      } satisfies DeclarationSpecification 
    } as DeclarationSpecification;    

    return complete;
  }

  public static toString(declaration: DeclarationSpecification | IncompleteDeclarationSpecification) {
    return stringifyYaml(declaration);
  }

  private static generateID() {
    return `${new Date().getTime()}`;
  }

  public static render(source: string, el: HTMLElement) {

    const titleContainer = el.createDiv({ cls: "callout-title" })
    titleContainer.createDiv({ cls: "callout-icon" }, (icon) => setIcon(icon, PLUGIN_ICON))
    titleContainer.createDiv({ cls: "callout-title-inner", text: "Flashcard Declaration" })
    const contentContainer = el.createDiv({ cls: "callout-content" })

    const declaration = parseYaml(source);

    if (this.conformsToDeclarationSpecification(declaration)) {
      const p1 = contentContainer.createEl("p");
      p1.innerText = `Side: ${this.isFrontSide(declaration) ? "front" : "back"}`;
      p1.innerText += `\nID: ${declaration.id}`;
    }
    else {
      el.addClass("error");
      titleContainer.addClass("error");
      contentContainer.createEl("p", { text: "Incomplete card declaration." })
    }
  }

  /** 
   * @returns `true` if {@link obj} conforms to {@link DeclarationSpecification}.
   */
  private static conformsToDeclarationSpecification(obj: any): obj is DeclarationSpecification {
    return (
      typeof obj === 'object' && obj !== null &&
      this.isSideValid(obj.side) &&
      this.isIDValid(obj.id)
    );
  }

  private static conformsToIncompleteDeclarationSpecification(obj: any): obj is IncompleteDeclarationSpecification {
    return (
      typeof obj === 'object' && obj !== null &&
      this.isSideValid(obj.side)
    );
  }

  private static isIDValid(value?: any) {    
    return typeof value === 'string' && (<string>value).trim().length > 0;
  }

  private static isSideValid(value?: any) {
    if (typeof value === 'string')
      return [...this.frontSideValues, ...this.backSideValues].includes((<string>value).trim().toLowerCase());
    else
      return false;
  }

  public static isFrontSide(d: DeclarationSpecification | IncompleteDeclarationSpecification) {
    return DeclarationBlock.frontSideValues.includes(d.side);
  }

  public get isFrontSide() {
    return DeclarationBlock.isFrontSide(this);
  }

  private static readonly frontSideValues = ["f", "front"];
  private static readonly backSideValues = ["b", "back"];
}
