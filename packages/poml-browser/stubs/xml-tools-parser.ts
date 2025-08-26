// Browser-safe @xml-tools/parser stub for poml-browser
// @xml-tools/parser is used for parsing XML documents into CST (Concrete Syntax Tree)
// In browser context, this functionality is limited

export interface DocumentCstNode {
  name: string;
  children?: any[];
  location?: any;
}

export interface ParseResult {
  cst: DocumentCstNode;
  tokenVector: any[];
  lexErrors: any[];
  parseErrors: any[];
}

export function parse(_xmlText: string): ParseResult {
  throw new Error(
    'XML parsing with @xml-tools/parser is not available in browser context. XML processing requires server-side libraries.',
  );
}

export class BaseXmlCstVisitor {
  constructor() {
    throw new Error(
      'BaseXmlCstVisitor is not available in browser context. XML AST processing requires server-side libraries.',
    );
  }
}

export default {
  parse,
  BaseXmlCstVisitor,
};
