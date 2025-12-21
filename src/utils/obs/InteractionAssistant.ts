import { Env } from "#/env";
import { El } from "#/utils/dom/dom";
import { CssClass } from "#/utils/obs/constants";
import { DomState } from "#/utils/obs/DomState";
import { InternalApi } from "#/utils/obs/internal";
import { ViewAssistant } from "#/utils/obs/ViewAssistant";
import { App, Component, debounce } from "obsidian";


export class InteractionAssistant {

	private component: Component;
	private viewAssistant: ViewAssistant;
	private doc: Document | undefined;
	private app: App;

	constructor(app: App, component: Component, viewAssistant: ViewAssistant) {
		this.app = app;
		this.component = component;
		this.viewAssistant = viewAssistant;
	}

	public init(doc: Document) {
		Env.assert(this.viewAssistant.isInitialized, `${ViewAssistant.name} must be initialized before ${InteractionAssistant.name}`);

		this.doc = doc;
		this.component.registerDomEvent(this.viewAssistant.scrollContainer, "scroll", this.onScroll);
		this.scroll.resetState();
		this.ui.isNavigationHidden = DomState.Interface.isNavigationHidden(this.docOrThrow);

		DomState.subscribe(this.onStateChange, [
			CssClass.Body.Setting.AUTO_FULL_SCREEN,
			CssClass.Body.Platform.IS_PHONE,
			CssClass.Body.Interface.IS_HIDDEN_NAV,
		]);
	}

	public get isInitialized(): boolean {
		return this.doc !== undefined;
	}

	public deinit() {
		DomState.unsubscribe(this.onStateChange);
		this.ui.showNavigation(true);
		this.doubleTap.clearMouseDownTimer();
		this.doc = undefined;
	}

	public registerDoubleClick(el: HTMLElement, onDoubleTap: () => void) {
		this.doubleTap.reg(el, onDoubleTap);
	}

	public nextScrollIsProgrammatic() {
		this.scroll.nextScrollIsProgrammatic = true;
	}

	private get docOrThrow() {
		if (this.doc === undefined)
			throw new Error(`${InteractionAssistant.name} not initiated.`);
		return this.doc;
	}

	private onStateChange = (added: string[], removed: string[]) => {

		if (added.includes(CssClass.Body.Setting.AUTO_FULL_SCREEN)) {
			this.scroll.previousScrollTop = 0;
			this.ui.isAutoFullScreenEnabled = true;
		}
		else if (removed.includes(CssClass.Body.Setting.AUTO_FULL_SCREEN)) {
			// Full screen disabled, make sure navigation is shown.
			this.ui.showNavigation(true);
			this.ui.isAutoFullScreenEnabled = false;
		}

		if (added.includes(CssClass.Body.Interface.IS_HIDDEN_NAV))
			this.ui.isNavigationHidden = true;
		else if (removed.includes(CssClass.Body.Interface.IS_HIDDEN_NAV))
			this.ui.isNavigationHidden = false;

		if (DomState.UserSetting.isAutoFullScreenEnabled) {
			// Make sure that navigation is shown intitally when screen size changes e.g. from tablet to phone.
			if (added.includes(CssClass.Body.Platform.IS_PHONE) || removed.includes(CssClass.Body.Platform.IS_PHONE))
				this.ui.showNavigation(true);
		}
	};

	private onScroll = () => {
		if (!this.isInitialized)
			return;

		this.scroll.on();
	}

	private readonly ui = {
		isAutoFullScreenEnabled: DomState.UserSetting.isAutoFullScreenEnabled,
		isNavigationHidden: false, // Needs doc. Set in init.

		showNavigation: (show: boolean) => {
			if (show === !this.ui.isNavigationHidden)
				return;

			try {
				// This will hide the status bar as well.
				InternalApi.hideNav(this.app, !show);
			}
			finally {
				// This is a fallback in case the above call fails. This hides the navigation controls but not the status bar.
				const isHidden = DomState.Interface.isNavigationHidden(this.docOrThrow); // The callback has not yet triggered, so we need to look at DOM directly.
				if (show && isHidden || !show && !isHidden)
					El.Cls.toggle(this.docOrThrow.body, CssClass.Body.Interface.IS_HIDDEN_NAV, !show);
			}
		}
	};

	private readonly scroll = {

		on() {
			if (this.nextScrollIsProgrammatic) {
				this.nextScrollIsProgrammatic = false;
				return;
			}

			this.onScroll();
		},

		onScroll: () => {
			if (this.ui.isAutoFullScreenEnabled) {

				/* Obsidians implementation:
					e.prototype.onScroll = function(e, t) {
						var n, i = null !== (n = this.scrollTops.get(e)) && void 0 !== n ? n : 0;
						if (this.scrollTops.set(e, t),
						Yl.isPhone && !Yl.mobileSoftKeyboardVisible && this.app.vault.getConfig("autoFullScreen")) {
								var r = t - i;
								t < .1 && i < .1 || Math.abs(r) < .125 || (r > 0 ? this.hideNavigation() : this.restoreNavigation())
						}
					}
			 */

				const maxScroll = this.viewAssistant.scrollContainer.scrollHeight - this.viewAssistant.scrollContainer.clientHeight;
				const currentScrollTop = Math.min(Math.max(0, this.viewAssistant.scrollContainer.scrollTop), maxScroll);
				const delta = currentScrollTop - this.scroll.previousScrollTop;
				const previousScrollTop = this.scroll.previousScrollTop;
				this.scroll.previousScrollTop = currentScrollTop;

				// 0.125 is probably just guarding against floating point values that are technically non-zero but represent no real movement.
				if (!(currentScrollTop < 0.1 && previousScrollTop < 0.1) && Math.abs(delta) >= 0.125)
					this.ui.showNavigation(delta <= 0);
			}
			else {
				this.ui.showNavigation(true);
			}
		},

		handleScrollDebounced: debounce(() => {
			this.scroll.onScroll();
		}, 50, true),

		previousScrollTop: 0,

		/** Used when a scroll event will be triggered programmatically to disable scroll handling temporarily. */
		nextScrollIsProgrammatic: false,

		resetState() {
			this.previousScrollTop = 0;
			this.nextScrollIsProgrammatic = false;
		},
	};


	/**
		* Obsidian adds code so that navigation is restored when user taps once.
		* This method catches the `mousedown` event and stops its propagation if navigation is hidden.
		* It then re-dispatches the event after a short delay if no double tap occurred.
		*/
	private readonly doubleTap = {

		reg: (el: HTMLElement, onDoubleTap: () => void) => {
			/*
			Obsidian adds this code so that navigation is restored when user taps once.
			```
			 window.addEventListener("mousedown", (function() {
					return t.restoreNavigation(!0)
				}
			```
			Catch it before it propagates to the window.
			*/
			this.component.registerDomEvent(el, 'mousedown', (e) => {
				if (DomState.Interface.isNavigationHidden(this.docOrThrow)) {
					e.stopPropagation();
					this.doubleTap.dispatchMouseDown(e);
				}
			});

			this.component.registerDomEvent(el, "dblclick", () => {
				this.doubleTap.clearMouseDownTimer();
				onDoubleTap();
			});
		},

		dispatchMouseDown: (e: MouseEvent) => {
			this.doubleTap.clearMouseDownTimer();

			const win = this.docOrThrow.win;
			this.doubleTap.mouseDownTimer = win.setTimeout(() => {
				this.doubleTap.mouseDownTimer = null;
				win.dispatchEvent(new MouseEvent('mousedown', e));
			}, 300);

		},

		clearMouseDownTimer: () => {
			if (this.doubleTap.mouseDownTimer !== null) {
				this.docOrThrow.win.clearTimeout(this.doubleTap.mouseDownTimer);
				this.doubleTap.mouseDownTimer = null;
			}
		},

		mouseDownTimer: null as number | null,
	};
}
