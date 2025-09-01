// The main content to be displayed in the browser extension UI and stored in storage
// We are moving away from the old CardModel to this new CardModel system.
export interface CardModel {
  content: CardContent;
  source?: 'manual' | 'clipboard' | 'drop' | 'file' | 'webpage' | 'generated';
  url?: string; // could be a webpage URL or a file path
  mimeType?: string; // MIME type of the source, e.g. text/markdown, image/png. Not critical for now.
  excerpt?: string;
  tags?: string[];
  debug?: string;
  timestamp?: Date;
}

export type PomlContainerType =
  // Formatting
  | 'CaptionedParagraph' // Default container for text cards with a caption
  | 'Paragraph' // Default container for text cards without a caption
  | 'Code' // Opt-in to show text cards in a code block
  // Intentions, mainly useful for categorization. Rendering may be similar, except perhaps with a different title
  | 'Example'
  | 'ExampleInput'
  | 'ExampleOutput'
  | 'ExampleSet'
  | 'Hint'
  | 'Introducer'
  | 'OutputFormat'
  | 'Question'
  | 'Role'
  | 'StepwiseInstructions'
  | 'Task';

// Categorization is mainly for UI rendering purposes.
// For example, text cards should render differently from table cards.
// When converting to POML: a Text card becomes a <text> component, an Image card becomes an <image> component, etc.
// They may also specify an extra container, e.g., <role>.
export interface TextCardContent {
  type: 'text';
  text: string;
  caption?: string;
  container?: PomlContainerType;
}

export interface ListCardContent {
  type: 'list';
  items: string[];
  ordered?: boolean; // default: unordered
  caption?: string; // Caption is for UI display only; no effect in POML conversion
  container?: PomlContainerType; // Container has no effect for List cards
}

export interface ImageCardContent {
  type: 'image';
  base64: string; // must be base64-encoded PNG
  alt?: string;
  caption?: string; // Caption is for UI display only; no effect in POML conversion
  container?: PomlContainerType; // Container has no effect for Image cards
}

export interface TableCardContent {
  type: 'table';
  records: { [key: string]: any }[]; // array of records
  columns?: ColumnDefinition[]; // optional column definitions
  caption?: string;
  container?: PomlContainerType; // e.g., ExampleInput
}

export interface NestedCardContent {
  type: 'nested';
  cards: CardContent[];
  caption?: string;
  container?: PomlContainerType; // e.g., ExampleSet
}

// This is not a valid CardContent; used internally when extracting headers for the first time
export interface HeaderCardContent {
  type: 'header';
  text: string;
  level: number; // 1-6 for <h1>-<h6>
}

export type CardContent = TextCardContent | ListCardContent | ImageCardContent | TableCardContent | NestedCardContent;

export type CardContentWithHeader = CardContent | HeaderCardContent;

interface ColumnDefinition {
  field: string;
  header: string;
  description?: string;
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
  toPngBase64: (base64: ArrayBuffer | string, mimeType: string) => Promise<string>;
  srcToPngBase64: (src: string) => Promise<string>;
  htmlToCards: (html: string | Document, options?: { parser?: 'simple' | 'complex' }) => Promise<CardModel | undefined>;

  // Internal functions used by everywhere()
  _readFile: (
    filePath: string,
    options?: { encoding?: 'utf-8' | 'utf8' | 'base64' | 'binary' },
  ) => Promise<string | ArrayBuffer>;

  // Functions for testing purposes
  pingPongContent: (message: any, delay: number) => Promise<any>;
  pingPongBackground: (message: any, delay: number) => Promise<any>;
  pingPongSidebar: (message: any, delay: number) => Promise<any>;
}
