import { DataProviderCreator } from "#/data/DataProvider";
import { SettingsManager } from "#/Settings";
import { EditorCommand } from "#/ui/commands/editor";
import { MarkdownViewCommand } from "#/ui/commands/markdownView";
import { OpenViewCommand } from "#/ui/commands/openView";
import { ReviewViewCommand } from "#/ui/commands/reviewView";
import { Icon } from "#/ui/constants";
import { MenuActions } from "#/ui/menuActions";
import { RibbonActions, RibbonCallback } from "#/ui/ribbonItems";
import { UIContext } from "#/ui/types";
import { Str } from "#/utils/ts";
import { App, Command, Component, MarkdownView, Menu, MenuItem, Notice } from "obsidian";

export class UIAssistant {

	private settingsManager: SettingsManager;
	private dataProvider: DataProviderCreator;

	constructor(settingsManager: SettingsManager, dataProvider: DataProviderCreator) {
		this.settingsManager = settingsManager;
		this.dataProvider = dataProvider;
	}

	public readonly actions = {

		getCommands: (app: App): Command[] => {
			const commands: Command[] = [];

			commands.push(OpenViewCommand.reviewCollection(app, this.dataProvider));
			commands.push(OpenViewCommand.collections(app));
			commands.push(OpenViewCommand.review(app, this.dataProvider));

			commands.push(MarkdownViewCommand.content(app, this.dataProvider));
			commands.push(MarkdownViewCommand.review(app, this.dataProvider));

			for (const command of ReviewViewCommand.setSortOrder(app))
				commands.push(command);
			for (const command of ReviewViewCommand.rate(app))
				commands.push(command);
			commands.push(ReviewViewCommand.showInfoModal(app));
			commands.push(ReviewViewCommand.toggleInlineInfo(app));
			commands.push(ReviewViewCommand.navigateToSourceFile(app));

			commands.push(EditorCommand.generateId());
			commands.push(EditorCommand.insertReviewUnit(false));
			commands.push(EditorCommand.insertReviewUnit(true));

			return commands;
		},

		getRibbonItems: (app: App): RibbonCallback[] => {
			const ctx: UIContext = this.createContext(app);
			const items: RibbonCallback[] = [];

			items.push(RibbonActions.review(ctx));
			//items.push(RibbonActions.collections(ctx));

			return items;
		},

		registerEvents: (app: App, component: Component) => {

			const ctx: UIContext = this.createContext(app);

			const bind = <T extends unknown[]>(fn: (ctx: UIContext, ...args: T) => void) =>
				(...args: T) => fn(ctx, ...args);

			component.registerEvent(app.workspace.on("editor-menu", bind(MenuActions.editorMenu)));
			component.registerEvent(app.workspace.on("file-menu", bind(MenuActions.fileMenu)));
			component.registerEvent(app.workspace.on("files-menu", bind(MenuActions.filesMenu)));
		}
	};

	private createContext(app: App): UIContext {
		return {
			app: app,
			workspace: app.workspace,
			ui: this,
			icon: Icon,
			createDataProvider: this.dataProvider,
		} satisfies UIContext;
	}

	public contextulize(title: string) {
		const contextPrefix = this.settingsManager.settings.uiPrefix;
		return Str.isNonEmpty(contextPrefix) ? `${contextPrefix}: ${title}` : title;
	}

	public addMenuItem(menu: Menu, title: string, options?: {
		section?: string,
		checked?: boolean,
		icon?: string,
		prefix?: boolean,
		isLabel?: boolean,
		onClick?: (evt: MouseEvent | KeyboardEvent) => void,
		callback?: (item: MenuItem) => void,
	}): Menu {
		const {
			callback,
		} = options || {};

		menu.addItem(item => {
			this.configureMenuItem(item, title, options);
			callback?.(item);
		});

		return menu;
	}

	public configureMenuItem(item: MenuItem, title: string, options?: {
		section?: string,
		checked?: boolean,
		icon?: string,
		prefix?: boolean,
		isLabel?: boolean,
		onClick?: (evt: MouseEvent | KeyboardEvent) => void,
	}): MenuItem {
		const {
			section,
			checked,
			onClick,
			icon = Icon.PLUGIN,
			prefix = true,
			isLabel = false,
		} = options || {};

		item.setTitle(prefix ? this.contextulize(title) : title);
		item.setIcon(icon);
		item.setIsLabel(isLabel);

		if (checked !== undefined)
			item.setChecked(checked);

		if (section)
			item.setSection(section);

		if (onClick)
			item.onClick(onClick);

		return item;
	}

	public readonly notify = {

		info: (msg: string, options?: {
			prefix?: boolean,
			preventDismissal?: boolean,
			duration?: number,
		}) => {
			const {
				prefix = true,
				preventDismissal = false,
				duration,
			} = options || {};

			const notice = prefix ? this.contextulize(msg) : msg;
			new Notice(notice, preventDismissal ? 0 : duration);
			return notice;
		},

		error: (msg: string) => {
			const notice = this.contextulize(msg);
			new Notice(notice, 0);
			return notice;
		},
	};

	public static isInInLivePreview(app: App) {
		const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
		if (!markdownView)
			return false;
		const state = markdownView.getState();
		return state["mode"] == "source" && state["source"] == false;
	}
}
