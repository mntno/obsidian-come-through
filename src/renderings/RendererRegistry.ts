import { CommandableAssistant } from "#/declarations/Commandable";
import { Commands } from "#/declarations/CommandNames";
import { ExplicitDeclarationAssistant } from "#/declarations/ExplicitDeclaration";
import { AlternateHeadingsRenderer } from "#/renderings/declarations/AlternateHeadingsRenderer";
import { DeclarationRenderable, DeclarationRenderer, FactoryRegistryEntry } from "#/renderings/declarations/DeclarationRenderable";
import { HeadingAndDelimiterRenderer } from "#/renderings/declarations/HeadingAndDelimiterRenderer";
import { HeadingIsFrontRenderer } from "#/renderings/declarations/HeadingIsFrontRenderer";
import { PageDeclarationRenderer } from "#/renderings/declarations/PageDeclarationRenderer";


const COMMAND_RENDERERS: FactoryRegistryEntry[] = [
    DeclarationRenderer.Factory.createEntry(Commands.Name.AlternateHeadings, AlternateHeadingsRenderer),
    DeclarationRenderer.Factory.createEntry(Commands.Name.HeadingAndDelimiter, HeadingAndDelimiterRenderer),
    DeclarationRenderer.Factory.createEntry(Commands.Name.HeadingIsFront, HeadingIsFrontRenderer),
];

export const RendererRegistry = {
	tryCreate(declaration: unknown): DeclarationRenderable | null {

		let r: DeclarationRenderable | null = null;

		if (CommandableAssistant.is(declaration)) {
			const entry = COMMAND_RENDERERS.find(r => r.names.includes(declaration.name));
			r = entry ? entry.create(declaration) : null
		}
		else if (ExplicitDeclarationAssistant.MaybePage.is(declaration)) {
			r = new PageDeclarationRenderer(declaration);
		}

		return r;
	}
};
