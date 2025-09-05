// The main content to be displayed in the browser extension UI and stored in storage
// We are moving away from the old CardModel to this new CardModel system.
export interface CardModel {
  content: CardContent;
  source?: CardSource;
  url?: string; // could be a webpage URL or a file path
  mimeType?: string; // MIME type of the source, e.g. text/markdown, image/png. Not critical for now.
  excerpt?: string;
  tags?: string[];
  debug?: string;
  timestamp?: Date;
}

export type CardSource = 'manual' | 'clipboard' | 'drop' | 'file' | 'webpage' | 'generated';

export interface CreateCardOptions {
  source?: CardSource;
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

export interface Image {
  base64: string; // Base64-encoded image data (without data URL prefix)
  mimeType: string; // MIME type of the image (e.g., 'image/png', 'image/jpeg')
  width: number; // Width of the image in pixels
  height: number; // Height of the image in pixels
}

export interface TextFile {
  content: string; // File content as text
  mimeType: string; // MIME type of the file (e.g., 'text/plain', 'text/markdown')
  size: number; // Size of the file in bytes
}

export interface BinaryFile {
  content: ArrayBuffer; // File content as binary data
  mimeType: string; // MIME type of the file (e.g., 'application/pdf', 'image/png')
  size: number; // Size of the file in bytes
}

/**
 * Options for the cardFromHtml function
 */
export interface CardFromHtmlOptions extends CreateCardOptions {
  /**
   * Parser mode:
   * - 'simple': Use Readability output as a single text card
   * - 'complex': Use custom parser with headers, images, lists, etc.
   * @default 'complex'
   */
  parser?: 'simple' | 'complex';

  /**
   * Minimum image size in pixels (width or height) to include.
   * Images smaller than this will be ignored.
   * @default 64
   */
  minimumImageSize?: number;

  /**
   * Source description for the CardModel
   * @default 'webpage'
   */
  source?: CardSource;
}

/**
 * Options for cardFromPdf function
 */
export interface CardFromPdfOptions extends CreateCardOptions {
  /**
   * Maximum number of pages to extract from the PDF.
   * @default 100
   */
  maxPages?: number;

  /**
   * Maximum number of images to extract from the PDF.
   * @default 10
   */
  maxImages?: number;

  /**
   * Whether to exclude page numbers from the extracted content.
   * @default true
   */
  excludePageNumbers?: boolean;

  /**
   * Whether to generate page visualizations for debug.
   * @default false
   */
  visualizePages?: boolean;
}

export interface CardFromPdfResult {
  card: CardModel;
  visualized?: Image[]; // Optional array of page visualization for debug
}

// Global registry type that will be extended by users
export interface GlobalFunctions extends FunctionRegistry {
  // Please put the signatures of global functions here
  getSettings: (refresh?: boolean) => Promise<SettingsBundle>;
  setSettings: (settings: Partial<SettingsBundle>) => Promise<void>;
  displayNotification: (type: NotificationType, message: string, options?: NotificationOptions) => void;
  toPngBase64: (
    base64: string | { base64: ArrayBuffer | string } | { src: string },
    options?: { mimeType?: string },
  ) => Promise<Image>;
  cardFromHtml: (html: string | Document, options?: CardFromHtmlOptions) => Promise<CardModel>;

  // Internal functions used by everywhere()
  _readFile: (
    filePath: string,
    options?: { encoding?: 'utf-8' | 'utf8' | 'base64' | 'binary' },
  ) => Promise<TextFile | BinaryFile>;
  _cardFromPdf: (file: string | File | Blob | ArrayBuffer, options?: CardFromPdfOptions) => Promise<CardFromPdfResult>;

  // Functions for testing purposes
  pingPongContent: (message: any, delay: number) => Promise<any>;
  pingPongBackground: (message: any, delay: number) => Promise<any>;
  pingPongSidebar: (message: any, delay: number) => Promise<any>;
}
