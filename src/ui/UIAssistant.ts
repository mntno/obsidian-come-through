import { App, MarkdownView, Menu, MenuItem, Notice } from "obsidian";
import { SettingsManager } from "Settings";
import { Icon } from "ui/constants";
import { Str } from "utils/ts";


export class UIAssistant {

  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
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

  public displayNotice(msg: string, options?: {
    prefix?: boolean,
    preventDismissal?: boolean,
    duration?: number,
  }) {
    const {
      prefix = true,
      preventDismissal = false,
      duration,
    } = options || {};

    const notice = prefix ? this.contextulize(msg) : msg;
    new Notice(notice, preventDismissal ? 0 : duration);
    return notice;
  }

  public displayErrorNotice(msg: string) {
    const notice = this.contextulize(msg);
    new Notice(notice, 0);
    return notice;
  }

  public static isInInLivePreview(app: App) {
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView)
    if (!markdownView)
      return false;
    const state = markdownView.getState();
    return state["mode"] == "source" && state["source"] == false;
  }
}
