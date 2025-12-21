const LANGUAGE = "comethrough";
const LANGUAGE_SHORT = "ct";

export const SUPPORTED_CODEBLOCK_LANGUAGES = [LANGUAGE, LANGUAGE_SHORT];

export const DeclarationConstants = {

	CodeBlock: {
		LANGUAGES: SUPPORTED_CODEBLOCK_LANGUAGES,
		isSupportedLanguage: (language: string) => SUPPORTED_CODEBLOCK_LANGUAGES.includes(language.toLowerCase()),
	} as const,

	Frontmatter: {
		KEYS: [LANGUAGE, LANGUAGE_SHORT, "come through"]
	} as const,

} as const;
