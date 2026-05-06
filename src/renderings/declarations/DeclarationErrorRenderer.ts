import { DeclarationRenderable, DeclarationRenderAssistant } from "#/renderings/declarations/DeclarationRenderable";
import { YamlObject } from "#/declarations/DeclarationCodec";


export class DeclarationErrorRenderer
	implements DeclarationRenderable {

	public method?: (r: DeclarationRenderAssistant, errorMessage?: string) => void;
	public errorMessage?: string;

	private declaration: YamlObject;

	constructor(declaration: YamlObject) {
		this.declaration = declaration;
	}

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

	public static invalidCardDeclaration(this: void, r: DeclarationRenderAssistant, _errorMessage?: string) {
		r.setTitle("Invalid card declaration");
		r.addParagraph("Please check entered keys and values.");
	}

	public static invalidCommandDeclaration(this: void, r: DeclarationRenderAssistant, _errorMessage?: string) {
		r.setTitle("Invalid declaration command");
		r.addParagraph("Please check the entered values.");
	}

	public static unknownCommandName(this: void, r: DeclarationRenderAssistant, errorMessage?: string) {
		r.setTitle("Unknown declaration command");
		if (errorMessage)
			r.addParagraph(errorMessage);
	}
}
