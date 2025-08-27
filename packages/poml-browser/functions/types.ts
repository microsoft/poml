export interface ExtractedContent {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  url?: string;
  timestamp: Date;
  isManual?: boolean;
  debug?: string;
}

export type NotificationPosition = 'top' | 'bottom';
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'debug' | 'debug+' | 'debug++';
export type NotificationLevel = 'important' | 'warning' | 'info' | 'debug' | 'debug+' | 'debug++';

export type Theme = 'light' | 'dark' | 'auto';

export interface SettingsBundle {
  theme: Theme;
  uiNotificationLevel: NotificationLevel;
  consoleNotificationLevel: NotificationLevel;
}

// Type-safe function registry
export type FunctionRegistry = {
  [K: string]: (...args: any[]) => any;
};

// Global registry type that will be extended by users
export interface GlobalFunctions extends FunctionRegistry {
  // Please put the signatures of global functions here
  saveToStorage: (key: string, value: any) => Promise<boolean>;
  getPageTitle: () => string;
  getSettings: (refresh?: boolean) => Promise<SettingsBundle>;
  setSettings: (settings: Partial<SettingsBundle>) => Promise<void>;
}
