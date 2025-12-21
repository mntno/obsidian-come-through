import { Env } from "#/env";
import { Bln } from "#/utils/ts";
import { App, KeymapEventListener, Scope, Vault } from "obsidian";

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

	getConfig: (vault: Vault, key: "autoFullScreen" | "floatingNavigation" | "showInlineTitle" | "showIndentGuide" | "rightToLeft") => {
		try {
			// @ts-expect-error
			const value = vault.getConfig(key);
			return Bln.isTrue(value);
		}
		catch (e) {
			Env.log.e("Failed to get config.", e, key);
			return false;
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
	}

} as const;
