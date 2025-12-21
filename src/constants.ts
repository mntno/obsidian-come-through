import { CssClass as ObsCssClass } from "utils/obs/constants";

const CSS_PREFIX = "come-through-";

export const CssClass = {
	PREFIX: CSS_PREFIX,
	View: {
		WORKSPACE_LEAF_CONTENT_MODIFIER: CSS_PREFIX + ObsCssClass.Workspace.LEAF_CONTENT_MODIFIER,
	} as const,

	Modal: {
		CONTENT: CSS_PREFIX + "modal-content",
	} as const,
} as const;
