// https://typescript-eslint.io/packages/typescript-eslint#usage
import eslint from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig } from 'eslint/config';
import globals from "globals";
import tseslint from "typescript-eslint";

// If using Svelte
// import sveltePlugin from "eslint-plugin-svelte";
// import svelteParser from "svelte-eslint-parser";

export default defineConfig(
	{
		ignores: [
			"**/dev-vault/**",
			"**/dist/**"
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended, // https://typescript-eslint.io/users/configs#recommended-configurations
	...obsidianmd.configs.recommended,
	{
		// Fix: Turn off rules for config files or scripts that cause this error when linting:
		// Error: Error while loading rule 'X':
		// 	You have used a rule which requires type information, but don't have parserOptions set to generate type information for this file.
		// See https://tseslint.com/typed-linting for enabling linting with type information.
		// Parser: typescript-eslint/parser
		// Occurred while linting /…/esbuild.config.mjs (eslint.config.js, tsconfig.json)
		files: ["*.js", "*.json", "*.mjs"],
		rules: {
			"@typescript-eslint/no-deprecated": "off",
			"@typescript-eslint/no-unused-expressions": "off",
			"obsidianmd/no-plugin-as-component": "off",
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: {
			"@typescript-eslint": tseslint.plugin, // https://typescript-eslint.io/packages/typescript-eslint#manual-usage
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				sourceType: "module",
				ecmaVersion: 2022,
			},
			globals: {
				...globals.browser,
				...globals.node,
			}
		},
		rules: {
			"no-param-reassign": ["warn", { "props": false }],

			// You should always have "no-unused-vars": "off" alongside @typescript-eslint/no-unused-vars,
			// https://typescript-eslint.io/rules/no-unused-vars/
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				"args": "all",
				"argsIgnorePattern": "^_",
				"caughtErrors": "all",
				"caughtErrorsIgnorePattern": "^_",
				"destructuredArrayIgnorePattern": "^_",
				"varsIgnorePattern": "^_",
				"ignoreRestSiblings": true,
			}],

			//
			"@typescript-eslint/ban-ts-comment": ["error", {
				"ts-expect-error": false,
				"ts-ignore": true,
				"ts-nocheck": true,
				"ts-check": true,
			}],

			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-unnecessary-condition": ["warn", {
				// https://typescript-eslint.io/rules/no-unnecessary-condition/#only-allowed-literals
				"allowConstantLoopConditions": "only-allowed-literals"
			}],
			"@typescript-eslint/switch-exhaustiveness-check": "error",

			"obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Obsidian"],
					acronyms: ["FSRS"],
					ignoreWords: [
						"Review",
						"Learning",
						"New",
						"Relearning",
						"Again",
						"Hard",
						"Good",
						"Easy",
					],
					enforceCamelCaseLower: false,
          mode: "strict",
        },
      ],
		},
	},
);
