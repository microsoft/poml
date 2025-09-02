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
