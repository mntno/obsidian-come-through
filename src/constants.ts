import { CssClass as ObsCssClass } from "utils/obs/constants";

const CSS_PREFIX = "come-through-";
const VAR_PREFIX = "--ct-";

export const CssClass = {
	PREFIX: CSS_PREFIX,
	View: {
		WORKSPACE_LEAF_CONTENT_MODIFIER: CSS_PREFIX + ObsCssClass.Workspace.LEAF_CONTENT_MODIFIER,

		Var: {
			SCROLL_PADDING: VAR_PREFIX + "scroll-padding",
			SCROLL_MIN_HEIGHT: VAR_PREFIX + "scroll-min-height",
		} as const,

		Review: {
			Var: {
				RATING_BUTTON_WIDTH: VAR_PREFIX + "rating-button-width",
			} as const,
		} as const,

	} as const,

	Modal: {
		CONTENT: CSS_PREFIX + "modal-content",
	} as const,
} as const;
