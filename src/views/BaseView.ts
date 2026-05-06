import { CssClass } from "#/constants";
import { DataStore, DataStoreRoot } from "#/data/DataStore";
import { Env } from "#/env";
import { ContentRenderer, createRenderConfig } from "#/renderings/content/ContentRenderer";
import { PluginSettings, SettingsChanged, SettingsManager } from "#/Settings";
import { OmitIndexSignature } from "#/types";
import { Icon } from "#/ui/constants";
import { Doc, El } from "#/utils/dom/dom";
import { ElementCreator } from "#/utils/ElementCreator";
import { Api } from "#/utils/obs/api";
import { InteractionAssistant } from "#/utils/obs/InteractionAssistant";
import { ViewAssistant } from "#/utils/obs/ViewAssistant";
import { Bln, Obj } from "#/utils/ts";
import { MouseKeyboardEvent } from "#/utils/types";
import { App, IconName, ItemView, Menu, Scope, ViewStateResult, WorkspaceLeaf } from "obsidian";

export interface BaseViewState {
	/**
	 * - "init": Only set when the state is created explicitly by the plugin. Use {@linkcode BaseView.withDefaultViewState}.
	 * - "forceUpdate": {@link BaseView.prototype.setState} only forwards the state to subclasses once unless this is set. Therefore, set this to render based on a new state in an already opened view.
	 */
	reason?: "init" | "forceUpdate";

	[key: string]: unknown;
}

export interface BaseViewEphemeralState {
	[key: string]: unknown;
}

const NEW_STATE: OmitIndexSignature<BaseViewState> = {
	reason: "init",
} as const;

export type BaseViewOptionalParameters = {
	readonly data?: DataStore;
	readonly paneMenu?: PaneMenuOptions;
	readonly scope?: ScopeOptions;
};

export interface PaneMenuOptions {
	/** Set to `true` to add a reload item and a shortcut or to a callback to handle the reload event. Return `true` from the callback to prevent the default reload behavior. */
	addReloadItem?: boolean | ((evt: MouseKeyboardEvent) => unknown);
}

export interface ScopeOptions {
	disable?: boolean;
	register?: (app: App, scope: Scope) => void;
}

export interface BaseViewScrollToOptions extends ScrollToOptions { // eslint-disable-line @typescript-eslint/no-empty-object-type
}

export abstract class BaseView<State extends BaseViewState> extends ItemView {

	protected static withDefaultViewState<T extends BaseViewState>(state: T): T {
		return {
			...state,
			...NEW_STATE, // Put last to makes sure defaults are not overridden
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

		this.navigation = true; // Default to true, subclasses can override

		if (!Bln.isTrue(this.options?.scope?.disable)) {
			this.scope = new Scope(this.app.scope);

			// Register reload shortcut if a reload menu item is used.
			const menuOptions = this.options?.paneMenu;
			if (menuOptions !== undefined && (Bln.isTrue(menuOptions.addReloadItem) || menuOptions.addReloadItem !== undefined))
				this.scope.register(["Mod"], "R", (evt, _ctx) => this.onReloadEvent(evt));

			const scopeOptions = this.options?.scope;
			scopeOptions?.register?.(this.app, this.scope);
		}
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
		this.interactionAssistant.init(Doc.from(this.contentEl));

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

	public override onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | (string & {})): void {
		Env.log.view("BaseView:onPaneMenu", source);
		super.onPaneMenu(menu, source);

		if (this.options?.paneMenu === undefined)
			return;

		const options = this.options.paneMenu;

		if (source === Api.Menu.Source.MoreOptions || source === Api.Menu.Source.TabHeader) {
			if (Bln.isTrue(options.addReloadItem) || options.addReloadItem !== undefined) {
				menu.addItem(item => {
					item.setTitle("Reload");
					item.setSection(Api.Menu.Section.View);
					item.setIcon(Icon.Action.RELOAD);
					item.onClick(this.onReloadEvent);
				});
			}
		}
	}

	/** Defines the fundamental configuration needed to recreate the view's essential content and layout. */
	public override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		Env.log.d("BaseView:setState:", state);
		await super.setState(state, result);

		Env.assert(Obj.is(state));
		if (!Obj.is(state))
			return;

		const setState = state as State;

		const proceed = async (s: State) => {
			this.onSetState(s, result);
			await this.render();
		};

		// Either the constructor was just called or a new state was explicitly created by plugin without the instance being created.
		if (this.didInstantiate || setState.reason === "init") {
			this.didInstantiate = false;
			await proceed(setState);
		} else if (setState.reason === "forceUpdate") {
			await proceed(setState);
		}
	}
	/** `true` from the time of instantiation until {@link setState} is called for the first time. */
	private didInstantiate: boolean = true;

	public override getState(): BaseViewState {
		Env.log.d("BaseView:getState");
		return {
			...super.getState(),
			...this.onGetState(),
			...{
				reason: undefined
			} satisfies OmitIndexSignature<BaseViewState>
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

	protected reload(evt: MouseKeyboardEvent) {
		this.onReloadEvent(evt);
	}

	private onReloadEvent = (evt: MouseKeyboardEvent) => {
		const pmo = this.options?.paneMenu;
		if (pmo === undefined || pmo.addReloadItem === undefined)
			return;

		if (Bln.is(pmo.addReloadItem)) {
			// Check boolean first so `false` is handled correctly.
			if (pmo.addReloadItem)
				this.render().catch(Env.catch);
		}
		else {
			if (!pmo.addReloadItem(evt))
				this.render().catch(Env.catch);
		}
	};

	/**
		* This will explicitly tell the WorkspaceLeaf to update its view state, which includes re-evaluating getDisplayText() and updating the tab header with the new file path.
		* However, the title in the "tab title bar" is not updated.
		*
		* @param type
		* @param forceUpdate Set to `true` to force a re-render even if the state has not changed.
		* @param state Optional state to set. If not provided, the current state will fetched.
		*/
	protected async reinitiate(type: string, forceUpdate: boolean, state?: BaseViewState) {
		const s = {
			...(state ?? this.getState()),
			...{
				reason: forceUpdate ? "forceUpdate" : undefined
			} satisfies OmitIndexSignature<BaseViewState>
		};

		await this.leaf.setViewState({ type, state: s });
	}

	/**
		* Recycles/clears/resets everything and invokes {@link onRender}.
		*
		* Subclasses should call this method to build or rebuild the view.
		*
		* @async Await to operate after the view has been rendered.
		*/
	protected render = async () => {
		Env.log.d("BaseView:render");
		this.contentRenderer.recycle();
		this.viewAssistant.empty();

		await this.onRender();
		this.viewAssistant.adjustAvailableVerticalScrolling();
	};

	/** Invoked when the system supplies the state. Save it if needed. Only called once per state unless {@link reinitiate} is called with the force update param, in which case {@link BaseViewState.reason} will be set accordingly. */
	protected abstract onSetState(state: State, result: ViewStateResult): void;
	/** Supply the state to the system. */
	protected abstract onGetState(): State;
	protected onSetEphemeralState(state: unknown): void { }; // eslint-disable-line @typescript-eslint/no-unused-vars -- Empty protected method
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
				doc: Doc.from(contentEl),
			};
		}
		return this.domFacade;
	}
}

type BaseViewDomFacade = {
	/** The root HTML element for the view's content. */
	readonly contentEl: HTMLElement,
	/** Use to create new DOM elements within the view's content element. */
	readonly create: ElementCreator,
	/** The document associated with the view's content element. */
	readonly doc: Document,
};
