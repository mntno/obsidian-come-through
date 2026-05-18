import { El } from "#/utils/obs/dom";
import { CssClass } from "#/utils/obs/constants";
import { Arr, Str } from "#/utils/ts";
import { Plugin } from "obsidian";

type SettingsChangeCallback = (added: string[], removed: string[]) => void;

interface Subscriber {
	callback: SettingsChangeCallback;
	classes: string[] | null;
}

/** `app.workspace.on("css-change", cb…)` seem to only be called on theme change. */
export class DomState {
	private static observer: MutationObserver | null = null;
	private static subscribers: Subscriber[] = [];
	private static doc: Document | undefined;

	/**
		* Call from `onload` of the plugin.
		* @param plugin
		* @param doc Document of the main window.
		*/
	public static init(plugin: Plugin, doc: Document) {
		DomState.doc = doc;
		plugin.register(() => DomState.unobserve());
	}

	public static deinit() {
		Arr.clear(DomState.subscribers);
		DomState.unobserve();
		DomState.doc = undefined;
	}

	public static subscribe(callback: SettingsChangeCallback, classes: string[] | null = null) {
		DomState.subscribers.push({ callback, classes });
		if (DomState.subscribers.length === 1)
			DomState.observe();
	}

	public static unsubscribe(callback: SettingsChangeCallback) {
		DomState.subscribers = DomState.subscribers.filter(s => s.callback !== callback);
		if (DomState.subscribers.length === 0)
			DomState.unobserve();
	}

	private static observe() {
		const doc = DomState.docOrThrow;

		DomState.observer = new MutationObserver(DomState.onMutation);
		DomState.observer.observe(doc.body, { attributeFilter: ["class"], attributeOldValue: true });
	}

	private static onMutation = (mutations: MutationRecord[]) => {
		const doc = DomState.docOrThrow;

		for (const mutation of mutations) {
			const oldClasses = new Set((mutation.oldValue ?? Str.EMPTY).split(Str.SPACE).filter(Boolean));
			const newClasses = new Set(doc.body.className.split(Str.SPACE).filter(Boolean));

			const added = [...newClasses].filter(c => !oldClasses.has(c));
			const removed = [...oldClasses].filter(c => !newClasses.has(c));

			if (added.length === 0 && removed.length === 0)
				continue;

			for (const subscriber of DomState.subscribers) {
				if (subscriber.classes === null) {
					subscriber.callback(added, removed);
				} else {
					const filteredAdded = added.filter(c => subscriber.classes!.includes(c));
					const filteredRemoved = removed.filter(c => subscriber.classes!.includes(c));
					if (filteredAdded.length > 0 || filteredRemoved.length > 0) {
						subscriber.callback(filteredAdded, filteredRemoved);
					}
				}
			}
		}
	}

	private static unobserve() {
		DomState.observer?.disconnect();
		DomState.observer = null;
	}

	private static get docOrThrow() {
		if (DomState.doc === undefined)
			throw new Error(`${DomState.name} not initiated.`);
		return DomState.doc;
	}

	public static readonly UserSetting = {
		/** See also {@link InternalApi.getConfig} */
		get isAutoFullScreenEnabled(): boolean {
			return El.Cls.has(DomState.docOrThrow.body, CssClass.Body.Setting.AUTO_FULL_SCREEN);
		},
	} as const ;

	public static readonly Interface = {
		isNavigationHidden(doc: Document | undefined = DomState.docOrThrow): boolean {
			return El.Cls.has(doc.body, CssClass.Body.Interface.IS_HIDDEN_NAV);
		},
	} as const ;
}
