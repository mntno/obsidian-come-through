import { CardDeclaration } from "declarations/CardDeclaration";
import { CommandDeclarationAssistant } from "declarations/CommandDeclaration";
import { Declaration } from "declarations/Declaration";
import { MarkdownRenderChild, setIcon } from "obsidian";
import { AlternateHeadingsRenderer } from "renderings/AlternateHeadingsRenderer";
import { CardDeclarationRenderer } from "renderings/CardDeclarationRenderer";
import { DeclarationErrorRenderer } from "renderings/DeclarationErrorRenderer";
import { DataProvider, DeclarationChangedEvent, DeclarationRenderable, DeclarationRenderAssistant } from "renderings/DeclarationRenderable";
import { HeadingAndDelimiterRenderer } from "renderings/HeadingAndDelimiterRenderer";
import { HeadingIsFrontRenderer } from "renderings/HeadingIsFrontRenderer";
import { PLUGIN_ICON } from "UIAssistant";

export class DeclarationRenderChild extends MarkdownRenderChild {

	public constructor(containerEl: HTMLElement, source: string, dataProvider: DataProvider) {
		super(containerEl);

		this.source = source;
		this.dataProvider = dataProvider;
	}

	private contentContainerEl: HTMLDivElement;
	private source: string;
	private dataProvider: DataProvider;

	private titleContainer: HTMLDivElement;
	private titleEl: HTMLDivElement;

	/**
		* @param onDomEvent DOM event registered with rendered elements such as buttons or select.
		*/
	public render(onDomEvent: DeclarationChangedEvent) {

		this.initRender();

		const r = new DeclarationRenderAssistant(
			this.containerEl,
			this.contentContainerEl,
			this.titleContainer,
			this.titleEl,
			this,
			this.dataProvider,
			onDomEvent
		);

		const declaration = Declaration.tryParseYaml(this.source, error => this.renderYamlError(r, error.message));
		if (declaration === null)
			return;

		let declarationRenderer: DeclarationRenderable = new DeclarationErrorRenderer(declaration);

		if (CommandDeclarationAssistant.conforms(declaration)) {

			if (CommandDeclarationAssistant.isNameValid(declaration)) {
				if (CommandDeclarationAssistant.isHeadingAndDelimiter(declaration))
					declarationRenderer = new HeadingAndDelimiterRenderer(declaration);
				else if (CommandDeclarationAssistant.isAlternateHeadings(declaration))
					declarationRenderer = new AlternateHeadingsRenderer(declaration);
				else if (CommandDeclarationAssistant.isHeadingIsFront(declaration))
					declarationRenderer = new HeadingIsFrontRenderer(declaration);
			}

			if (declarationRenderer instanceof DeclarationErrorRenderer) {
				declarationRenderer.method = DeclarationErrorRenderer.unknownCommandName;
				declarationRenderer.errorMessage = `Name: ${declaration.name}`;
			}
		}
		else {
			if (CardDeclaration.conformsToDefaultable(declaration))
				declarationRenderer = new CardDeclarationRenderer(declaration);

			if (declarationRenderer instanceof DeclarationErrorRenderer)
				declarationRenderer.method = DeclarationErrorRenderer.invalidCardDeclaration;
		}

		declarationRenderer.render(r);
	}

	private initRender() {
		this.containerEl.addClass("callout");

		this.titleContainer = this.containerEl.createDiv({ cls: "callout-title" });
		this.titleContainer.createDiv({ cls: "callout-icon" }, (icon) => setIcon(icon, PLUGIN_ICON));
		this.titleEl = this.titleContainer.createDiv({ cls: "callout-title-inner" });

		this.contentContainerEl = this.containerEl.createDiv({ cls: "callout-content" });
		return this.contentContainerEl;
	}

	private renderYamlError(r: DeclarationRenderAssistant, errorMessage?: string) {
		r.setError();
		r.setTitle("Invalid format entered");
		r.addParagraph(`Please check for the following:`);
		r.addBulletList([
			"Missing or misplaced colons after keys (e.g., `side front` instead of `side: front`).",
			"Incorrect spacing around colons (e.g., `side:front` instead of `side: front`).",
			"Pay close attention to how the information is indented. Sometimes, the alignment of the text matters.",
		]);

		if (errorMessage)
			r.createEl("p", { text: `Specific details: ${errorMessage}` });
	}
}
