/**
 * Converting CST nodes to AST nodes.
 *
 * It's time for:
 *
 * - Check open/close tag matching
 * - Deal with HTML entities escape and backslash escape
 * - Concatenate wrongly split text into LiteralNode
 * - Unify the types (e.g., AttributeNode must have ValueNode children)
 *
 * It's not time yet for:
 *
 * - Evaluating expressions in templates
 * - Resolving includes
 * - Validating semantics (e.g., whether an attribute is allowed on a certain element)
 */
