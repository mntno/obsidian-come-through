import { ContentRendererPostProcessor, ContentRendererProcessor, PostProcessorParameter } from "renderings/content/ContentRendererProcessor";
import { UnexpectedUndefinedError } from "utils/errors";

export class HeadingProcessor extends ContentRendererProcessor implements ContentRendererPostProcessor {
	private readonly baseHeadingLevel: number;
	private readonly allowNonConsecutiveLevels: boolean;

	public constructor(baseHeadingLevel: number, allowNonConsecutiveLevels: boolean = false) {
		super();

		this.baseHeadingLevel = baseHeadingLevel;
		this.allowNonConsecutiveLevels = allowNonConsecutiveLevels;
	}

	public handleHtml(param: PostProcessorParameter) {
		HeadingProcessor.normalize(param, this.baseHeadingLevel, this.allowNonConsecutiveLevels)
	}

	/**
	 * Normalizes the heading levels within the provided HTML element.
	 * It identifies the highest heading level (e.g., h1, h2) present in the element
	 * and adjusts all headings to ensure they are relative to the `baseHeadingLevel`
	 * set in the constructor, keeping them within the h1-h6 range.
	 * @param param The parameter object containing the HTML element to process.
	 * @param baseHeadingLevel The base heading level to normalize against.
	 * @param allowNonConsecutiveLevels If true, allows non-consecutive heading levels. If false (default), enforces consecutive levels.
	 */
	private static normalize(param: PostProcessorParameter, baseHeadingLevel: number, allowNonConsecutiveLevels: boolean) {

		let highestLevel = 0;
		for (let i = 1; i <= 6; i++) {
			if (param.el.querySelector(`h${i}`)) {
				highestLevel = i;
				break;
			}
		}

		if (highestLevel === 0) {
			return; // No headings to process
		}

		const offset = baseHeadingLevel - highestLevel;
		const headings = Array.from(param.el.querySelectorAll('h1, h2, h3, h4, h5, h6'));

		let lastAdjustedLevel = 0; // To track the level of the previous heading after adjustment

		headings.forEach(heading => {
			const currentLevel = parseInt(heading.tagName.substring(1), 10);

			// First, apply the baseHeadingLevel normalization
			let targetLevel = Math.max(1, Math.min(6, currentLevel + offset));

			// Then, if consecutiveLevels is true, enforce consecutiveness
			if (!allowNonConsecutiveLevels) {
				if (lastAdjustedLevel === 0) {
					// This is the first heading, its targetLevel is its adjusted level
					lastAdjustedLevel = targetLevel;
				} else {
					// Ensure current heading is at most 1 level deeper than the previous adjusted heading
					targetLevel = Math.min(targetLevel, lastAdjustedLevel + 1);
					lastAdjustedLevel = targetLevel;
				}
			}

			if (currentLevel === targetLevel) {
				return;
			}

			const newHeading = document.createElement(`h${targetLevel}`);

			// Copy attributes
			for (let i = 0; i < heading.attributes.length; i++) {
				const attr = heading.attributes[i];
				if (attr === undefined)
					throw new UnexpectedUndefinedError();
				newHeading.setAttribute(attr.name, attr.value);
			}

			// Move children
			while (heading.firstChild) {
				newHeading.appendChild(heading.firstChild);
			}

			// Replace old heading with new one
			heading.parentNode?.replaceChild(newHeading, heading);
		});
	}
}
