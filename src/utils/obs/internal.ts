import { Env } from "env";
import { App, KeymapEventListener, Scope } from "obsidian";

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

} as const;
