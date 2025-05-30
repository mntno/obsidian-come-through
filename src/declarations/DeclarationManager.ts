import { DataStore } from "DataStore";
import { CardDeclaration } from "declarations/CardDeclaration";
import { DeckableDeclarable, Declaration } from "declarations/Declaration";
import { DeclarationRenderChild } from "renderings/DeclarationRenderChild";
import { DeckModal } from "modals/DeckModal";
import { App, MarkdownPostProcessorContext, MarkdownSectionInformation, TFile, Vault } from "obsidian";

export class DeclarationManager {

	public static get supportedCodeBlockLanguages() {
		return Declaration.supportedCodeBlockLanguages;
	}

	public static async processCodeBlock(
		app: App,
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		data: DataStore) {

		const renderer = new DeclarationRenderChild(el, source, {
			getAllDecks: () => data.getAllDecks()
		});
		ctx.addChild(renderer);

		const handleChangedDeclaration = async (
			changedDeclaration: DeckableDeclarable,
			file: TFile) => {

			await this.processSection(
				app.vault,
				file,
				() => ctx.getSectionInfo(el),
				Declaration.toString(changedDeclaration)
			);
		}

		renderer.render((declaration, type, deckSelectEl) => {

			const file = app.vault.getFileByPath(ctx.sourcePath);
			console.assert(file);
			if (!file)
				return;

			if (type === "deckAdded") {
				DeckModal.add(app, data, async (addedDeck) => {

					// Add a new option for the created deck
					deckSelectEl.createEl("option", {
						text: addedDeck.data.n,
						value: addedDeck.id,
					}, (el) => {
						el.selected = true;
					});

					handleChangedDeclaration(
						CardDeclaration.copyWithDeck(declaration, addedDeck.id),
						file
					).catch(console.error);
				});
			}
			else if (type === "deckChanged") {

				const selectedDeckID = deckSelectEl.value ? deckSelectEl.value : null;
				if (selectedDeckID === declaration.deckID)
					return;

				handleChangedDeclaration(
					CardDeclaration.copyWithDeck(declaration, selectedDeckID),
					file
				).catch(console.error);
			}
		});
	}

	/**
	 * Overwrites the section returned from {@link getInfo} with {@link replacement}.
	 * @param vault
	 * @param file
	 * @param getInfo
	 * @param replacement
	 */
	private static async processSection(
		vault: Vault,
		file: TFile,
		getInfo: () => MarkdownSectionInformation | null,
		replacement: string) {

		await vault.process(file, (data) => {
			const info = getInfo();
			if (!info)
				return data;

			const startIndex = this.getIndexUpToLine(data, info.lineStart + 1);
			const endIndex = this.getIndexUpToLine(data, info.lineEnd);

			console.assert(startIndex >= 0);
			console.assert(endIndex >= 0);

			return data.slice(0, startIndex) + replacement + data.slice(endIndex);
		});
	}

	/**
	 *
	 * @param source String to search.
	 * @param lineNumber Line number to return the index for.
	 * @returns
	 */
	private static getIndexUpToLine(source: string, lineNumber: number): number {
		if (lineNumber === 0)
			return 0;

		let currentIndex = 0;
		let lineCount = 0;
		let previousNewlineIndex = -1;

		while (lineCount < lineNumber) {
			const newlineIndex = source.indexOf('\n', currentIndex);
			if (newlineIndex === -1)
				return -1;

			previousNewlineIndex = newlineIndex;
			currentIndex = newlineIndex + 1;
			lineCount++;
		}

		return previousNewlineIndex + 1;
	}
}
