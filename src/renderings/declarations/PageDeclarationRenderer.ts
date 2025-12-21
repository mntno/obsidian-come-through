import { DefaultableCardDeclarable, ExplicitDeclarationAssistant, MaybePageDeclarable } from "#/declarations/ExplicitDeclaration";
import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "#/renderings/declarations/DeclarationRenderable";
import { Str } from "utils/ts";

const Assistant = ExplicitDeclarationAssistant;

export class PageDeclarationRenderer
	extends DeclarationRenderer<MaybePageDeclarable>
	implements DeclarationRenderable {

	public render(r: DeclarationRenderAssistant) {

		if (!Assistant.MaybePage.isValid(this.declarable)) {
			PageDeclarationRenderer.renderError(r, "`side` must be a string, number, or boolean.");
		}
		else {
			if (Assistant.Defaultable.is(this.declarable)) {
				PageDeclarationRenderer.renderDefaultDeclarable(r, this.declarable);
			}
			else {
				PageDeclarationRenderer.renderError(r, "`id` and `side` must be text.");
			}
		}
	}

	private static renderError(r: DeclarationRenderAssistant, msg?: string) {
		r.setError();
		r.setTitle("Invalid page declaration");
		if (msg !== undefined)
			r.addParagraph(msg);
	}

	private static renderDefaultDeclarable(r: DeclarationRenderAssistant, declarable: DefaultableCardDeclarable) {

		if (!Assistant.Defaultable.isValid(declarable)) {
			PageDeclarationRenderer.renderError(r);
			r.addBulletList(["`side` must be f, front, b or back", "`id` must be a string"]);
			return;
		}

		const completeDeclarable = Assistant.is(declarable) ? declarable : null;
		const validCompleteDeclarable = completeDeclarable !== null && Assistant.isValid(completeDeclarable) ? completeDeclarable : null;

		if (Assistant.canComplete(declarable) || validCompleteDeclarable !== null) {
			const isFront = Assistant.isFrontSide(declarable);

			r.setTitle("Page declaration");

			let idValue = validCompleteDeclarable !== null ? validCompleteDeclarable.id : declarable.id;

			if (Assistant.PropertyEq.optionalNullOrString(idValue, (str) => !Str.isNonEmpty(str))) {
				idValue = isFront ? "Generating…" : Str.EMPTY;
				if (!isFront)
					r.addParagraph("`id` is missing.");
			}

			r.createTable().addBody(row => {

				row.add((col) => {
					col.add({ text: "ID" });
					col.add({ text:  idValue });
				});

				row.add((col) => {
					col.add({ text: "Side" });
					col.add({ text: `${isFront ? "Front" : "Back"}` });
				});

				if (isFront) {
					r.createDeckRow(row.sectionEl, declarable);
				}
			});
		}
		else { // validCompleteDeclarable === null
			PageDeclarationRenderer.renderError(r);

			if (Assistant.isFrontSide(declarable))
				r.addParagraph("`id` should be a 10 character string.");
			else
				r.addParagraph("Add `id` that matches the front side.");
		}
	}
}
