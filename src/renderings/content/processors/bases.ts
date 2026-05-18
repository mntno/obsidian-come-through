import { Env } from "#/env";
import { ContentRendererPostProcessor, ContentRendererPreProcessor } from "#/renderings/content/processors/types";
import { Component } from "obsidian";

export abstract class ContentRendererProcessor<Config = NonNullable<unknown>> extends Component {

	protected readonly config: Config;

	constructor(config: Config) {
		super();
		this.config = config;
	}

	public isPreProcessor(): this is ContentRendererPreProcessor {
		return "handleMarkdown" in this;
	}

	public isPostProcessor(): this is ContentRendererPostProcessor {
		return "handleHtml" in this;
	}

	public override onload(): void {
		Env.log.d("ContentRendererPostProcessor:onload:", this.constructor.name);
		super.onload();
	}

	public override onunload(): void {
		Env.log.d("ContentRendererPostProcessor:onunload:", this.constructor.name);
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
