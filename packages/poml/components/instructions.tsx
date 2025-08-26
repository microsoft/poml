import * as React from 'react';
import { component, trimChildrenWhiteSpace } from 'poml/base';
import { computeSyntaxContext, Paragraph, Text } from 'poml/essentials';
import { BaseCaptionedParagraphProps, Caption, CaptionedParagraph } from './utils';

interface CustomizableCaptionParagraphProps extends BaseCaptionedParagraphProps {
  caption?: string;
}

/**
 * Specifies the role you want the language model to assume when responding.
 * Defining a role provides the model with a perspective or context,
 * such as a scientist, poet, child, or any other persona you choose.
 *
 * @param caption - The title or label for the role paragraph. Default is `Role`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `role`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <role>You are a data scientist.</role>
 * ```
 */
export const Role = component('Role')((props: React.PropsWithChildren<CustomizableCaptionParagraphProps>) => {
  const { children, caption = 'Role', captionSerialized = 'role', ...others } = props;
  return (
    <CaptionedParagraph caption={caption} captionSerialized={captionSerialized} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * Task represents the action you want the language model to perform.
 * It is a directive or instruction that you want the model to follow.
 * Task is usually not long, but rather a concise and clear statement.
 * Users can also include a list of steps or instructions to complete the task.
 *
 * @param caption - The title or label for the task paragraph. Default is `Task`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `task`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <task>Cook a recipe on how to prepare a beef dish.</task>
 * ```
 *
 * When including a list of steps:
 * ```xml
 * <task>
 *   Planning a schedule for a travel.
 *   <list>
 *     <item>Decide on the destination and plan the duration.</item>
 *     <item>Find useful information about the destination.</item>
 *     <item>Write down the schedule for each day.</item>
 *   </list>
 * </task>
 * ```
 */
export const Task = component('Task')((props: React.PropsWithChildren<CustomizableCaptionParagraphProps>) => {
  const { children, caption = 'Task', captionSerialized = 'task', ...others } = props;
  return (
    <CaptionedParagraph caption={caption} captionSerialized={captionSerialized} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * Output format deals with the format in which the model should provide the output.
 * It can be a specific format such as JSON, XML, or CSV, or a general format such as a story,
 * a diagram or steps of instructions.
 * Please refrain from specifying too complex formats that the model may not be able to generate,
 * such as a PDF file or a video.
 *
 * @param caption - The title or label for the output format paragraph. Default is `Output Format`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `outputFormat`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <output-format>Respond with a JSON without additional characters or punctuations.</output-format>
 * ```
 */
export const OutputFormat = component('OutputFormat')((
  props: React.PropsWithChildren<CustomizableCaptionParagraphProps>,
) => {
  const { children, caption = 'Output Format', captionSerialized = 'outputFormat', ...others } = props;
  return (
    <CaptionedParagraph caption={caption} captionSerialized={captionSerialized} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * StepwiseInstructions that elaborates the task by providing a list of steps or instructions.
 * Each step should be concise and clear, and the list should be easy to follow.
 *
 * @param caption - The title or label for the stepwise instructions paragraph. Default is `Stepwise Instructions`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `stepwiseInstructions`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <stepwise-instructions>
 *   <list>
 *     <item>Interpret and rewrite user's query.</item>
 *     <item>Think of a plan to solve the query.</item>
 *     <item>Generate a response based on the plan.</item>
 *   </list>
 * </stepwise-instructions>
 * ```
 */
export const StepwiseInstructions = component('StepwiseInstructions')((
  props: React.PropsWithChildren<CustomizableCaptionParagraphProps>,
) => {
  const { children, caption = 'Stepwise Instructions', captionSerialized = 'stepwiseInstructions', ...others } = props;
  return (
    <CaptionedParagraph caption={caption} captionSerialized={captionSerialized} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * Hint can be used anywhere in the prompt where you want to provide a helpful tip or explanation.
 * It is usually a short and concise statement that guides the LLM in the right direction.
 *
 * @param caption - The title or label for the hint paragraph. Default is `Hint`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `hint`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `bold`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {boolean} captionColon - Indicates whether to append a colon after the caption.
 * By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <hint>Alice first purchased 4 apples and then 3 more, so she has 7 apples in total.</hint>
 * ```
 */
export const Hint = component('Hint')((props: React.PropsWithChildren<CustomizableCaptionParagraphProps>) => {
  const { children, caption = 'Hint', captionStyle = 'bold', captionSerialized = 'hint', ...others } = props;
  return (
    <CaptionedParagraph caption={caption} captionStyle={captionStyle} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * Introducer is a paragraph before a long paragraph (usually a list of examples, steps, or instructions).
 * It serves as a context introducing what is expected to follow.
 *
 * @param caption - The title or label for the introducer paragraph. Default is `Introducer`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `introducer`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `hidden`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <introducer>Here are some examples.</introducer>
 * ```
 */
export const Introducer = component('Introducer')((
  props: React.PropsWithChildren<CustomizableCaptionParagraphProps>,
) => {
  const {
    children,
    caption = 'Introducer',
    captionStyle = 'hidden',
    captionSerialized = 'introducer',
    ...others
  } = props;
  return (
    <CaptionedParagraph caption={caption} captionStyle={captionStyle} {...others}>
      {children}
    </CaptionedParagraph>
  );
});

interface ExampleSetProps extends CustomizableCaptionParagraphProps {
  chat?: boolean;
  introducer?: string;
}

const ChatRenderedExampleContext = React.createContext(true);

/**
 * Example set (`<examples>`) is a collection of examples that are usually presented in a list.
 * With the example set, you can manage multiple examples under a single title and optionally an introducer,
 * as well as the same `chat` format.
 * You can also choose to use `<example>` purely without example set.
 *
 * @param caption - The title or label for the example set paragraph. Default is `Examples`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `examples`.
 * @param {boolean} chat - Indicates whether the examples should be rendered in chat format.
 * By default, it's `true` for "markup" syntaxes and `false` for "serializer" syntaxes.
 * @param introducer - An optional introducer text to be displayed before the examples.
 * For example, `Here are some examples:`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <examples chat={{true}}>
 *   <example>
 *     <input>What is the capital of France?</input>
 *     <output>Paris</output>
 *   </example>
 *   <example>
 *     <input>What is the capital of Germany?</input>
 *     <output>Berlin</output>
 *   </example>
 * </examples>
 * ```
 */
export const ExampleSet = component('ExampleSet', ['examples'])((props: React.PropsWithChildren<ExampleSetProps>) => {
  const { children, caption = 'Examples', captionSerialized = 'examples', chat, introducer, ...others } = props;
  const presentation = computeSyntaxContext(props);
  const chatComputed = chat ?? presentation === 'markup';
  const examples = (
    <ChatRenderedExampleContext.Provider value={chatComputed}>
      {trimChildrenWhiteSpace(children, props)}
    </ChatRenderedExampleContext.Provider>
  );
  return (
    <CaptionedParagraph caption={caption} captionSerialized={captionSerialized} {...others}>
      {introducer && presentation === 'markup' ? <Introducer>{introducer}</Introducer> : null}
      {examples}
    </CaptionedParagraph>
  );
});

interface ExampleProps extends CustomizableCaptionParagraphProps {
  chat?: boolean;
}

/**
 * Example is useful for providing a context, helping the model to understand what kind of inputs and outputs are expected.
 * It can also be used to demonstrate the desired output style, clarifying the structure, tone, or level of detail in the response.
 *
 * @param caption - The title or label for the example paragraph. Default is `Example`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `example`.
 * @param captionStyle - Determines the style of the caption, applicable only for "markup" syntaxes. Default is `hidden`.
 * Options include `header`, `bold`, `plain`, or `hidden`.
 * @param {boolean} chat - Indicates whether the example should be rendered in chat format.
 * When used in a example set (`<examples>`), this is inherited from the example set.
 * Otherwise, it defaults to `false` for "serializer" syntaxes and `true` for "markup" syntaxes.
 * @param captionTextTransform - Specifies text transformation for the caption, applicable only for "markup" syntaxes.
 * Options are `upper`, `lower`, `capitalize`, or `none`. Default is `none`.
 * @param {boolean} captionColon - Indicates whether to append a colon after the caption.
 * By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <example>
 *   <input>What is the capital of France?</input>
 *   <output>Paris</output>
 * </example>
 * ```
 *
 * ```xml
 * <task>Summarize the following passage in a single sentence.</task>
 * <example>
 *   <input caption="Passage">The sun provides energy for life on Earth through processes like photosynthesis.</input>
 *   <output caption="Summary">The sun is essential for energy and life processes on Earth.</output>
 * </example>
 * ```
 */
export const Example = component('Example')((props: React.PropsWithChildren<ExampleProps>) => {
  const presentation = computeSyntaxContext(props);
  const {
    children,
    caption = 'Example',
    captionSerialized = 'example',
    captionStyle = 'hidden',
    chat,
    ...others
  } = props;
  if (presentation === 'markup') {
    return (
      <CaptionedParagraph
        caption={caption}
        captionSerialized={captionSerialized}
        captionStyle={captionStyle}
        {...others}>
        {chat !== undefined ? (
          <ChatRenderedExampleContext.Provider value={chat}>
            {trimChildrenWhiteSpace(children, props)}
          </ChatRenderedExampleContext.Provider>
        ) : (
          children
        )}
      </CaptionedParagraph>
    );
  } else {
    return <Text {...others}>{children}</Text>;
  }
});

/**
 * ExampleInput (`<input>`) is a paragraph that represents an example input.
 * By default, it's spoken by a human speaker in a chat context, but you can manually specify the speaker.
 *
 * @param caption - The title or label for the example input paragraph. Default is `Input`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `input`.
 * @param speaker - The speaker for the example input. Default is `human` if chat context is enabled (see `<example>`).
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {boolean} captionColon - Indicates whether to append a colon after the caption.
 * By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <input>What is the capital of France?</input>
 * ```
 *
 * When used with a template:
 *
 * ```xml
 * <input>What is the capital of {{country}}?</input>
 * ```
 */
export const ExampleInput = component('ExampleInput', ['input'])((
  props: React.PropsWithChildren<CustomizableCaptionParagraphProps>,
) => {
  const { children, caption = 'Input', captionSerialized = 'input', captionStyle, speaker, ...others } = props;
  const speakerFromContext = speaker || (React.useContext(ChatRenderedExampleContext) ? 'human' : undefined);
  const captionStyleForContext = captionStyle || (React.useContext(ChatRenderedExampleContext) ? 'hidden' : 'bold');
  return (
    <CaptionedParagraph
      caption={caption}
      captionSerialized={captionSerialized}
      captionStyle={captionStyleForContext}
      speaker={speakerFromContext}
      {...others}>
      {children}
    </CaptionedParagraph>
  );
});

/**
 * ExampleOutput (`<output>`) is a paragraph that represents an example output.
 * By default, it's spoken by a AI speaker in a chat context, but you can manually specify the speaker.
 *
 * @param caption - The title or label for the example output paragraph. Default is `Output`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `output`.
 * @param speaker - The speaker for the example output. Default is `ai` if chat context is enabled (see `<example>`).
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {boolean} captionColon - Indicates whether to append a colon after the caption.
 * By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <output>The capital of France is Paris.</output>
 * ```
 *
 * When used with a template:
 *
 * ```xml
 * <output>The capital of {{country}} is {{capital}}.</output>
 * ```
 */
export const ExampleOutput = component('ExampleOutput', ['output'])((
  props: React.PropsWithChildren<CustomizableCaptionParagraphProps>,
) => {
  const { children, caption = 'Output', captionSerialized = 'output', captionStyle, speaker, ...others } = props;
  const speakerFromContext = speaker || (React.useContext(ChatRenderedExampleContext) ? 'ai' : undefined);
  const captionStyleForContext = captionStyle || (React.useContext(ChatRenderedExampleContext) ? 'hidden' : 'bold');
  return (
    <CaptionedParagraph
      caption={caption}
      captionSerialized={captionSerialized}
      captionStyle={captionStyleForContext}
      speaker={speakerFromContext}
      {...others}>
      {children}
    </CaptionedParagraph>
  );
});

interface QuestionProps extends BaseCaptionedParagraphProps {
  questionCaption?: string;
  answerCaption?: string;
}

/**
 * Question (`<qa>`) is actually a combination of a question and a prompt for the answer.
 * It's usually used at the end of a prompt to ask a question.
 * The question is followed by a prompt for answer (e.g., `Answer:`) to guide the model to respond.
 *
 * @param questionCaption - The title or label for the question paragraph. Default is `Question`.
 * @param answerCaption - The title or label for the answer paragraph. Default is `Answer`.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes. Default is `question`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `bold`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <qa>What is the capital of France?</qa>
 * ```
 */
export const Question = component('Question', ['qa'])((props: React.PropsWithChildren<QuestionProps>) => {
  const presentation = computeSyntaxContext(props);
  const {
    children,
    questionCaption = 'Question',
    answerCaption = 'Answer',
    captionSerialized = 'question',
    captionStyle = 'bold',
    ...others
  } = props;
  return (
    <Paragraph>
      <CaptionedParagraph
        caption={questionCaption}
        captionSerialized={captionSerialized}
        captionStyle={captionStyle}
        {...others}>
        {children}
      </CaptionedParagraph>
      {answerCaption && presentation === 'markup' ? (
        <Caption caption={answerCaption} captionStyle={captionStyle} captionTailingSpace={false} {...others} />
      ) : null}
    </Paragraph>
  );
});
