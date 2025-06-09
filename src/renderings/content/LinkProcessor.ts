import { Keymap } from "obsidian";
import { ContentRendererPostProcessor, ContentRendererProcessor, PostProcessorParameter } from "./ContentRendererProcessor";

export class LinkProcessor extends ContentRendererProcessor implements ContentRendererPostProcessor {

	public handleHtml(param: PostProcessorParameter) {

		// External links works but not internal.
		// https://forum.obsidian.md/t/internal-links-dont-work-in-custom-view/90169/3
		param.el.querySelectorAll('a.internal-link').forEach(internalLinkEl => {

			if (internalLinkEl instanceof HTMLElement) {
				const handler = async (event: MouseEvent) => {
					event.preventDefault();
					const href = (event.currentTarget as HTMLAnchorElement).getAttribute('href');
					if (href)
						param.app.workspace.openLinkText(href, param.sourcePath, Keymap.isModEvent(event));
				};
				this.registerDomEvent(internalLinkEl, "click", handler);
			}
		});
	}
}
