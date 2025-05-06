/**
 * The very basic logics that drive "every" component in the system.
 * The "every" is the criteria whether the logic should serve as a base.
 * For example, the stylesheet is considered as a base, as it's supported in every component,
 * but markup presentation is not.
 */

import * as React from 'react';
import { distance } from 'closest-match';
import { deepMerge } from './util';
import componentDocs from './assets/componentDocs.json';
import path from 'path';
import flattenChildren from 'react-keyed-flatten-children';

export type Speaker = 'system' | 'human' | 'ai';
export const ValidSpeakers = ['system', 'human', 'ai'];

/**
 * This is to show in the final rendered prompt.
 */
export interface ContentMultiMedia {
  type: string; // image/png, image/jpeg, ...,
  base64: string;
  alt?: string;
}

export type RichContent = string | (string | ContentMultiMedia)[];

export interface Message {
  speaker: Speaker;
  content: RichContent;
}

/**
 * Props base serves the following props subclass, as far as I can now think of:
 * 1. Props for markup basic components
 * 2. Props for serialization basic components
 * 3. Props for essential general components
 *   3.1. Props for other high-level components
 */
export interface PropsBase {
  speaker?: Speaker;
  className?: string;

  // Record the original start and end index in the raw text file for debugging purposes.
  // Marked as "original" to distinguish from the index in writer.
  originalStartIndex?: number;
  originalEndIndex?: number;

  // Experimental
  writerOptions?: object;
  whiteSpace?: 'pre' | 'filter' | 'trim';
}

/**
 * Create an element that will be visible in the IR.
 * Helper function for logging and debugging purposes.
 */
export const irElement = (type: string, props: any, ...children: React.ReactNode[]) => {
  if (props.speaker && !ValidSpeakers.includes(props.speaker)) {
    ErrorCollection.add(ReadError.fromProps(`"${props.speaker}" is not a valid speaker.`, props));
    props.speaker = undefined;
  }
  const propsWithoutUndefined = Object.fromEntries(
    Object.entries(props)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => {
        const hyphenCaseKey = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        if (typeof v === 'boolean') {
          return [hyphenCaseKey, v.toString()];
        } else if (typeof v === 'number') {
          return [hyphenCaseKey, v.toString()];
        } else if (typeof v === 'object') {
          return [hyphenCaseKey, JSON.stringify(v)];
        } else {
          return [hyphenCaseKey, v];
        }
      })
  );

  const trimmedChildren = trimChildrenWhiteSpace(children, props);
  return React.createElement(type, propsWithoutUndefined, ...trimmedChildren);
};

export function trimChildrenWhiteSpace(children: React.ReactNode, props: PropsBase) {
  // This is exposed for providers.
  // The children directly under a context provider also needs to be trimmed,
  // otherwise they do not have a chance to be trimmed.
  let flattenedChildren = flattenChildren(children);

  // Merge consecutive strings.
  if (props.whiteSpace !== 'pre') {
    const mergedChildren: React.ReactNode[] = [];
    let currentString: string = '';
    for (const child of flattenedChildren) {
      if (typeof child === 'string') {
        currentString += child;
      } else {
        if (currentString) {
          mergedChildren.push(currentString);
          currentString = '';
        }
        mergedChildren.push(child);
      }
    }
    if (currentString) {
      mergedChildren.push(currentString);
    }
    flattenedChildren = mergedChildren;
  }

  const trimmedChildren = flattenedChildren
    .map((child, index) => {
      if (typeof child === 'string') {
        if (props.whiteSpace === 'pre') {
          return child;
        } else if (props.whiteSpace === 'filter' || props.whiteSpace === undefined) {
          return trimText(child, index === 0, index === flattenedChildren.length - 1);
        } else if (props.whiteSpace === 'trim') {
          return index === 0
            ? child.trimStart()
            : index === flattenedChildren.length - 1
              ? child.trimEnd()
              : child;
        } else {
          ErrorCollection.add(
            ReadError.fromProps(`"${props.whiteSpace}" is not a valid whiteSpace option.`, props)
          );
          return child;
        }
      } else {
        return child;
      }
    })
    .filter(c => c !== '');
  return trimmedChildren;
}

/**
 * Trim the element tree following the CSS rules
 * https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
 */
const trimText = (text: string, isFirst: boolean, isLast: boolean): string => {
  // 1. all spaces and tabs immediately before and after a line break are ignored
  text = text.replace(/[\t\n\r ]*\n[\t\n\r ]*/g, '\n');
  // 2. all tab characters and line breaks are handled as space characters
  text = text.replace(/[\t\n\r]/g, ' ');
  // 3. multiple space characters are handled as one space character
  text = text.replace(/ +/g, ' ');
  // 4. sequences of spaces at the beginning and end of an element are removed
  if (isFirst) {
    text = text.replace(/^ +/, '');
  }
  if (isLast) {
    text = text.replace(/ +$/, '');
  }
  return text;
};

/**
 * Error type.
 */

interface PomlErrorOptions extends ErrorOptions {
  severity?: 'error' | 'warning';
}

class PomlError extends Error {
  public severity: 'error' | 'warning' = 'error';

  constructor(message: string, options?: PomlErrorOptions) {
    super(message, options);
    this.name = 'PomlError';
    if (options?.severity) {
      this.severity = options.severity;
    }
  }
}

export class SystemError extends PomlError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SystemError';
  }
}

export class ReadError extends PomlError {
  constructor(
    message: string,
    public startIndex?: number,
    public endIndex?: number,
    options?: PomlErrorOptions
  ) {
    super(message, options);
    this.name = 'ReadError';
  }

  public static fromProps(message: string, props: PropsBase, options?: PomlErrorOptions) {
    return new ReadError(message, props.originalStartIndex, props.originalEndIndex, options);
  }
}

export class WriteError extends PomlError {
  constructor(
    message: string,
    public startIndex?: number,
    public endIndex?: number,
    public irStartIndex?: number,
    public irEndIndex?: number,
    public relatedIr?: string,
    options?: PomlErrorOptions
  ) {
    super(message, options);
    this.name = 'WriteError';
  }
}

/**
 * A can to hold all the errors.
 */

export class ErrorCollection {
  private errors: PomlError[] = [];

  private static _instance: ErrorCollection;

  private constructor() {}

  public static get instance() {
    if (!this._instance) {
      this._instance = new ErrorCollection();
    }
    return this._instance;
  }

  public static add(error: PomlError) {
    this.instance.errors.push(error);
  }

  public static first() {
    return this.instance.errors[0];
  }

  public static last() {
    return this.instance.errors[this.instance.errors.length - 1];
  }

  public static list() {
    return this.instance.errors;
  }

  public static empty() {
    return this.instance.errors.length === 0;
  }

  public static clear() {
    this.instance.errors = [];
  }
}

export const useWithCatch = <T,>(promise: Promise<T>, props: PropsBase) => {
  const catchedPromise = promise.catch((err: any) => {
    if (err instanceof PomlError) {
      ErrorCollection.add(err);
    } else {
      ErrorCollection.add(
        ReadError.fromProps(
          err && err.message
            ? err.message
            : 'Unknown error happened during asynchroneous process of rendering.',
          props,
          { cause: err }
        )
      );
    }
  });
  return React.use(catchedPromise);
};

/**
 * Stylesheet is a way to configure the props to be used in the components globally.
 * It can be used to set multiple things, including markup syntax, presentation approach,
 * text formats, and more, as long as they are supported by the components' props.
 * If a globally set prop is not supported by a component, it will be ignored.
 *
 * The style can be set for all components or for a specific component type, such as:
 *
 * ```tsx
 * const stylesheet = {
 *   '*': {
 *     presentation: 'markup',
 *     markupLang: 'markdown',
 *     listStyle: 'unordered'
 *   },
 *   'table': {
 *     presentation: 'serialize',
 *     serializer: 'json'
 *   },
 *   Example: {
 *     messageInteraction: true
 *   },
 *   TaskDescription: {
 *     titleMarkupTransform: 'header',
 *     titleTextTransform: {
 *       case: 'upper'
 *     }
 *   }
 * }
 * ```
 *
 * The stylesheet can be then set via a `StyleSheetProvider` component:
 *
 * ```tsx
 * <StyleSheetProvider stylesheet={stylesheet}><MyPrompt /></StyleSheetProvider>
 * ```
 */
export interface StyleSheet {
  // Match can be a component name, a wildcard, or a class name.
  // One component can have multiple aliases, which are all valid for matching.
  [match: string]: AnyProps;
}

type AnyProps = { [x: string]: unknown };

const StyleSheetContext = React.createContext<StyleSheet>({});

export const StyleSheetProvider = ({
  stylesheet,
  children
}: React.PropsWithChildren<{ stylesheet: StyleSheet }>) => {
  const currentStylesheet = React.useContext(StyleSheetContext);
  // Deep merge stylesheet
  stylesheet = deepMerge(currentStylesheet, stylesheet);
  return <StyleSheetContext.Provider value={stylesheet}>{children}</StyleSheetContext.Provider>;
};

const useStyleSheet = () => React.useContext(StyleSheetContext);

const computeStyles = <T,>(
  currentProps: T,
  component: PomlComponent,
  _stylesheet?: StyleSheet
): T => {
  const stylesheet = _stylesheet !== undefined ? _stylesheet : useStyleSheet();

  // priority, order, props
  const matches: [number, number, AnyProps][] = [];
  Object.entries(stylesheet).forEach(([match, props], index) => {
    if (match === '*') {
      matches.push([0, index, props]);
    } else {
      const matchResult: number[] = match.split(/\s+/g).map(indiv => {
        // FIXME: this is different from css rule
        if (indiv.startsWith('.')) {
          const currentClassName: string | undefined = (currentProps as any)?.className;
          const currentClasses = currentClassName ? currentClassName.split(/\s+/g) : [];
          return currentClasses.includes(indiv.slice(1)) ? 2 : 0;
        } else {
          return component.getAliases().includes(indiv.toLowerCase()) ? 1 : 0;
        }
      });
      if (matchResult.every(r => r > 0)) {
        matches.push([matchResult.reduce((a, b) => a + b, 0), index, props]);
      }
    }
  });

  matches.sort((a, b) => (a[0] == b[0] ? a[1] - b[1] : a[0] - b[0]));
  const { className, ...restProps } = currentProps as any;
  matches.push([999, -1, restProps]);

  let finalProps = {};
  matches.forEach(([, , props]) => {
    finalProps = deepMerge(finalProps, props);
  });
  return finalProps as T;
};

// Source provider provides a path to the source file.
// It's used to find related files specified in the source file.
// It's also used to locate the source file for debugging purposes.
const SourceContext = React.createContext<string>('');
export const SourceProvider = ({
  source,
  children
}: React.PropsWithChildren<{ source: string }>) => {
  return <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
};
export const expandRelative = (src: string) => {
  if (path.isAbsolute(src)) {
    return src;
  }
  const pomlSource = React.useContext(SourceContext);
  if (!pomlSource) {
    return src;
  }
  return path.resolve(path.dirname(pomlSource), src);
};

export interface Parameter {
  name: string;
  type: string;
  fallbackType: string | undefined;
  choices: string[];
  description: string;
  defaultValue: string | undefined;
  required: boolean;
}

export interface ComponentSpec {
  name?: string;
  description: string;
  params: Parameter[];
  baseComponents: string[];
  example: string;
}

interface ComponentOptions {
  aliases: string[];
  requiredProps: string[];
  unwantedProps: string[];
  applyStyleSheet: boolean;
  asynchorous: boolean;
}

interface NonStrictComponentOptions {
  aliases?: string[];
  requiredProps?: string[];
  unwantedProps?: string[];
  applyStyleSheet?: boolean;
  asynchorous?: boolean;
}

export class PomlComponent {
  private officialName: string;
  private componentFunc: any;
  private options: ComponentOptions;

  public constructor(officialName: string, componentFunc: any, options: ComponentOptions) {
    this.officialName = officialName;
    this.componentFunc = componentFunc;
    this.options = options;
  }

  public get name() {
    return this.officialName;
  }

  public getAliases(lower: boolean = true) {
    if (lower) {
      return this.options.aliases.map(alias => alias.toLowerCase());
    } else {
      return this.options.aliases;
    }
  }

  private warnsIfProvided(props: any) {
    if (!props) {
      return;
    }
    this.options.unwantedProps.forEach(key => {
      if (props[key] !== undefined) {
        ErrorCollection.add(
          ReadError.fromProps(
            `"${key}" is not supported (but provided) in ${this.officialName}.`,
            props,
            { severity: 'warning' }
          )
        );
      }
    });
  }

  private throwIfMissing(props: any) {
    this.options.requiredProps.forEach(key => {
      if (!props || props[key] === undefined) {
        throw ReadError.fromProps(
          `"${key}" is required but not provided for ${this.officialName}, available props are ${props ? Object.keys(props) : []}.`,
          props
        );
      }
    });
  }

  public isPublic(): boolean {
    return this.spec() !== undefined;
  }

  public static fromSpec(spec: ComponentSpec): PomlComponent {
    const found = findComponentByAliasOrUndefined(spec.name ?? '');
    if (found !== undefined) {
      return found;
    }
    throw new SystemError(`Component ${spec.name} not found.`);
  }

  public spec(): ComponentSpec | undefined {
    return (componentDocs as ComponentSpec[]).find(document => document.name === this.name);
  }

  public parameters(): Parameter[] {
    const spec = this.spec();
    if (!spec) {
      return [];
    }
    const bases = this.mro();
    const parameters = [...spec.params];
    for (const base of bases) {
      const baseSpec = base.spec();
      if (baseSpec) {
        parameters.push(
          ...baseSpec.params.filter(p => !parameters.map(p => p.name).includes(p.name))
        );
      }
    }
    return parameters;
  }

  public mro(): PomlComponent[] {
    const spec = this.spec();
    if (!spec) {
      return [];
    }

    const toSearch = [...spec.baseComponents];
    const result: PomlComponent[] = [];
    let searchPointer: number = 0;
    while (searchPointer < toSearch.length) {
      const component = findComponentByAliasOrUndefined(toSearch[searchPointer]);
      if (component !== undefined) {
        result.push(component);
        const componentSpec = component.spec();
        if (componentSpec) {
          for (const base of componentSpec.baseComponents) {
            if (!toSearch.includes(base) && !result.map(c => c.name).includes(base)) {
              toSearch.push(base);
            }
          }
        }
      }
      searchPointer++;
    }
    return result;
  }

  public style(props: any, stylesheet?: StyleSheet) {
    return computeStyles(props, this, stylesheet);
  }

  private preprocessProps<T>(props: any): any {
    const params = this.parameters();
    return Object.entries(props).reduce(
      (acc, [key, value]: [string, any]) => {
        const param = params.find(param => param.name.toLowerCase() === key.toLowerCase());
        if (!param) {
          // Keep it.
          acc[key] = value;
          return acc;
        }
        const formalKey = param.name;
        if (value === undefined) {
          // TODO: check required parameters
          acc[key] = value;
          return acc;
        }
        if (param.type === 'string') {
          if (typeof value !== 'string' && value !== undefined) {
            value = value.toString();
          }
        } else if (param.type === 'number') {
          if (typeof value !== 'number' && value !== undefined) {
            value = parseFloat(value);
          }
        } else if (param.type === 'boolean') {
          if (typeof value !== 'boolean') {
            const isTrue = ['1', 'true'].includes(value.toString().toLowerCase());
            const isFalse = ['0', 'false'].includes(value.toString().toLowerCase());
            if (!isTrue && !isFalse) {
              ErrorCollection.add(ReadError.fromProps(`"${key}" should be a boolean`, props));
              value = undefined;
            }
            value = isTrue;
          }
        } else if (param.type === 'object' || param.type === 'object|string') {
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              if (param.fallbackType !== 'string') {
                ErrorCollection.add(
                  ReadError.fromProps(`Fail to parse \"${key}\" with JSON parser`, props)
                );
              }
            }
          }
        } else if (param.type === 'RegExp' || param.type === 'RegExp|string') {
          if (typeof value === 'string') {
            if (value.startsWith('/')) {
              // Extract flags if present
              const lastSlashIndex = value.lastIndexOf('/');
              if (lastSlashIndex > 0) {
                const pattern = value.substring(1, lastSlashIndex);
                const flags = value.substring(lastSlashIndex + 1);
                // Only create RegExp with flags if flags exist and are valid
                if (flags && /^[gimsuy]*$/.test(flags)) {
                  value = new RegExp(pattern, flags);
                } else if (lastSlashIndex === value.length - 1) {
                  // Format is /pattern/ with no flags
                  value = new RegExp(pattern);
                }
              }
            } else {
              // Default behavior for strings not in /pattern/ format
              value = new RegExp(value);
            }
          }
        } else {
          // Keep as is.
        }
        if (param.choices.length > 0) {
          if (!param.choices.includes(value)) {
            ErrorCollection.add(
              ReadError.fromProps(
                `"${key}" should be one of ${param.choices.join(', ')}, not ${value}`,
                props
              )
            );
          }
        }
        acc[formalKey] = value;
        return acc;
      },
      {} as { [key: string]: any }
    );
  }

  public render(props: any) {
    this.warnsIfProvided(props);
    try {
      // If one of the following steps has error, abort the process.
      this.throwIfMissing(props);
      if (this.options.applyStyleSheet) {
        props = this.style(props);
      }
      props = this.preprocessProps(props);
      if (this.options.asynchorous) {
        const msg =
          'This prompt is asynchorous and still loading. Users should not see this message. ' +
          'If you see this message, please report it to the developer.';
        return (
          <React.Suspense fallback={<div>{msg}</div>}>{this.componentFunc(props)}</React.Suspense>
        );
      } else {
        return this.componentFunc(props);
      }
    } catch (e) {
      if (
        e &&
        typeof (e as any).message === 'string' &&
        (e as any).message.startsWith('Suspense Exception:')
      ) {
        throw e;
      }
      if (e instanceof PomlError) {
        ErrorCollection.add(e);
      } else {
        ErrorCollection.add(
          ReadError.fromProps(`Error in component render of ${this.officialName}: ${e}`, props, {
            cause: e
          })
        );
      }
      return null;
    }
  }
}

class ComponentRegistry {
  private static _instance: ComponentRegistry;

  private components: PomlComponent[] = [];

  private constructor() {}

  public static get instance() {
    if (!this._instance) {
      this._instance = new ComponentRegistry();
    }
    return this._instance;
  }

  public registerComponent(officialName: string, component: any, options: ComponentOptions) {
    if (!options.aliases.includes(officialName)) {
      options.aliases = [officialName, ...options.aliases];
    }
    options.aliases.forEach(alias => {
      const aliasExisting = this.components.filter(c =>
        c.getAliases().includes(alias.toLowerCase())
      );
      if (aliasExisting.length > 0) {
        throw new SystemError(`Alias "${alias}" is already used by ${aliasExisting[0]}.`);
      }
    });
    const registered = new PomlComponent(officialName, component, options);
    this.components.push(registered);
    return registered;
  }

  public unregisterComponent(name: string) {
    const component = this.getComponent(name);
    this.components = this.components.filter(c => c !== component);
  }

  public listComponents() {
    return [...this.components];
  }

  public getComponent(name: string): PomlComponent | undefined;
  public getComponent(name: string, returnReasonIfNotFound: true): PomlComponent | string;
  public getComponent(
    name: string,
    returnReasonIfNotFound: boolean = false
  ): PomlComponent | string | undefined {
    const hyphenToCamelCase = (s: string) => {
      return s.toLowerCase().replace(/-([a-z])/g, g => g[1].toUpperCase());
    };

    const nameVariants = [name.toLowerCase(), hyphenToCamelCase(name).toLowerCase()];

    for (const variant of nameVariants) {
      for (const component in this.components) {
        if (this.components[component].getAliases().includes(variant)) {
          return this.components[component];
        }
      }
    }

    if (!returnReasonIfNotFound) {
      return undefined;
    }

    const availableAliases = this.components.map(c => c.getAliases()).flat();

    const distances = availableAliases.map(alias => {
      return {
        alias: alias,
        dist: distance(alias.toLowerCase(), name.toLowerCase())
      };
    });
    distances.sort((a, b) => a.dist - b.dist);
    const doYouMean = distances.filter((d, index) => index < 1 || d.dist <= 2);
    return `Component ${name} not found. Do you mean: ${doYouMean.map(d => d.alias).join(', ')}?`;
  }
}

/**
 * Usage:
 * 1. `component('my-component', ['mc'])(MyComponent)`
 * 2. `component('my-component', {
 *   aliases: ['mc'],
 *   requiredProps: ['requiredProp'],
 *   unwantedProps: ['unwantedProp'],
 *   applyStyleSheet: false
 * })(MyComponent)`
 */
export function component(name: string, options?: string[]): <T>(fn: T) => T;
export function component(name: string, options?: NonStrictComponentOptions): <T>(fn: T) => T;
export function component(name: string, options?: string[] | NonStrictComponentOptions) {
  return <T,>(target: T): T => {
    const registered = ComponentRegistry.instance.registerComponent(
      name,
      target,
      options
        ? Array.isArray(options)
          ? {
              aliases: options,
              requiredProps: [],
              unwantedProps: [],
              applyStyleSheet: true,
              asynchorous: false
            }
          : {
              aliases: options.aliases ?? [],
              requiredProps: options.requiredProps ?? [],
              unwantedProps: options.unwantedProps ?? [],
              applyStyleSheet: options.applyStyleSheet ?? true,
              asynchorous: options.asynchorous ?? false
            }
        : {
            aliases: [],
            requiredProps: [],
            unwantedProps: [],
            applyStyleSheet: true,
            asynchorous: false
          }
    );
    return registered.render.bind(registered) as T;
  };
}

export function unregisterComponent(alias: string) {
  ComponentRegistry.instance.unregisterComponent(alias);
}

/**
 * Find a component by its alias. If not found, return a string that suggests the closest match.
 * @param alias Alias or official name.
 */
export function findComponentByAlias(alias: string): PomlComponent | string {
  return ComponentRegistry.instance.getComponent(alias, true);
}

export function findComponentByAliasOrUndefined(alias: string): PomlComponent | undefined {
  return ComponentRegistry.instance.getComponent(alias);
}

export function listComponents() {
  return ComponentRegistry.instance.listComponents();
}
