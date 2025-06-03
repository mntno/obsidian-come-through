import { DeclarationRenderer, DeclarationRenderable, DeclarationRenderAssistant } from "renderings/DeclarationRenderable";
import { HeadingAndDelimiterAssistant, HeadingAndDelimiterDeclarable } from "declarations/commands/HeadingAndDelimiter";
import { CardDeclarationAssistant, DefaultableCardDeclarable } from "declarations/CardDeclaration";

export class CardDeclarationRenderer
	extends DeclarationRenderer<DefaultableCardDeclarable>
	implements DeclarationRenderable {

	public render(f: DeclarationRenderAssistant) {

		f.setTitle("Flashcard declaration");

		const table = f.createEl("table");
		const body = table.createEl("tbody");

		const rowID = body.createEl("tr");
		rowID.createEl("td", { text: "ID" });
		rowID.createEl("td", { text: this.declarable.id });

		const rowSide = body.createEl("tr");
		rowSide.createEl("td", { text: "Side" });
		rowSide.createEl("td", { text: `${CardDeclarationAssistant.isFrontSide(this.declarable) ? "Front" : "Back"}` });

		if (CardDeclarationAssistant.isFrontSide(this.declarable)) {
			f.createDeckRow(body, this.declarable);
		}
	}
}
