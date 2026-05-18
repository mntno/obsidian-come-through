import { CollectionableAssistant } from "#/declarations/Collectionable";
import { CommandableAssistant } from "#/declarations/Commandable";
import { Declarable, DeclarableAssistant } from "#/declarations/Declarable";
import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "#/renderings/declarations/DeclarationRenderable";
import { Str } from "#/utils/ts";


export class DefaultDeclarationRenderer extends DeclarationRenderer<Declarable> implements DeclarationRenderable {

	public static override canRender = (value: unknown) => DeclarableAssistant.is(value)

	public render(r: DeclarationRenderAssistant) {

		if (CommandableAssistant.is(this.declarable))
			r.setTitle(Str.toSingleSentenceCase(this.declarable.name));

		if (CollectionableAssistant.is(this.declarable)) {
			const createSection = r.createTable();
			const body = createSection.addBody();
			r.createDeckRow(body.sectionEl, this.declarable);
		}
	}
}
