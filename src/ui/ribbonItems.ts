import { OpenModal } from "#/ui/modalActions";
import { UIContext } from "#/ui/types";
import { OpenView } from "#/ui/viewActions";
import { Api } from "#/utils/obs/api";

export type RibbonCallback = { icon: string; name: string; callback: (evt: MouseEvent) => void };

export const RibbonActions = {

	review: (ctx: UIContext): RibbonCallback => ({
		icon: ctx.icon.Action.REVIEW,
		name: ctx.ui.contextulize("Review"),
		callback: () => OpenModal.review(ctx.app, ctx.createDataProvider)
	}),

	collections: (ctx: UIContext): RibbonCallback => ({
		icon: ctx.icon.View.COLLECTIONS,
		name: ctx.ui.contextulize("Decks"),
		callback: (evt: MouseEvent) => OpenView.collections(ctx.app, Api.Event.paneType(evt))
	}),

};
