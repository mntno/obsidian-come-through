import { App, KeymapEventListener, Scope } from "obsidian";

export class InternalApi {

	/**
		* Add {@link listener} to the first currently configured keymap identified by {@link id}.
		* @returns `false` if no keymap for {@link id} was found.
		*/
	public static addEventHandlerToExistingKeyMap(app: App, scope: Scope, id: string, listener: KeymapEventListener) {

		// @ts-ignore
		const manager = app.hotkeyManager;

		const keys: {
			// @ts-ignore
			modifiers: Modifier[];
			key: string;
		}[] = manager.customKeys[id] ?? manager.defaultKeys[id];

		if (keys.length > 0) {
			scope.register(keys[0].modifiers, keys[0].key, listener);
			return true;
		}
		else {
			return false;
		}
	}

	public static reloadApp(app: App) {
		// @ts-ignore
		app.commands.executeCommandById("app:reload");
	}
}
