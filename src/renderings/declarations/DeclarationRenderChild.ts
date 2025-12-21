import { CommandableAssistant } from "#/declarations/Commandable";
import { DeclarableAssistant } from "#/declarations/Declarable";
import { DeclarationCodec } from "#/declarations/DeclarationCodec";
import { Env } from "#/env";
import { DeclarationErrorRenderer } from "#/renderings/declarations/DeclarationErrorRenderer";
import { DataProvider, DeclarationChangedEvent, DeclarationRenderAssistant } from "#/renderings/declarations/DeclarationRenderable";
import { RendererRegistry } from "#/renderings/RendererRegistry";
import { Icon } from "#/ui/constants";
import { MarkdownRenderChild, setIcon } from "obsidian";

export class DeclarationRenderChild extends MarkdownRenderChild {

	private source: string;
	private dataProvider: DataProvider;

	private titleContainer!: HTMLDivElement;
	private titleEl!: HTMLDivElement;
	private contentContainerEl!: HTMLDivElement;

	public constructor(containerEl: HTMLElement, source: string, dataProvider: DataProvider) {
		super(containerEl);

		this.source = source;
		this.dataProvider = dataProvider;
	}

	public override onload(): void {
		Env.log.d("DeclarationRenderChild:onload");
		super.onload();

		// Manual cleanup for these elements in `onunload` is not necessary because they are added directly
		// to `containerEl`, which is managed and eventually discarded by the base class.
		this.containerEl.addClass("callout");

		this.titleContainer = this.containerEl.createDiv({ cls: "callout-title" });
		this.titleContainer.createDiv({ cls: "callout-icon" }, (icon) => setIcon(icon, Icon.PLUGIN));
		this.titleEl = this.titleContainer.createDiv({ cls: "callout-title-inner" });

		this.contentContainerEl = this.containerEl.createDiv({ cls: "callout-content" });
	}

	public override onunload(): void {
		Env.log.d("DeclarationRenderChild:onunload");
		super.onunload();
	}

	/**
		* @param onDomEvent DOM event registered with rendered elements such as buttons or select.
		*/
	public render(onDomEvent: DeclarationChangedEvent) {

		const r = new DeclarationRenderAssistant(
			this.containerEl,
			this.contentContainerEl,
			this.titleContainer,
			this.titleEl,
			this,
			this.dataProvider,
			onDomEvent
		);

		const declaration = DeclarationCodec.tryFromYaml(this.source, error => this.renderYamlError(r, error.message));
		if (declaration === null || !DeclarableAssistant.is(declaration))
			return;

		let declarationRenderer = RendererRegistry.tryCreate(declaration);

		if (declarationRenderer === null) {
			const errorRenderer = new DeclarationErrorRenderer(declaration);

			if (CommandableAssistant.is(declaration)) {
				errorRenderer.method = DeclarationErrorRenderer.unknownCommandName;
				errorRenderer.errorMessage = `Name: ${declaration.name}`;
			} else {
				errorRenderer.method = DeclarationErrorRenderer.invalidCardDeclaration;
			}

			declarationRenderer = errorRenderer;
		}

		declarationRenderer.render(r);
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
