import { CollectionableAssistant } from "#/declarations/Collectionable";
import { Declarable } from "#/declarations/Declarable";
import { Obj } from "#/utils/ts";
import { parseYaml, stringifyYaml } from "obsidian";

/** Key types are constrained to string keys only. */
export type YamlObject = Record<string, unknown>;
export type YamlParseErrorCallback = (error: Error) => void;

export class DeclarationCodec {

	/**
		* - Case insensitive.
		* - Values of empty properties (e.g. `prop: `) are set to `null` by the YAML parser as `null` is a valid YAML value. `undefined` does not exist in YAML.
		*
		* @param yaml Will be converted to lower case before parsing.
		* @param onParseError
		* @returns `null` if YAML parsing failed, in which case {@link onParseError} will be invoked.
		*/
	public static tryFromYaml(yaml: string, onParseError?: YamlParseErrorCallback) {
		let parsedObject: YamlObject | null = null;

		try {
			const raw = parseYaml(yaml);

			if (Obj.is(raw)) {
				parsedObject = {};

				for (const [key, value] of Object.entries(raw)) {
					// - YAML allows keys to be e.g. numbers. Make sure they are strings.
					// - Also lowercase them to match property names in code (or camel cased)
					parsedObject[String(key).toLowerCase()] = value;
				}

				// If the value has white space, e.g. `prop:       `, `null` is still returned as YAML trims whitespace after the colon.
				// However, content inside quotes are preserverd. `prop: " "` will have the value of a string with a space.
				Obj.trimValues(parsedObject);
				CollectionableAssistant.fromUserFriendlyKeys(parsedObject);
			}
		} catch (error) {
			if (error instanceof Error && error.name === "YAMLParseError")
				onParseError?.(error);
			else
				throw error;
		}

		return parsedObject;
	}

	public static toYaml(declaration: Declarable): string {
		CollectionableAssistant.toUserFriendlyKeys(declaration);
		return stringifyYaml(declaration);
	}
}
