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

// Notification Options interface
export interface NotificationOptions {
  title?: string;
  source?: string;
  details?: string;
  duration?: number;
  position?: NotificationPosition;
  autoHide?: boolean;
}

// Global registry type that will be extended by users
export interface GlobalFunctions extends FunctionRegistry {
  // Please put the signatures of global functions here
  getSettings: (refresh?: boolean) => Promise<SettingsBundle>;
  setSettings: (settings: Partial<SettingsBundle>) => Promise<void>;
  displayNotification: (type: NotificationType, message: string, options?: NotificationOptions) => void;

  // Functions for testing purposes
  pingPongContent: (message: any, delay: number) => Promise<any>;
  pingPongBackground: (message: any, delay: number) => Promise<any>;
  pingPongSidebar: (message: any, delay: number) => Promise<any>;
}
