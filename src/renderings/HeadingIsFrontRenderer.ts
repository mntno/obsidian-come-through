import { HeadingIsFrontAssistant, HeadingIsFrontDeclarable } from "declarations/commands/HeadingIsFront";
import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "renderings/DeclarationRenderable";

export class HeadingIsFrontRenderer
	extends DeclarationRenderer<HeadingIsFrontDeclarable>
	implements DeclarationRenderable {

	public render(r: DeclarationRenderAssistant) {

		if (!HeadingIsFrontAssistant.conforms(this.declarable) || !HeadingIsFrontAssistant.isValid(this.declarable)) {
			r.setError();
			r.setTitle("Invalid headings is front command");
			r.addParagraph("Please check the entered values.");
			return;
		}

		r.setTitle("Each headings becomes the front side");
		r.addParagraph("The content of the heading becomes the back side.");

		const table = r.createEl("table");
		const body = table.createEl("tbody");

		body.createEl("tr", undefined, (el) => {
			el.createEl("td", { text: "Levels below this heading" });
			el.createEl("td", { text: this.declarable.level.toString() });
		});

		r.createDeckRow(body, this.declarable);
	}
}
