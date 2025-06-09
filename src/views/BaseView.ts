import { DataStore, DataStoreRoot } from "DataStore";
import { Env } from "env";
import { ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { ContentRenderer, createRenderConfig } from "renderings/content/ContentRenderer";
import { PluginSettings, SettingsChanged, SettingsManager } from "Settings";
import { PLUGIN_ICON } from "UIAssistant";
import { ViewAssistant } from "./ViewAssistant";

export type BaseViewOptionalParameters = {
	data?: DataStore;
};

export interface BaseViewState {
	[key: string]: unknown;
}

export abstract class BaseView<State extends BaseViewState> extends ItemView {

	protected readonly settingsManager: SettingsManager;
	private readonly options?: BaseViewOptionalParameters;

	protected readonly contentRenderer: ContentRenderer;
	protected readonly viewAssistant = new ViewAssistant();

	constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, options?: BaseViewOptionalParameters) {
		super(leaf);

		this.settingsManager = settingsManager;
		this.options = options;

		this.contentRenderer = new ContentRenderer(this.app, createRenderConfig(settingsManager.settings));
		this.addChild(this.contentRenderer);
	}

	public override onload(): void {
		Env.log.view("onload");
		super.onload();
	}

	public override onunload(): void {
		Env.log.view("onunload");
		super.onunload();
	}

	public override getIcon() {
		Env.log.view("getIcon");
		return PLUGIN_ICON;
	}

	protected override async onOpen(): Promise<void> {
		Env.log.view("onOpen");
		this.settingsManager?.registerOnChangedCallback(this.settingsChangedCallback);
		if (this.options) {
			this.options.data?.registerOnChangedCallback(this.dataChangedCallback);
		}

		this.contentEl.empty();
		this.viewAssistant.init(this);
	}

	protected override async onClose(): Promise<void> {
		Env.log.view("onClose");
		this.settingsManager?.unregisterOnChangedCallback(this.settingsChangedCallback);
		if (this.options) {
			this.options.data?.unregisterOnChangedCallback(this.dataChangedCallback);
		}

		this.contentRenderer.unload(); // Will also be unloaded when this view unloads.
		this.viewAssistant.deinit();
	}

	public override onResize(): void {
		Env.log.view("onResize");
		this.viewAssistant.adjustAvailableVerticalScrolling();
	}

	public override async setState(state: State, result: ViewStateResult) {
		Env.log.view("setState");
		this.onSetState(state, result);

		await this.refreshView();
		await super.setState(state, result);
	}

	public override getState(): Record<string, unknown> {
		Env.log.view("getState");
		return this.onGetState();
	}

	private dataChangedCallback = async (data: DataStoreRoot) => {
		Env.log.view("dataChangedCallback");
		const outParams = {
			skipRender: false,
		};

		this.onDataChanged(data, outParams);

		if (!outParams.skipRender)
			await this.refreshView();
	}

	private settingsChangedCallback: SettingsChanged = async (settings, isExternal) => {
		Env.log.view("settingsChangedCallback");
		if (!isExternal)
			this.contentRenderer.config = createRenderConfig(settings);

		const outParams = {
			skipRender: false,
		};

		this.onSettingsChanged(settings, isExternal, outParams);

		if (!outParams.skipRender)
			await this.refreshView();
	}

	protected refreshView = async () => {
		Env.log.view("refreshView");
		this.contentRenderer.recycle();
		this.viewAssistant.empty();

		await this.onRender();
		this.viewAssistant.adjustAvailableVerticalScrolling();
	};

	protected abstract onSetState(state: State, result: ViewStateResult): void;
	protected abstract onGetState(): State;
	protected abstract onRender(): Promise<void>;

	protected onDataChanged(data: DataStoreRoot, out: { skipRender: boolean }): void {};
	protected onSettingsChanged(settings: PluginSettings, isExternal: boolean, out: { skipRender: boolean }): void {};

	protected get scrollPosition(): { top: number, left: number } {
		return this.viewAssistant.scrollContainer
			? { top: this.viewAssistant.scrollContainer.scrollTop, left: this.viewAssistant.scrollContainer.scrollLeft }
			: { top: 0, left: 0};
	}

	protected setScrollPosition(options: ScrollToOptions) {
		this.viewAssistant.scrollContainer?.scrollTo(options)
	}

	protected saveState() {
		this.app.workspace.requestSaveLayout();
	}
}
