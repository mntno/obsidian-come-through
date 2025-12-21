import { AlternateHeadingsAssistant, AlternateHeadingsDeclarable } from "#/declarations/commands/AlternateHeadings";
import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "#/renderings/declarations/DeclarationRenderable";

const Assistant = AlternateHeadingsAssistant;

export class AlternateHeadingsRenderer
	extends DeclarationRenderer<AlternateHeadingsDeclarable>
	implements DeclarationRenderable {

	public static override canRender = (value: unknown) => Assistant.is(value);

	public render(r: DeclarationRenderAssistant) {

		if (!Assistant.isValid(this.declarable)) {
			r.setError();
			r.setTitle("Invalid alternate headings command");
			r.addParagraph("Please check the entered values.");
			return;
		}

		r.setTitle("Alternate headings");
		r.addParagraph(`Automatically generate a card for every other heading ${this.declarable.level} levels below this one, where the heading in between is the back side of the heading that came before.`);

		const table = r.createEl("table");
		const body = table.createEl("tbody");

		body.createEl("tr", undefined, (el) => {
			el.createEl("td", { text: "Levels below this heading" });
			el.createEl("td", { text: this.declarable.level.toString() });
		});

		r.createDeckRow(body, this.declarable);
	}
}
