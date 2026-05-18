import { DataProvider } from "#/data/DataProvider";
import { Env } from "#/env";
import { Api } from "#/utils/obs/api";
import { InternalApi } from "#/utils/obs/internal";
import { Arr, St, Str } from "#/utils/ts";
import { App, FuzzyMatch, FuzzySuggestModal, TFile, TFolder } from "obsidian";

export type Item =
	| { type: "custom", text: string }
	| { type: "file", file: TFile }
	| { type: "tag", tag: string, display: string }
	| { type: "folder", folder: TFolder };

type ItemType = Item["type"];

export class ReviewModal extends FuzzySuggestModal<Item> {
	private readonly dataProvider: DataProvider;
	private state: ItemType;
	private lastSelectedIndex: number[] = [];

	private custom: { type: "custom", text: string }[] = [];
	private folders: { type: "folder", folder: TFolder }[] = [];
	private files: { type: "file", file: TFile }[] = [];
	private tags: { type: "tag", tag: string, display: string }[] = [];

	private bypassCloseIntercept = false;

	private readonly onChoose: (item: Item, dataProvider: DataProvider, evt: MouseEvent | KeyboardEvent) => void;

	constructor(app: App, dataProvider: DataProvider, onChoose: (item: Item, dataProvider: DataProvider, evt: MouseEvent | KeyboardEvent) => void) {
		super(app);
		this.dataProvider = dataProvider;
		this.state = "custom";
		this.custom = [
			{ type: "custom", text: "All" },
			{ type: "custom", text: "Deck" },
			{ type: "custom", text: "Folder" },
			{ type: "custom", text: "File" },
			{ type: "custom", text: "Tag" }
		];
		this.onChoose = onChoose;
		this.refreshState();
	}

	public override close() {
		if (this.state === "custom" || this.bypassCloseIntercept) {
			super.close();
		} else {
			Env.assert(this.lastSelectedIndex.length === 1, "Only one level of depth implemented.");
			if (this.lastSelectedIndex.length === 1)
				this.state = "custom";

			InternalApi.Modal.Fuzzy.updateSuggestions(this);
			InternalApi.Modal.Fuzzy.setSelectedItem(this, this.lastSelectedIndex.pop() ?? 0);
			this.refreshState();
		}
	}

	public override selectSuggestion(match: FuzzyMatch<Item>, evt: MouseEvent | KeyboardEvent) {
		Env.log.ui("selectSuggestion", match.item);

		if (this.itemSelected(match.item)) {
			this.bypassCloseIntercept = true;
			super.selectSuggestion(match, evt);
		}
		else {
			this.lastSelectedIndex.push(InternalApi.Modal.Fuzzy.selectedItemIndex(this))
			this.refreshState();
			InternalApi.Modal.Fuzzy.updateSuggestions(this);

			evt.preventDefault();
			evt.stopPropagation();
		}
	}

	public onChooseItem(item: Item, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(item, this.dataProvider, evt);
	}

	public getItems(): Item[] {
		Env.log.ui("getItems", this.state);
		switch (this.state) {
			case "custom":
				return this.custom;
			case "folder":
				return this.folders;
			case "file":
				return this.files;
			case "tag":
				return this.tags;
		}
	}

	public getItemText(item: Item): string {
		Env.log.ui("getItemText", item);
		switch (item.type) {
			case "custom":
				return `${item.text}`;
			case "folder":
				return `${item.folder.path}`;
			case "file":
				return `${item.file.basename}`;
			case "tag":
				return `${item.tag}`;
		}
	}

	public override renderSuggestion(match: FuzzyMatch<Item>, el: HTMLElement) {
		Env.log.ui("renderSuggestion", match.item);
		const item = match.item;

		el.empty();

		switch (item.type) {
			case "custom":
				el.createDiv({ text: `${item.text}` });
				break;
			case "folder":
				el.createDiv({ text: `${item.folder.path}` });
				break;
			case "file":
				el.createDiv({ text: `${item.file.basename}` });
				el.createEl("small", {
					text: item.file.path,
				});
				break;
			case "tag":
				el.createDiv({ text: `${item.display}` });
				break;
		}
	}

	private refreshState() {
		const config = {
			custom: { t: "Review", p: "Choose what to review" },
			folder: { t: "Folders", p: "Select folder" },
			file: { t: "Files", p: "Select file" },
			tag: { t: "Tags", p: "Select tag" },
		}[this.state];

		this.setTitle(config.t);
		this.setPlaceholder(Arr.isEmpty(this.getItems()) ? "No " + this.state + "s with review content" : config.p);
		this.inputEl.value = Str.EMPTY;
	}

	private itemSelected(item: Item) {
		switch (item.type) {
			case "custom": {

				if (item.text === "All")
					return true;

				if (item.text === "Deck")
					return true;

				if (item.text === "Folder") {
					this.state = "folder";
					this.folders = St.toArr(new Set(this.dataProvider.note.all()
						.map(path => Api.File.get(this.app.vault, path))
						.map(file => file?.parent?.path)
						.filter(f => f !== undefined)
					)).map(path => Api.Folder.get(this.app.vault, path))
						.filter(f => f !== null)
						.map(folder => ({ type: "folder", folder }));
				}

				if (item.text === "File") {
					this.state = "file";
					this.files = this.dataProvider.note.all()
						.map(path => Api.File.get(this.app.vault, path))
						.filter(f => f !== null)
						.map(file => ({ type: "file", file }));
				}

				if (item.text === "Tag") {
					this.state = "tag";
					this.tags = St.toArr(Api.Tag.fromFrontmatter(
						this.app.metadataCache, this.dataProvider.note.all()
							.map(path => Api.File.get(this.app.vault, path))
							.filter(f => f !== null)))
						.map(tag => ({ type: "tag", tag: tag, display: Api.Tag.toDisplay(tag) }));
				}

				break;
			}
			case "file":
			case "tag":
			case "folder":
				return true;
		}
		return false;
	}
}
