import { DataStore } from "#/data/DataStore";
import { DeckID } from "#/data/FullID";
import { CollectionableAssistant, DeckableDeclarable } from "#/declarations/Collectionable";
import { DeclarationConstants } from "#/declarations/constants";
import { DeclarationCodec } from "#/declarations/DeclarationCodec";
import { Env } from "#/env";
import { DeckModal } from "#/modals/DeckModal";
import { DeclarationRenderChild } from "#/renderings/declarations/DeclarationRenderChild";
import { HtmlTag } from "#/utils/dom/constants";
import { App, MarkdownPostProcessorContext, MarkdownSectionInformation, TFile, Vault } from "obsidian";

/**
	* - Delegates the rendering of declarations.
	* - Handles user interaction with the rendered components.
	* - Modifies the file if necessary as a result of changes made by the user.
	*/
export class DeclarationManager {

	public static get supportedCodeBlockLanguages() {
		return DeclarationConstants.CodeBlock.LANGUAGES;
	}

	public static async processCodeBlock(
		app: App,
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		data: DataStore) {

		const renderer = new DeclarationRenderChild(el, source, {
			getAllDecks: () => data.getAllDecks(),
			getDeck: (id: DeckID) => data.getDeck(id),
		});
		ctx.addChild(renderer); // The MarkdownPostProcessorContext manage unload, e.g., when file is closed.

		const handleChangedDeclaration = async (
			changedDeclaration: DeckableDeclarable,
			file: TFile) => {

			await this.processSection(
				app.vault,
				file,
				() => ctx.getSectionInfo(el),
				DeclarationCodec.toYaml(changedDeclaration)
			);
		}

		renderer.render((declaration, type, deckSelectEl) => {

			const file = app.vault.getFileByPath(ctx.sourcePath);
			Env.assert(file !== null);
			if (!file)
				return;

			switch (type) {
				case "deckAdded": {
					DeckModal.add(app, data, (addedDeck) => {

						// Add a new option for the created deck
						deckSelectEl.createEl(HtmlTag.SELECT.OPTION.NAME, {
							text: addedDeck.data.n,
							value: addedDeck.id,
						}, (el) => {
							HtmlTag.SELECT.OPTION.select(el);
						});

						handleChangedDeclaration(
							CollectionableAssistant.copyWithDeck(declaration, addedDeck.id),
							file
						).catch(console.error);
					});

					break;
				}
				case "deckChanged": {
					const selectedDeckID = HtmlTag.SELECT.OPTION.isNone(deckSelectEl.value) ? null : deckSelectEl.value;
					if (selectedDeckID === declaration.deckID)
						return;

					handleChangedDeclaration(
						CollectionableAssistant.copyWithDeck(declaration, selectedDeckID),
						file
					).catch(console.error);

					break;
				}
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

			Env.assert(startIndex >= 0);
			Env.assert(endIndex >= 0);

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
