/* eslint-disable no-undef, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- This file encapsulates all use of private Obsidian APIs. Should any type change, only this file needs to be updated. Any structural changes should be handled by the try/catch blocks.  */
import { Env } from "#/env";
import { Bln } from "#/utils/ts";
import { App, FuzzySuggestModal, KeymapEventListener, Scope, Vault } from "obsidian";

export class InternalApiError extends Error {
	public constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = "InternalApiError";
	}
}

type ErrorCallback = (e: InternalApiError) => void;

export const InternalApi = {

	/**
		* Add {@link listener} to the first currently configured keymap identified by {@link id}.
		* @returns `false` if no keymap for {@link id} was found.
		*/
	addEventHandlerToExistingKeyMap: (app: App, scope: Scope, id: string, listener: KeymapEventListener) => {
		try {
			// @ts-expect-error
			const manager = app.hotkeyManager;
			Env.dev?.assert(manager);

			const keys: {
				// @ts-expect-error
				modifiers: Modifier[];
				key: string;
			}[] = manager.customKeys[id] ?? manager.defaultKeys[id];

			if (keys.length === 0 || keys[0] === undefined)
				return false;

			scope.register(keys[0].modifiers, keys[0].key, listener);
			return true;
		}
		catch (e) {
			Env.log.e("Failed to add event handler to existing key map.", e);
			return false;
		}
	},

	reloadApp: (app: App) => {
		try {
			// @ts-expect-error
			app.commands.executeCommandById("app:reload");
		}
		catch (e) {
			Env.log.e("Failed to execute reload command.", e);
		}
	},

	getConfig: (vault: Vault, key: "autoFullScreen" | "floatingNavigation" | "showInlineTitle" | "showIndentGuide" | "rightToLeft" | "readableLineLength") => {
		try {
			// @ts-expect-error
			const value = vault.getConfig(key);
			return Bln.isTrue(value);
		}
		catch (e) {
			return new InternalApiError("Failed to get config: " + key, e);
		}
	},

	hideNav: (app: App, hide: boolean) => {
		try {
			if (hide)
				(app as any).mobileNavbar?.hideNavigation(); // eslint-disable-line @typescript-eslint/no-explicit-any
			else
				(app as any).mobileNavbar?.restoreNavigation(); // eslint-disable-line @typescript-eslint/no-explicit-any
		}
		catch (e) {
			Env.log.e("Failed to hide navigation.", e);
		}
	},

	Modal: {
		Fuzzy: {
			selectedItemIndex: <T>(m: FuzzySuggestModal<T>, onFail: ErrorCallback = (e) => Env.log.e(e)): number => {
				try {
					// @ts-expect-error
					return m.chooser.selectedItem as number;
				} catch (e) {
					onFail(new InternalApiError("Modal:Fuzzy: Failed to get selected item.", e));
					return 0;
				}
			},
			updateSuggestions: <T>(m: FuzzySuggestModal<T>, onFail: ErrorCallback = (e) => Env.log.e(e)): void => {
				try {
					// @ts-expect-error
					m.updateSuggestions();
				} catch (e) {
					onFail(new InternalApiError("Modal:Fuzzy: Failed to update suggestions.", e));
				}
			},
			setSelectedItem: <T>(m: FuzzySuggestModal<T>, index: number, evt?: MouseEvent | KeyboardEvent, onFail: ErrorCallback = (e) => Env.log.e(e)): void => {
				try {
					// @ts-expect-error
					m.chooser.setSelectedItem(index, evt);
				} catch (e) {
					onFail(new InternalApiError("Modal:Fuzzy: Failed to set selected item.", e));
				}
			},
		},
	},

};
