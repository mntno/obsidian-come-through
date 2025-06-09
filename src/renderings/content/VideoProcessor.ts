import { HtmlAttribute } from "renderings/dom-constants";
import { ContentRendererPostProcessor, ContentRendererProcessor, PostProcessorParameter } from "./ContentRendererProcessor";

export class VideoProcessor extends ContentRendererProcessor implements ContentRendererPostProcessor {
	public handleHtml(param: PostProcessorParameter): void {
		param.el.querySelectorAll("video").forEach(el => this.handleVideo(param, el));
	}

	private handleVideo(param: PostProcessorParameter, el: HTMLVideoElement) {
		this.setDefaults(el);
	}

	/**
		* Allows for video to be added by merely specifying the `src`: `<video src="https://externalvideo"></video>`
		*
		* - If you embed a internal video like this `![Local Video](LocalVideo.mp4)` in Obisidan, `controls` and `preload="metadata"` will be added when rendered.
		* - This means that there is no way to include a video without controls; all videos will have controls, which makes sense.
		* - `preload` can be overridden, e.g., `preload="auto"`.
		*/
	private setDefaults(el: HTMLVideoElement) {
		if (!el.hasAttribute(HtmlAttribute.MediaElement.Controls.NAME))
			el.setAttribute(HtmlAttribute.MediaElement.Controls.NAME, HtmlAttribute.MediaElement.Controls.Values.DISPLAY);

		if (!el.hasAttribute(HtmlAttribute.MediaElement.Preload.NAME))
			el.setAttribute(HtmlAttribute.MediaElement.Preload.NAME, HtmlAttribute.MediaElement.Preload.Values.METADATA);
	}
}
