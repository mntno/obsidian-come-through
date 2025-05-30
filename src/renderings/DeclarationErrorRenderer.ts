import { DeclarationRenderable, DeclarationRenderAssistant, DeclarationRenderer } from "renderings/DeclarationRenderable";
import { Declarable, Declaration } from "declarations/Declaration";


export class DeclarationErrorRenderer
	extends DeclarationRenderer<Declarable>
	implements DeclarationRenderable {

	public method?: (r: DeclarationRenderAssistant, errorMessage?: string) => void;
	public errorMessage?: string;

	public render(r: DeclarationRenderAssistant) {
		r.setError();
		if (this.method) {
			this.method(r, this.errorMessage)
		}
		else {
			r.setTitle("Unexpected error");
			r.addParagraph("Please check entered keys and values.");
		}
	}

	public static invalidCardDeclaration(r: DeclarationRenderAssistant, errorMessage?: string) {
		r.setTitle("Invalid card declaration");
		r.addParagraph("Please check entered keys and values.");
	}

	public static invalidCommandDeclaration(r: DeclarationRenderAssistant, errorMessage?: string) {
		r.setTitle("Invalid declaration command");
		r.addParagraph("Please check the entered values.");
	}

	public static unknownCommandName(r: DeclarationRenderAssistant, errorMessage?: string) {
		r.setTitle("Unknown declaration command");
		if (errorMessage)
			r.addParagraph(errorMessage);
	}
}
