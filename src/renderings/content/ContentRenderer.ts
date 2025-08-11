import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { AudioProcessor } from "./AudioProcessor";
import { ContentProcessorConfig, ContentRendererProcessor, PostProcessorParameter, PreProcessorParameter } from "./ContentRendererProcessor";
import { HtmlElementWrapperProcessor } from "./HtmlElementWrapperProcessor";
import { LinkProcessor } from "./LinkProcessor";
import { VideoProcessor } from "./VideoProcessor";
import { Env } from "env";
import { RecycleComponent } from "renderings/RecycleComponent";
import { PluginSettings } from "Settings";

export function createRenderConfig(settings: PluginSettings): ContentProcessorConfig {
	return {
		media: {
			preventMultiplePlayback: true,
		}
	};
}

export class ContentRenderer extends RecycleComponent {

	private readonly app: App;
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

	public constructor(app: App, config: ContentProcessorConfig) {
		super();
		this.app = app;
		this.config = config;
	}

	protected onRecycled(component: Component): void {

		/** These will always run, and before any custom ones. */
		this.defaultProcessors = [
			new HtmlElementWrapperProcessor({ applyLangTagsToNonLatinScripts: false }),
			new LinkProcessor(),
			new AudioProcessor(),
			new VideoProcessor(),
		];

		this.defaultProcessors.forEach(p => component.addChild(p));
	}

	protected onRecycling(): void {
		this.defaultProcessors = [];
		this.customProcessors = [];
	}

	/** Set processes that will be used in all following calls to {@link render}, replacing any previous ones. Note that these will get unloaded and removed on recycling and therefore, if desired, need to be created and set again ahead of any following call to {@link render}. */
	public setCustomProcessors(processors: ContentRendererProcessor[]) {
		this.customProcessors.forEach(p => this.recycleComponent.removeChild(p));
		this.customProcessors = processors;
		this.customProcessors.forEach(p => this.recycleComponent.addChild(p));
	}

	/** Note that these will get unloaded and removed on recycling and therefore, if desired, need to be created and set again ahead of any following call to {@link render}. */
	public addCustomProcessors(processors: ContentRendererProcessor[]) {
		processors.forEach(p => {
			this.customProcessors.push(p);
			this.recycleComponent.addChild(p);
		});
	}

	/** It is only necessary to remove processors if you do not want to use them during the next call to {@link render}. */
	public removeCustomProcessors(processors: ContentRendererProcessor[]) {
		processors.forEach(p => {
			this.customProcessors.remove(p);
			this.recycleComponent.removeChild(p);
		});
	}

	/**
		*
		* @param markdown
		* @param el
		* @param options Values set here are only valid during this rendering pass. Processors are unloaded.
		* @returns
		*/
	public async render(markdown: string, el: HTMLElement, options?: { sourcePath?: string, processors?: ContentRendererProcessor[] }): Promise<void> {
		const sourcePath = options?.sourcePath ?? this.file?.path;
		const processors: ContentRendererProcessor[] = options?.processors ?? [];

		if (!sourcePath) {
			el.createSpan({ text: "Failed to render." });
			console.error("Could not render markdown. `sourcePath` not set.");
			return;
		}

		if (processors)
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

		Env.log.view(`Running ${allProcessors.filter(p => p.isPreProcessor()).length} pre processors: ${allProcessors.filter(p => p.isPreProcessor()).map(a => a.constructor.name).join(", ")}`);
		for (const processor of allProcessors) {
			if (processor.isPreProcessor())
				processor.handleMarkdown(preParameter);
		}

		await MarkdownRenderer.render(this.app, preParameter.markdown, el, sourcePath, this.recycleComponent);

		Env.log.view(`Running ${allProcessors.filter(p => p.isPostProcessor()).length} post processors: ${allProcessors.filter(p => p.isPostProcessor()).map(a => a.constructor.name).join(", ")}`);
		for (const processor of allProcessors) {
			if (processor.isPostProcessor())
				processor.handleHtml(postParameter);
		}

		if (processors)
			processors.forEach(p => this.recycleComponent.removeChild(p));
	}
}
