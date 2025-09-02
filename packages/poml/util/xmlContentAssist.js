// Adapted from https://github.com/SAP/xml-tools/blob/master/packages/content-assist/lib/content-assist.js

const { defaultsDeep, forEach, isArray, find, findIndex, flatMap, identity, last, isEmpty } = require('lodash');
const { BaseXmlCstVisitor } = require('@xml-tools/parser');
const { findNextTextualToken } = require('@xml-tools/common');

function getSuggestions(options) {
  const actualOptions = defaultsDeep(options, {
    providers: {
      elementContent: [],
      elementName: [],
      elementCloseName: [],
      attributeName: [],
      attributeValue: [],
    },
    context: undefined,
  });

  let { providerType, providerArgs } = computeCompletionSyntacticContext({
    cst: actualOptions.cst,
    tokenVector: actualOptions.tokenVector,
    ast: actualOptions.ast,
    offset: actualOptions.offset,
  });

  // Inject Additional semantic context for the content assist providers.
  providerArgs.context = actualOptions.context;

  if (providerType === null) {
    return [];
  } else {
    const selectedProviders = actualOptions.providers[providerType];

    const suggestions = flatMap(selectedProviders, (suggestionProvider) => suggestionProvider(providerArgs));
    return suggestions;
  }
}

function computeCompletionSyntacticContext({ cst, ast: docAst, offset, tokenVector }) {
  const contextVisitor = new SuggestionContextVisitorWithClose(docAst, offset, tokenVector);
  contextVisitor.visit(cst);
  return contextVisitor.result;
}

class SuggestionContextVisitorWithClose extends BaseXmlCstVisitor {
  constructor(docAst, offset, tokenVector) {
    super();
    this.docAst = docAst;
    this.targetOffset = offset;
    this.tokenVector = tokenVector;
    this.result = { providerType: null, providerArgs: {} };
    this.found = false;
  }

  /**
   * @param {DocumentCtx} ctx
   */
  document(ctx) {
    this.visit(ctx.element, this.docAst.rootElement);
  }

  /**
   * @param {PrologCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  prolog(ctx, astNode) {}

  /**
   * @param {docTypeDeclCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  docTypeDecl(ctx, astNode) {}

  /**
   * @param {ExternalIDCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  externalID(ctx, astNode) {}

  /**
   * @param {ContentCtx} ctx
   * @param {XMLElement} astNode
   *
   */
  content(ctx, astNode) {
    forEach(ctx.element, (elem, idx) => {
      this.visit(elem, astNode.subElements[idx]);
    });
  }

  /**
   * @param {ElementCtx} ctx
   * @param {XMLElement} astNode
   */
  element(ctx, astNode) {
    // Order of handlers can affect the result!
    // They are ordered by priority, the more specific handlers are listed first.
    handleElementNameWithoutPrefixScenario(ctx, astNode, this);

    if (this.found === false) {
      handleElementNameWithPrefixScenario(ctx, astNode, this);
    }

    // Traverse Deeper
    if (this.found === false) {
      forEach(ctx.attribute, (attrib, idx) => this.visit(attrib, astNode.attributes[idx]));
      this.visit(ctx.content, astNode);
    }

    if (this.found === false) {
      handleNewAttributeKeyScenario(ctx, astNode, this.tokenVector, this);
    }

    if (this.found === false) {
      handleElementContentScenario(ctx, astNode, this);
    }

    if (this.found === false) {
      handleElementNameCloseWithoutPrefixScenario(ctx, astNode, this);
    }

    if (this.found === false) {
      handleElementNameCloseWithPrefixScenario(ctx, astNode, this);
    }
  }

  /**
   * @param {ReferenceCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  reference(ctx, astNode) {}

  /**
   * @param {AttributeCtx} ctx
   * @param {XMLAttribute} astNode
   */
  attribute(ctx, astNode) {
    // potential Attribute Value scenarios
    /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
    if (exists(ctx.STRING)) {
      const valueTok = ctx.STRING[0];
      if (
        // The content assist point must be inside the string quotes
        valueTok.startOffset < this.targetOffset &&
        valueTok.endOffset >= this.targetOffset
      ) {
        const prefixEnd = this.targetOffset - valueTok.startOffset;
        const prefix = valueTok.image.substring(1, prefixEnd);
        this.result.providerType = 'attributeValue';
        this.result.providerArgs = {
          element: astNode.parent,
          attribute: astNode,
          prefix: prefix !== '' ? prefix : undefined,
        };
        this.found = true;
      }
    }

    /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
    if (exists(ctx.Name)) {
      const keyTok = ctx.Name[0];

      if (keyTok.startOffset <= this.targetOffset && keyTok.endOffset + 1 >= this.targetOffset) {
        const prefixEnd = this.targetOffset - keyTok.startOffset;
        const prefix = keyTok.image.substring(0, prefixEnd);
        this.result.providerType = 'attributeName';
        this.result.providerArgs = {
          element: astNode.parent,
          attribute: astNode,
          prefix: prefix !== '' ? prefix : undefined,
        };
        this.found = true;
      }
    }
  }

  /**
   * @param {ChardataCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  chardata(ctx, astNode) {}

  /**
   * @param {MiscCtx} ctx
   */
  /* istanbul ignore next - place holder*/
  misc(ctx, astNode) {}
}

function handleElementNameWithoutPrefixScenario(ctx, astNode, visitor) {
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.OPEN)) {
    const openTok = ctx.OPEN[0];
    if (openTok.endOffset + 1 === visitor.targetOffset) {
      visitor.result.providerType = 'elementName';
      visitor.result.providerArgs = { element: astNode, prefix: undefined };
      visitor.found = true;
    }
  }
}

function handleElementNameWithPrefixScenario(ctx, astNode, visitor) {
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.Name)) {
    const nameTok = ctx.Name[0];
    if (nameTok.startOffset < visitor.targetOffset && nameTok.endOffset + 1 >= visitor.targetOffset) {
      visitor.result.providerType = 'elementName';
      const prefixLength = visitor.targetOffset - nameTok.startOffset;
      const prefix = nameTok.image.substring(0, prefixLength);
      visitor.result.providerArgs = { element: astNode, prefix: prefix };
      visitor.found = true;
    }
  }
}

function handleElementNameCloseWithoutPrefixScenario(ctx, astNode, visitor) {
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.SLASH_OPEN)) {
    const openTok = ctx.SLASH_OPEN[0];
    if (openTok.endOffset + 1 === visitor.targetOffset) {
      visitor.result.providerType = 'elementNameClose';
      visitor.result.providerArgs = { element: astNode, prefix: undefined };
      visitor.found = true;
    }
  }
}

function handleElementNameCloseWithPrefixScenario(ctx, astNode, visitor) {
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.END_NAME)) {
    const nameTok = ctx.END_NAME[0];
    if (nameTok.startOffset < visitor.targetOffset && nameTok.endOffset + 1 >= visitor.targetOffset) {
      visitor.result.providerType = 'elementNameClose';
      const prefixLength = visitor.targetOffset - nameTok.startOffset;
      const prefix = nameTok.image.substring(0, prefixLength);
      visitor.result.providerArgs = { element: astNode, prefix: prefix };
      visitor.found = true;
    }
  }
}

function handleNewAttributeKeyScenario(ctx, astNode, tokenVector, visitor) {
  // Potential AttributeKey scenario in a completely new attribute
  // Note the guard condition (in caller) to avoid this branch if one of the attributes scenarios was already detected.
  // This means the order of checking the scenarios is meaningful!
  // Example of the problem:
  // -  `<person gen⇶>` should be matched as attributeName **with prefix** (In attribute handler code)
  // -  `<person gen="Y"⇶>` should be matched as a **new** attributeName **without prefix** (in the code below).
  // But the logic below cannot distinguish these, so it must only be executed if the attribute handler failed.
  const attributesRange = { from: undefined, to: undefined };
  let hasTerminatedAttribRange = false;
  let hasAttributeCloseToken = false;
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.Name)) {
    attributesRange.from = ctx.Name[0].endOffset + 1;
    // Figure where does the attributes area end
    if (exists(ctx.START_CLOSE)) {
      attributesRange.to = ctx.START_CLOSE[0].startOffset;
      hasTerminatedAttribRange = true;
      hasAttributeCloseToken = true;
    } else if (exists(ctx.SLASH_CLOSE)) {
      attributesRange.to = ctx.SLASH_CLOSE[0].startOffset;
      hasTerminatedAttribRange = true;
      hasAttributeCloseToken = true;
      // If we do not have a proper Attribute Section closing mark we use the last attribute instead
    } else if (isEmpty(ctx.attribute) === false) {
      attributesRange.to = last(ctx.attribute).location.endOffset;
      hasTerminatedAttribRange = true;
    }
  }

  if (
    hasTerminatedAttribRange &&
    visitor.targetOffset <= attributesRange.to &&
    attributesRange.from <= visitor.targetOffset
  ) {
    const isNotInExistingAttribute =
      find(ctx.attribute, (attribCst) => {
        const attribLoc = attribCst.location;
        return visitor.targetOffset >= attribLoc.startOffset && visitor.targetOffset <= attribLoc.endOffset;
      }) === undefined;

    // inside attribute area but not contained in any existing attribute
    /* istanbul ignore else - else branch is handled inside the attributes themselves and can never occur here */
    if (isNotInExistingAttribute) {
      visitor.result.providerType = 'attributeName';
      visitor.result.providerArgs = {
        element: astNode,
        attribute: undefined,
        prefix: undefined,
      };
      visitor.found = true;
    }
  } else if (
    /**
     * Heuristic when we some attributes but no proper attribute Range
     * and we request the assist after the last attribute.
     * <people>
     *     <person age="66" ⇶
     * </people>
     */
    hasTerminatedAttribRange &&
    visitor.targetOffset > attributesRange.to &&
    hasAttributeCloseToken === false
  ) {
    handleNewAttributeKeyForPartialElement(
      // dummy pesudo token a we are searching the following token using the endOffset
      { endOffset: attributesRange.to },
      tokenVector,
      visitor,
      astNode,
    );
    /**
     * Heuristic when we have no attribute range, e.g:
     * <people>
     *     <person ⇶
     * </people>
     */
  } else if (hasTerminatedAttribRange === false) {
    handleNewAttributeKeyForPartialElement(ctx.Name ? ctx.Name[0] : ctx.OPEN[0], tokenVector, visitor, astNode);
  }
}

function handleNewAttributeKeyForPartialElement(possibleAttribKeyRangeStartTok, tokenVector, visitor, astNode) {
  const nextAfterElemNameTok = findNextTextualToken(tokenVector, possibleAttribKeyRangeStartTok.endOffset);
  if (
    visitor.targetOffset > possibleAttribKeyRangeStartTok.endOffset &&
    (nextAfterElemNameTok === null || // `null`` means there are no more textual tokens in the input
      visitor.targetOffset <= nextAfterElemNameTok.startOffset)
  ) {
    visitor.result.providerType = 'attributeName';
    visitor.result.providerArgs = {
      element: astNode,
      attribute: undefined,
      prefix: undefined,
    };
    visitor.found = true;
  }
}

function handleElementContentScenario(ctx, astNode, visitor) {
  const contentRange = { from: undefined, to: undefined };
  let hasContentRange = false;
  /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
  if (exists(ctx.START_CLOSE)) {
    contentRange.from = ctx.START_CLOSE[0].endOffset + 1;
    // visitor logic only works when the attribute section is properly terminated
    /* istanbul ignore else - Very difficult to reproduce specific partial CSTs */
    if (exists(ctx.SLASH_OPEN)) {
      contentRange.to = ctx.SLASH_OPEN[0].startOffset;
      hasContentRange = true;
    } else if (exists(ctx.SLASH_CLOSE)) {
      contentRange.to = ctx.SLASH_CLOSE[0].startOffset;
      hasContentRange = true;
    }
  }

  if (hasContentRange && visitor.targetOffset <= contentRange.to && contentRange.from <= visitor.targetOffset) {
    const allContentChildren = flatMap(ctx.content[0].children, identity);
    const innerContentPart = find(allContentChildren, (subContent) => {
      // Handling either CSTNodes or Tokens
      const subContentLoc = subContent.location ? subContent.location : subContent;

      // Our offset ranges are Inclusive to Exclusive
      // <person>abc⇶</person> --> Not inside the CharData Location, but uses `abc` as prefix
      // <person>⇶abc</person> --> Inside the CharData Location, but does not have any prefix
      const targetOffsetForPrefix = visitor.targetOffset - 1;

      return targetOffsetForPrefix >= subContentLoc.startOffset && targetOffsetForPrefix <= subContentLoc.endOffset;
    });

    // ElementContent without prefix
    if (innerContentPart === undefined) {
      visitor.result.providerType = 'elementContent';
      visitor.result.providerArgs = {
        element: astNode,
        textContent: undefined,
        prefix: undefined,
      };
      visitor.found = true;
    } else if (innerContentPart.name === 'chardata') {
      const textNodeIdx = findIndex(ctx.content[0].children.chardata, innerContentPart);
      const textContentsAstNode = astNode.textContents[textNodeIdx];
      const prefixEnd = visitor.targetOffset - textContentsAstNode.position.startOffset;
      visitor.result.providerType = 'elementContent';
      visitor.result.providerArgs = {
        element: astNode,
        textContent: textContentsAstNode,
        prefix: textContentsAstNode.text.substring(0, prefixEnd),
      };
      visitor.found = true;
    }
  }
}

function exists(tokArr) {
  return isArray(tokArr) && tokArr.length === 1 && tokArr[0].isInsertedInRecovery !== true;
}

module.exports = {
  computeCompletionSyntacticContext: computeCompletionSyntacticContext,
  getSuggestions: getSuggestions,
};
