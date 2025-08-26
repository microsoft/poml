// Browser-safe @xml-tools/ast stub for poml-browser
// @xml-tools/ast is used for building and working with XML Abstract Syntax Trees
// In browser context, this functionality is limited

export interface XMLAttribute {
  key: string;
  value: string;
  position?: any;
}

export interface XMLTextContent {
  text: string;
  position?: any;
}

export interface XMLElement {
  type: 'XMLElement';
  name: string;
  attributes: XMLAttribute[];
  subElements: XMLElement[];
  textContents: XMLTextContent[];
  position?: any;
}

export interface XMLDocument {
  type: 'XMLDocument';
  rootElement?: XMLElement;
  position?: any;
}

export function buildAst(_cst: any, _tokenVector: any[]): XMLDocument {
  throw new Error(
    'buildAst from @xml-tools/ast is not available in browser context. XML AST building requires server-side libraries.',
  );
}

export default {
  buildAst,
};
