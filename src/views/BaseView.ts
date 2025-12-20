import { DataStore, DataStoreRoot } from "data/DataStore";
import { Env } from "env";
import { IconName, ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { ContentRenderer, createRenderConfig } from "renderings/content/ContentRenderer";
import { PluginSettings, SettingsChanged, SettingsManager } from "Settings";
import { Icon } from "ui/constants";
import { ElementCreator } from "utils/ElementCreator";
import { getDoc } from "utils/obs/dom";
import { ViewAssistant } from "utils/obs/ViewAssistant";
import { CssClass } from "views/constants";

export type BaseViewOptionalParameters = {
	data?: DataStore;
};

export interface BaseViewState {
	[key: string]: unknown;
}

export interface BaseViewEphemeralState {
	[key: string]: unknown;
}

export abstract class BaseView<State extends BaseViewState> extends ItemView {

	protected readonly settingsManager: SettingsManager;
	protected readonly contentRenderer: ContentRenderer;

	private readonly options?: BaseViewOptionalParameters;
	private readonly viewAssistant: ViewAssistant;
	private domFacade: BaseViewDomFacade | null = null;

	public constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, options?: BaseViewOptionalParameters) {
		Env.log.d("BaseView:constructor");
		super(leaf);

		this.settingsManager = settingsManager;
		this.options = options;

		this.viewAssistant = new ViewAssistant();
		this.contentRenderer = new ContentRenderer(this.app, createRenderConfig(settingsManager.settings));
		this.addChild(this.contentRenderer);
	}

	public override onload(): void {
		Env.log.d("BaseView:onload");
		super.onload();
	}

	public override onunload(): void {
		Env.log.d("BaseView:onunload");
		super.onunload();
	}

	public override getIcon(): IconName {
		Env.log.d("BaseView:getIcon");
		return Icon.PLUGIN;
	}

	protected override async onOpen(): Promise<void> {
		Env.log.d("BaseView:onOpen");
		await super.onOpen();

		this.settingsManager.registerOnChangedCallback(this.settingsChangedCallback);
		if (this.options) {
			this.options.data?.registerOnChangedCallback(this.dataChangedCallback);
		}

		this.contentEl.empty();
		this.containerEl.addClass(CssClass.WORKSPACE_LEAF_CONTENT_MODIFIER);
		this.viewAssistant.init(this);
	}

	protected override async onClose(): Promise<void> {
		Env.log.d("BaseView:onClose");
		await super.onClose();

		this.settingsManager.unregisterOnChangedCallback(this.settingsChangedCallback);
		if (this.options) {
			this.options.data?.unregisterOnChangedCallback(this.dataChangedCallback);
		}

		this.contentRenderer.unload(); // Will also be unloaded when this view unloads.
		this.domFacade = null;
		this.viewAssistant.deinit();
		this.containerEl.removeClass(CssClass.WORKSPACE_LEAF_CONTENT_MODIFIER);
	}

	public override onResize(): void {
		Env.log.d("BaseView:onResize");
		super.onResize();

		this.viewAssistant.adjustAvailableVerticalScrolling();
	}

	/** Defines the fundamental configuration needed to recreate the view's essential content and layout. */
	public override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		Env.log.d("BaseView:setState:", this.didSetState, state);
		await super.setState(state, result);

		if (!this.didSetState) {
			this.onSetState(state as State, result);
			this.didSetState = true;

			//this.contentRenderer.recycle();
			Env.log.view("BaseView:setState: refreshing view because state was set");
			await this.render();
		}
	}
	/** Subclasses should store and manage their own {@link BaseViewState}. {@link onSetState} is only called once per instantiation of this class. */
	private didSetState: boolean = false;

	public override getState(): Record<string, unknown> {
		Env.log.d("BaseView:getState");
		return {
			...super.getState(),
			...this.onGetState(),
		};
	}

	public override setEphemeralState(state: unknown): void {
		Env.log.d("BaseView:setEphemeralState", this.didSetEphemeralState, state);
		super.setEphemeralState(state);
		if (!this.didSetEphemeralState) {
			this.onSetEphemeralState(state);
			this.didSetEphemeralState = true;
		}
	}
	/** Subclasses should store and manage their own {@link BaseViewEphemeralState}. {@link onSetEphemeralState} is only called once per instantiation of this class. */
	private didSetEphemeralState: boolean = false;

	public override getEphemeralState(): Record<string, unknown> {
		Env.log.d("BaseView:getEphemeralState");
		return {
			... super.getEphemeralState(),
			... this.onGetEphemeralState()
		};
	}

	private dataChangedCallback = async (data: DataStoreRoot) => {
		Env.log.d("BaseView:dataChangedCallback");
		const outParams = {
			skipRender: false,
		};

		this.onDataChanged(data, outParams);

		if (!outParams.skipRender)
			await this.render();
	}

	private settingsChangedCallback: SettingsChanged = async (settings, isExternal) => {
		Env.log.d("BaseView:settingsChangedCallback");
		if (!isExternal)
			this.contentRenderer.config = createRenderConfig(settings);

		const outParams = {
			skipRender: false,
		};

		this.onSettingsChanged(settings, isExternal, outParams);

		if (!outParams.skipRender)
			await this.render();
	}

	/**
		* Recycles/clears/resets everything and invokes {@link onRender}.
		*
		* Subclasses should call this method to build or rebuild the view.
		*/
	protected render = async () => {
		Env.log.d("BaseView:render");
		this.contentRenderer.recycle();
		this.viewAssistant.empty();

		await this.onRender();
		this.viewAssistant.adjustAvailableVerticalScrolling();
	};

	/** Invoked when the system supplies the state. Save it if needed. */
	protected abstract onSetState(state: State, result: ViewStateResult): void;
	/** Supply the state to the system. */
	protected abstract onGetState(): State;
	protected onSetEphemeralState(state: unknown): void { };
	protected onGetEphemeralState(): Record<string, unknown> { return {}; };
	protected abstract onRender(): Promise<void>;

	protected onDataChanged(data: DataStoreRoot, out: { skipRender: boolean }): void { };
	protected onSettingsChanged(settings: PluginSettings, isExternal: boolean, out: { skipRender: boolean }): void { };

	protected get scrollPosition(): { top: number, left: number } {
		return this.viewAssistant.scrollContainer
			? { top: this.viewAssistant.scrollContainer.scrollTop, left: this.viewAssistant.scrollContainer.scrollLeft }
			: { top: 0, left: 0 };
	}

	protected setScrollPosition(options: ScrollToOptions) {
		Env.log.d("BaseView:setScrollPosition", options);
		this.viewAssistant.scrollContainer?.scrollTo(options)
	}

	protected saveState() {
		Env.log.d("BaseView:saveState");
		this.app.workspace.requestSaveLayout();
	}

	/** Subclasses should use this to access the DOM. */
	protected get dom(): BaseViewDomFacade {
		if (this.domFacade === null) {
			const contentEl = this.viewAssistant.contentEl;
			this.domFacade = {
				contentEl: contentEl,
				create: new ElementCreator(contentEl),
				doc: getDoc(contentEl),
			}
		}
		return this.domFacade;
	}
}

type BaseViewDomFacade = {
	/** The root HTML element for the view's content. */
	contentEl: HTMLElement,
	/** Use to create new DOM elements within the view's content element. */
	create: ElementCreator,
	/** The document associated with the view's content element. */
	doc: Document,
};
