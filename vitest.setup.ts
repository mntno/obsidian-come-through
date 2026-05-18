import { vi } from "vitest";

vi.mock("obsidian", () => ({
	Component: class {
		addChild() {}
		registerDomEvent() {}
		registerInterval() {}
		register() {}
		load() {}
		unload() {}
		onload() {}
		onunload() {}
	},
	Platform: { isMobile: false, isDesktop: true },
}));
