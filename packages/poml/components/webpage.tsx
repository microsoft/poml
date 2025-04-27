import { PropsSyntaxBase } from "poml/essentials";

export interface WebpageProps extends PropsSyntaxBase {
  src?: string;
  url?: string;
  buffer?: string | Buffer;
}

