import { ContentRendererProcessor } from "#/renderings/content/processors/bases";
import { ContentRendererPostProcessor, PostProcessorParameter } from "#/renderings/content/processors/types";
import { Api } from "#/utils/obs/api";

export class LinkProcessor extends ContentRendererProcessor implements ContentRendererPostProcessor {

	constructor() { super({}); }

	public handleHtml(param: PostProcessorParameter) {

		// External links works but not internal.
		// https://forum.obsidian.md/t/internal-links-dont-work-in-custom-view/90169/3
		param.el.querySelectorAll('a.internal-link').forEach(internalLinkEl => {

			if (internalLinkEl.instanceOf(HTMLElement)) {
				const handler = async (event: PointerEvent) => {
					event.preventDefault();
					const href = (event.currentTarget as HTMLAnchorElement).getAttribute('href');
					if (href)
						await param.app.workspace.openLinkText(href, param.sourcePath, Api.Event.paneType(event));
				};
				this.registerDomEvent(internalLinkEl, "click", handler);
			}
		});
	}
}
