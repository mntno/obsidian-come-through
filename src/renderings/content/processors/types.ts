import { App } from "obsidian";

export type ContentProcessorConfig = Record<string, never>; // Reserved for future configuration options (e.g. `isRtl`).

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
