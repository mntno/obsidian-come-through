export const PLUGIN_NAME = "Come Through";
export const PLUGIN_MENY_SECTION = "come-through";

export const Icon = {
	PLUGIN: "drill",

	CARD_FRONT: "file-output",
	CARD_BACK: "file-input",
	MORE: "ellipsis-vertical", // "circle-ellipsis",

	Action: {
		ADD: "plus",
		RELOAD: "refresh-cw",
		REVIEW: "drill",
		EDIT: "pencil",
		DELETE: "trash",
		COPY: "copy",
	} as const,

	View: {
		COLLECTIONS: "layers", // library, file-stack, list, square-stack, folders, layers, layout-grid
		DEFINED_CONTENT: "table-of-contents", // "eye"
		REVIEW: "drill",
	} as const,

} as const;
