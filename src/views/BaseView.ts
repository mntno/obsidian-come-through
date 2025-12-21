import { CssClass } from "#/constants";
import { DataStore, DataStoreRoot } from "#/data/DataStore";
import { Env } from "#/env";
import { ContentRenderer, createRenderConfig } from "#/renderings/content/ContentRenderer";
import { PluginSettings, SettingsChanged, SettingsManager } from "#/Settings";
import { Icon } from "#/ui/constants";
import { Doc, El } from "#/utils/dom/dom";
import { ElementCreator } from "#/utils/ElementCreator";
import { InteractionAssistant } from "#/utils/obs/InteractionAssistant";
import { ViewAssistant } from "#/utils/obs/ViewAssistant";
import { Bln } from "#/utils/ts";
import { IconName, ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";

export type BaseViewOptionalParameters = {
	data?: DataStore;
};

export interface BaseViewState {
	/** {@link BaseView.prototype.setState} only forwards the state to subclasses once unless this is set. Therefore, set this to render based on a new state in an already opened view. Use {@linkcode BaseView.withDefaultViewState}. */
	forceUpdate?: boolean;
	[key: string]: unknown;
}

export interface BaseViewEphemeralState {
	[key: string]: unknown;
}

export interface BaseViewScrollToOptions extends ScrollToOptions { // eslint-disable-line @typescript-eslint/no-empty-object-type
}

export abstract class BaseView<State extends BaseViewState> extends ItemView {

	protected static withDefaultViewState<T extends BaseViewState>(state: T): T {
		return {
			...state,
			forceUpdate: true
		};
	}

	protected readonly settingsManager: SettingsManager;
	protected readonly contentRenderer: ContentRenderer;
	protected readonly interactionAssistant: InteractionAssistant;

	private readonly options?: BaseViewOptionalParameters;
	private readonly viewAssistant: ViewAssistant;
	private domFacade: BaseViewDomFacade | null = null;

	public constructor(leaf: WorkspaceLeaf, settingsManager: SettingsManager, options?: BaseViewOptionalParameters) {
		Env.log.d("BaseView:constructor");
		super(leaf);

		this.settingsManager = settingsManager;
		this.options = options;

		this.viewAssistant = new ViewAssistant();
		this.interactionAssistant = new InteractionAssistant(this.app, this, this.viewAssistant);
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
		this.viewAssistant.init(this);
		this.interactionAssistant.init(Doc.get(this.contentEl));

		El.Cls.add(this.viewAssistant.workspaceLeafEl, CssClass.View.WORKSPACE_LEAF_CONTENT_MODIFIER);
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

		El.Cls.remove(this.viewAssistant.workspaceLeafEl, CssClass.View.WORKSPACE_LEAF_CONTENT_MODIFIER);
		this.interactionAssistant.deinit();
		this.viewAssistant.deinit();
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

		const setState = state as State | null | undefined;
		Env.assert(setState !== undefined && setState !== null);
		if (setState === undefined || setState === null)
			return;

		const proceed = async () => {
			this.onSetState(setState, result);
			await this.render();
		};

		if (!this.didSetState) {
			this.didSetState = true;
			await proceed();
		} else if (Bln.isTrue(setState.forceUpdate)) {
			await proceed();
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
	protected onSetEphemeralState(state: unknown): void { }; // eslint-disable-line @typescript-eslint/no-unused-vars
	protected onGetEphemeralState(): Record<string, unknown> { return {}; };
	protected abstract onRender(): Promise<void>;

	protected onDataChanged(data: DataStoreRoot, out: { skipRender: boolean }): void { }; // eslint-disable-line @typescript-eslint/no-unused-vars
	protected onSettingsChanged(settings: PluginSettings, isExternal: boolean, out: { skipRender: boolean }): void { }; // eslint-disable-line @typescript-eslint/no-unused-vars

	protected get scrollPosition(): { top: number, left: number } {
		return {
			top: this.viewAssistant.scrollContainer.scrollTop, left: this.viewAssistant.scrollContainer.scrollLeft
		};
	}

	/** The call is asynchronous, i.e., the scroll position is not updated immediately. */
	protected setScrollPosition(options: BaseViewScrollToOptions) {
		Env.log.d("BaseView:setScrollPosition", options);
		this.interactionAssistant.nextScrollIsProgrammatic();
		this.viewAssistant.scrollContainer.scrollTo(options)
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
				doc: Doc.get(contentEl),
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
