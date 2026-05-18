import { Env } from "#/env";
import { ProcessorConfigProvider } from "#/renderings/content/ProcessorConfigProvider";
import { ContentRendererProcessor } from "#/renderings/content/processors/bases";
import { defaultProcessors } from "#/renderings/content/processors/defaultProcessors";
import { ContentProcessorConfig, PostProcessorParameter, PreProcessorParameter } from "#/renderings/content/processors/types";
import { Win } from "#/utils/obs/dom";
import { RecycleComponent } from "#/utils/obs/RecycleComponent";
import { Async } from "#/utils/ts";
import { App, Component, MarkdownRenderer, TFile } from "obsidian";

export function createRenderConfig(): ContentProcessorConfig {
	return {};
}

export type ContentRenderOptions = {
	sourcePath?: string;
	processors?: ContentRendererProcessor[];
	timeoutMs?: number;
};

export class ContentRenderer extends RecycleComponent {

	private readonly app: App;
	private readonly processorConfigProvider: ProcessorConfigProvider;
	public config: ContentProcessorConfig;

	/**
		* The {@link TFile} of which {@link TFile.path} will be used as `sourcePath` when rendering.
		*
		* - The {@link TFile.path} will be updated automatically if the file is renamed (which is why the type is {@link TFile} rather than `string`).
		* - The `sourcePath` can be overridden by the options parameter of {@link render}.
		* - `null` is allowed because it's what `app.vault.getFileByPath` returns when it cannot find a file at the given path.
		* - If is `undefined` at the time of render, {@link render} will render a "failed" message and abort.
		*/
	public file: TFile | undefined | null;

	/** These will always run, and before {@link customProcessors}. */
	private defaultProcessors: ContentRendererProcessor[] = [];

	/** These can be overridden by the options parameter of {@link render}. */
	private customProcessors: ContentRendererProcessor[] = [];

	public constructor(app: App, config: ContentProcessorConfig, processorConfigProvider: ProcessorConfigProvider) {
		Env.log.proc("ContentRenderer:constructor");
		super();
		this.app = app;
		this.processorConfigProvider = processorConfigProvider;
		this.config = config;
	}

	protected override onRecycled(component: Component): void {
		Env.log.proc("ContentRenderer:onRecycled");

		/** These will always run, and before any custom ones. */
		this.defaultProcessors = defaultProcessors(this.processorConfigProvider);
		this.defaultProcessors.forEach(p => component.addChild(p));
	}

	protected override onRecycling(): void {
		Env.log.proc("ContentRenderer:onRecycling");
		this.defaultProcessors = [];
		this.customProcessors = [];
	}

	/** Set processes that will be used in all following calls to {@link render}, replacing any previous ones. Note that these will get unloaded and removed on recycling and therefore, if desired, need to be created and set again ahead of any following call to {@link render}. */
	public setCustomProcessors(processors: ContentRendererProcessor[]) {
		Env.log.proc("ContentRenderer:setCustomProcessors");
		this.customProcessors.forEach(p => this.recycleComponent.removeChild(p));
		this.customProcessors = processors;
		this.customProcessors.forEach(p => this.recycleComponent.addChild(p));
	}

	/** Note that these will get unloaded and removed on recycling and therefore, if desired, need to be created and set again ahead of any following call to {@link render}. */
	public addCustomProcessors(processors: ContentRendererProcessor[]) {
		Env.log.proc("ContentRenderer:addCustomProcessors");
		processors.forEach(p => {
			this.customProcessors.push(p);
			this.recycleComponent.addChild(p);
		});
	}

	/** It is only necessary to remove processors if you do not want to use them during the next call to {@link render}. */
	public removeCustomProcessors(processors: ContentRendererProcessor[]) {
		Env.log.proc("ContentRenderer:removeCustomProcessors");
		processors.forEach(p => {
			this.customProcessors.remove(p);
			this.recycleComponent.removeChild(p);
		});
	}

	/**
		* @param markdown
		* @param el
		* @param options
		* @throws Throws a {@link TimeoutError} if the promise does not settle within the specified timeout (default 4000ms).
		*/
	public async render(markdown: string, el: HTMLElement, options?: ContentRenderOptions): Promise<void> {
		const {
			sourcePath = this.file?.path,
			processors = [],
			timeoutMs = 4000,
		} = options ?? {};

		Env.log.proc("ContentRenderer:render: processors", processors, sourcePath);

		if (sourcePath === undefined) {
			el.createSpan({ text: "Failed to render." });
			console.error("Could not render markdown. `sourcePath` not set.");
			return;
		}

		processors.forEach(p => this.recycleComponent.addChild(p));

		const param = {
			app: this.app,
			config: this.config,
			component: this.recycleComponent,
			sourcePath,
		};

		const preParameter = {
			...param,
			...{ markdown: markdown }
		} satisfies PreProcessorParameter;

		const postParameter = {
			...param,
			...{ el: el }
		} satisfies PostProcessorParameter;

		// default run first
		const allProcessors = [...this.defaultProcessors, ...this.customProcessors, ...processors];

		Env.dev?.log.proc(`ContentRenderer:render: Running ${allProcessors.filter(p => p.isPreProcessor()).length} pre processors: ${allProcessors.filter(p => p.isPreProcessor()).map(a => a.constructor.name).join(", ")}`);
		for (const processor of allProcessors) {
			if (processor.isPreProcessor())
				processor.handleMarkdown(preParameter);
		}

		Env.log.proc("ContentRenderer:render: calling `MarkdownRenderer`, timeout", timeoutMs);
		await Async.withTimeout(MarkdownRenderer.render(this.app, preParameter.markdown, el, sourcePath, this.recycleComponent), timeoutMs, Win.from(el));
		Env.log.proc("\tRendering done.");

		Env.dev?.log.proc(`ContentRenderer:render: Running ${allProcessors.filter(p => p.isPostProcessor()).length} post processors: ${allProcessors.filter(p => p.isPostProcessor()).map(a => a.constructor.name).join(", ")}`);
		for (const processor of allProcessors) {
			if (processor.isPostProcessor())
				processor.handleHtml(postParameter);
		}

		processors.forEach(p => this.recycleComponent.removeChild(p));
	}
}
