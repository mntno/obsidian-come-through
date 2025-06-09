import { Env } from "env";
import { App, Component } from "obsidian";

export type MediaContentProcessorConfig = {
	preventMultiplePlayback: boolean;
}

export type ContentProcessorConfig = {
	media: MediaContentProcessorConfig;
};

export type PreProcessorParameter = {
	markdown: string;
	readonly app: App;
	readonly config: ContentProcessorConfig;
	readonly sourcePath: string;
};

export type PostProcessorParameter = {
	readonly el: HTMLElement;
	readonly app: App;
	readonly config: ContentProcessorConfig;
	readonly sourcePath: string;
};

export interface ContentRendererPreProcessor {
	handleMarkdown(param: PreProcessorParameter): void;
}

export interface ContentRendererPostProcessor {
	handleHtml(param: PostProcessorParameter): void;
}

export abstract class ContentRendererProcessor extends Component {

	public isPreProcessor(): this is ContentRendererPreProcessor {
		return "handleMarkdown" in this;
	}

	public isPostProcessor(): this is ContentRendererPostProcessor {
		return "handleHtml" in this;
	}

	public override onload(): void {
		Env.log.view(`ContentRendererPostProcessor:onload: `+ this.constructor.name);
		super.onload();
	}

	public override onunload(): void {
		Env.log.view(`ContentRendererPostProcessor:onunload: `+ this.constructor.name);
		super.onunload();
	}

	protected static getUrlWithoutParameters(fullUrl: string | null): string | null {
		if (fullUrl === null)
			return null;

		try {
			const url = new URL(fullUrl);
			return url.origin + url.pathname;
		} catch {
			return null;
		}
	}
}
