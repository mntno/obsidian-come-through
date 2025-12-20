import { Env } from "env";
import { UnsignedInteger } from "types";
import { Num } from "utils/ts";

export class ContentUnit {
	private pages: (HTMLDivElement | undefined)[];

	constructor(numberOfPages: number) {
		this.pages = new Array(numberOfPages).fill(undefined);
	}

	/**
		* @returns The index of the element that is attached or `null` if none is.
		*/
	public get currentIndex(): UnsignedInteger | null {
		let firstAttached: number | undefined;
		let numberOfAttached = 0;

		this.pages.forEach((element, index) => {
			if (element !== undefined && element.isConnected) {
				if (firstAttached === undefined)
					firstAttached = index;
				numberOfAttached += 1;
			}
		});

		Env.dev?.assert(numberOfAttached <= 1, "More than one item element is attached to the DOM.");
		return firstAttached !== undefined ? Num.UInt.create(firstAttached) : null;
	}

	public get isAtLastIndex() {
		if (this.pages.length === 0)
			return false;
		const p = this.pages[this.pages.length - 1];
		if (p === undefined)
			return false;
		return p.isConnected;
	}

	public get nextIndexUp() {
		const i = this.currentIndex;
		if (i === null)
			return null;
		return Num.UInt.create(i === this.pages.length - 1 ? 0 : i + 1);
	}

	public getPageAtIndex(index: UnsignedInteger): HTMLDivElement | null {
		return this.pages[index] ?? null;
	}

	private removePageAtIndex(index: UnsignedInteger) {
		const element = this.getPageAtIndex(index);
		if (element !== null) {
			element.remove();
			element.empty();
		}
		this.pages[index] = undefined;
	}

	public removeAllPages() {
		for (let i = 0; i < this.pages.length; i++)
			this.removePageAtIndex(Num.UInt.create(i));
	}

	public setPageAtIndex(index: UnsignedInteger, content: HTMLDivElement) {
		Env.dev?.assert(index < this.pages.length);
		this.pages[index] = content;
	}
}
