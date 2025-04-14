import { Menu, MenuItem, Notice } from "obsidian";
import { SettingsManager } from "Settings";

export const PLUGIN_NAME = "Come Through";
export const PLUGIN_ICON = "drill";
export const CARD_FRONT_ICON = "file-output";
export const CARD_BACK_ICON = "file-input";

export class UIAssistant {

  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  public contextulize(title: string) {
    const contextPrefix = this.settingsManager.settings.uiPrefix;
    if (contextPrefix !== undefined)
      return contextPrefix ? `${contextPrefix}: ${title}` : title;    
    else
      return `${PLUGIN_NAME}: ${title}`;
  }

  public addMenuItem(menu: Menu, title: string, options?: { 
    section?: string, 
    checked?: boolean,
    icon?: string,
    prefix?: boolean, 
    onClick?: (evt: MouseEvent | KeyboardEvent) => any
    callback?: (item: MenuItem) => any,
   }): Menu {   
    const {
      section,
      checked,
      onClick,
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
    onClick?: (evt: MouseEvent | KeyboardEvent) => any
   }): MenuItem {   
    const {
      section,
      checked,
      onClick,
      icon = PLUGIN_ICON,
      prefix = true,
    } = options || {};

    item.setTitle(prefix ? this.contextulize(title) : title);    
    item.setIcon(icon);
    
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
    
    new Notice(prefix ? this.contextulize(msg) : msg, preventDismissal ? 0 : duration);    
  }

  public displayErrorNotice(msg: string) {
    new Notice(this.contextulize(msg), 0);
  }
}
