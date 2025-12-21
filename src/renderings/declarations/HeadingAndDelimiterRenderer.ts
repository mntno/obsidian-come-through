import { HeadingAndDelimiterAssistant, HeadingAndDelimiterDeclarable } from "#/declarations/commands/HeadingAndDelimiter";
import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "#/renderings/declarations/DeclarationRenderable";
import { UNARY_UNION_SUPPRESS } from "#/utils/ts";

const Assistant = HeadingAndDelimiterAssistant;

export class HeadingAndDelimiterRenderer
	extends DeclarationRenderer<HeadingAndDelimiterDeclarable>
	implements DeclarationRenderable {

	public static override canRender = (value: unknown) => Assistant.is(value);

	public render(r: DeclarationRenderAssistant) {

		if (!HeadingAndDelimiterAssistant.is(this.declarable) || !HeadingAndDelimiterAssistant.isValid(this.declarable)) {
			r.setError();
			r.setTitle("Invalid alternate headings command");
			r.addParagraph("Please check the entered values.");
			return;
		}

		r.setTitle("Heading and delimiter");

		r.createBulletList((el) => {
			return [
				el.createEl("li", {
					text: `Automatically generate a card for every heading ${this.declarable.level} levels below this one.`
				}),
				el.createEl("li", undefined, (el) => {
					switch (this.declarable.delimiter) {
						case UNARY_UNION_SUPPRESS:
							break;

						case "horizontal rule": {
							el.appendText("The back side will begin after the first ");
							el.createEl("a", { text: "horizontal rule", href: "https://daringfireball.net/projects/markdown/syntax#hr" });
							el.appendText(" within the heading’s section.");
							break;
						}
					}
				})
			];
		});

		const table = r.createEl("table");
		const body = table.createEl("tbody");

		body.createEl("tr", undefined, (el) => {
			el.createEl("td", { text: "Levels below this heading" });
			el.createEl("td", { text: this.declarable.level.toString() });
		});

		body.createEl("tr", undefined, (el) => {
			el.createEl("td", { text: "Page delimiter" });
			el.createEl("td", { text: "The first horizontal rule" });
		});

		r.createDeckRow(body, this.declarable);
	}
}
