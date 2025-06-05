# This file is auto-generated from component documentation.
# Do not edit manually. Run `npm run build-comment` to regenerate.

from typing import Optional, Any, Union, List, Dict
# from numbers import Number # For more specific number types if needed

class _TagLib:

    def tag(self, tag_name: str, **kwargs: Any) -> Any:
        """Helper method to create a tag with the given name and attributes.
        Implemented by subclasses.
        """
        raise NotImplementedError("This method should be implemented by subclasses.")

    def document(
        self,
        src: Optional[str] = None,
        buffer: Optional[bytes] = None,
        base64: Optional[str] = None,
        parser: Optional[str] = None,
        multimedia: Optional[bool] = None,
        selectedPages: Optional[str] = None,
        **kwargs: Any,
    ):
        """Displaying an external document like PDF, TXT or DOCX.

        Args:
            src (Optional[str]): The source file to read the data from. This must be provided if records is not provided.
            buffer (Optional[bytes]): Document data buffer. Recommended to use `src` instead unless you want to use a string.
            base64 (Optional[str]): Base64 encoded string of the document data. Mutually exclusive with `src` and `buffer`.
            parser (Optional[str]): The parser to use for reading the data. If not provided, it will be inferred from the file extension. Choices: `"auto"`, `"pdf"`, `"docx"`, `"txt"`.
            multimedia (Optional[bool]): If true, the multimedias will be displayed. If false, the alt strings will be displayed at best effort. Default is `true`. Default is `"true"`.
            selectedPages (Optional[str]): The pages to be selected. This is only available **for PDF documents**. If not provided, all pages will be selected.
            You can use a string like `2` to specify a single page, or slice like `2:4` to specify a range of pages (2 inclusive, 4 exclusive).
            The pages selected are **0-indexed**. Negative indexes like `-1` is not supported here.

        Example:
            To display a Word document without including the real multimedia:
            ```xml
            <Document src="sample.docx" multimedia="false"/>
            ```
        """
        return self.tag(
            tag_name="Document",
            src=src,
            buffer=buffer,
            base64=base64,
            parser=parser,
            multimedia=multimedia,
            selectedPages=selectedPages,
            **kwargs,
        )
    
    def role(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Specifies the role you want the language model to assume when responding.
        Defining a role provides the model with a perspective or context,
        such as a scientist, poet, child, or any other persona you choose.

        Args:
            caption (Optional[str]): The title or label for the role paragraph. Default is `Role`. Default is `"Role"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `role`. Default is `"role"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <role>You are a data scientist.</role>
            ```
        """
        return self.tag(
            tag_name="Role",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def task(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Task represents the action you want the language model to perform.
        It is a directive or instruction that you want the model to follow.
        Task is usually not long, but rather a concise and clear statement.
        Users can also include a list of steps or instructions to complete the task.

        Args:
            caption (Optional[str]): The title or label for the task paragraph. Default is `Task`. Default is `"Task"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `task`. Default is `"task"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <task>Cook a recipe on how to prepare a beef dish.</task>
            ```
            
            When including a list of steps:
            ```xml
            <task>
              Planning a schedule for a travel.
              <list>
                <item>Decide on the destination and plan the duration.</item>
                <item>Find useful information about the destination.</item>
                <item>Write down the schedule for each day.</item>
              </list>
            </task>
            ```
        """
        return self.tag(
            tag_name="Task",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def output_format(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Output format deals with the format in which the model should provide the output.
        It can be a specific format such as JSON, XML, or CSV, or a general format such as a story,
        a diagram or steps of instructions.
        Please refrain from specifying too complex formats that the model may not be able to generate,
        such as a PDF file or a video.

        Args:
            caption (Optional[str]): The title or label for the output format paragraph. Default is `Output Format`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `outputFormat`. Default is `"outputFormat"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <output-format>Respond with a JSON without additional characters or punctuations.</output-format>
            ```
        """
        return self.tag(
            tag_name="OutputFormat",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def stepwise_instructions(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """StepwiseInstructions that elaborates the task by providing a list of steps or instructions.
        Each step should be concise and clear, and the list should be easy to follow.

        Args:
            caption (Optional[str]): The title or label for the stepwise instructions paragraph. Default is `Stepwise Instructions`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `stepwiseInstructions`. Default is `"stepwiseInstructions"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <stepwise-instructions>
              <list>
                <item>Interpret and rewrite user's query.</item>
                <item>Think of a plan to solve the query.</item>
                <item>Generate a response based on the plan.</item>
              </list>
            </stepwise-instructions>
            ```
        """
        return self.tag(
            tag_name="StepwiseInstructions",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def hint(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionColon: Optional[bool] = None,
        **kwargs: Any,
    ):
        """Hint can be used anywhere in the prompt where you want to provide a helpful tip or explanation.
        It is usually a short and concise statement that guides the LLM in the right direction.

        Args:
            caption (Optional[str]): The title or label for the hint paragraph. Default is `Hint`. Default is `"Hint"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `hint`. Default is `"hint"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `bold`. Default is `"bold"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionColon (Optional[bool]): Indicates whether to append a colon after the caption.
            By default, this is true for `bold` or `plain` captionStyle, and false otherwise.

        Example:
            ```xml
            <hint>Alice first purchased 4 apples and then 3 more, so she has 7 apples in total.</hint>
            ```
        """
        return self.tag(
            tag_name="Hint",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionColon=captionColon,
            **kwargs,
        )
    
    def introducer(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Introducer is a paragraph before a long paragraph (usually a list of examples, steps, or instructions).
        It serves as a context introducing what is expected to follow.

        Args:
            caption (Optional[str]): The title or label for the introducer paragraph. Default is `Introducer`. Default is `"Introducer"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `introducer`. Default is `"introducer"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `hidden`. Default is `"hidden"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <introducer>Here are some examples.</introducer>
            ```
        """
        return self.tag(
            tag_name="Introducer",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def example_set(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        chat: Optional[bool] = None,
        introducer: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Example set (`<examples>`) is a collection of examples that are usually presented in a list.
        With the example set, you can manage multiple examples under a single title and optionally an introducer,
        as well as the same `chat` format.
        You can also choose to use `<example>` purely without example set.

        Args:
            caption (Optional[str]): The title or label for the example set paragraph. Default is `Examples`. Default is `"Examples"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `examples`. Default is `"examples"`.
            chat (Optional[bool]): Indicates whether the examples should be rendered in chat format.
            By default, it's `true` for "markup" syntaxes and `false` for "serializer" syntaxes.
            introducer (Optional[str]): An optional introducer text to be displayed before the examples.
            For example, `Here are some examples:`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <examples chat={{true}}>
              <example>
                <input>What is the capital of France?</input>
                <output>Paris</output>
              </example>
              <example>
                <input>What is the capital of Germany?</input>
                <output>Berlin</output>
              </example>
            </examples>
            ```
        """
        return self.tag(
            tag_name="ExampleSet",
            caption=caption,
            captionSerialized=captionSerialized,
            chat=chat,
            introducer=introducer,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def example(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        chat: Optional[bool] = None,
        captionTextTransform: Optional[str] = None,
        captionColon: Optional[bool] = None,
        **kwargs: Any,
    ):
        """Example is useful for providing a context, helping the model to understand what kind of inputs and outputs are expected.
        It can also be used to demonstrate the desired output style, clarifying the structure, tone, or level of detail in the response.

        Args:
            caption (Optional[str]): The title or label for the example paragraph. Default is `Example`. Default is `"Example"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `example`. Default is `"example"`.
            captionStyle (Optional[str]): Determines the style of the caption, applicable only for "markup" syntaxes. Default is `hidden`.
            Options include `header`, `bold`, `plain`, or `hidden`. Default is `"hidden"`.
            chat (Optional[bool]): Indicates whether the example should be rendered in chat format.
            When used in a example set (`<examples>`), this is inherited from the example set.
            Otherwise, it defaults to `false` for "serializer" syntaxes and `true` for "markup" syntaxes.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes.
            Options are `upper`, `lower`, `capitalize`, or `none`. Default is `none`. Default is `"none"`.
            captionColon (Optional[bool]): Indicates whether to append a colon after the caption.
            By default, this is true for `bold` or `plain` captionStyle, and false otherwise.

        Example:
            ```xml
            <example>
              <input>What is the capital of France?</input>
              <output>Paris</output>
            </example>
            ```
            
            ```xml
            <task>Summarize the following passage in a single sentence.</task>
            <example>
              <input caption="Passage">The sun provides energy for life on Earth through processes like photosynthesis.</input>
              <output caption="Summary">The sun is essential for energy and life processes on Earth.</output>
            </example>
            ```
        """
        return self.tag(
            tag_name="Example",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            chat=chat,
            captionTextTransform=captionTextTransform,
            captionColon=captionColon,
            **kwargs,
        )
    
    def example_input(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        speaker: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionColon: Optional[bool] = None,
        **kwargs: Any,
    ):
        """ExampleInput (`<input>`) is a paragraph that represents an example input.
        By default, it's spoken by a human speaker in a chat context, but you can manually specify the speaker.

        Args:
            caption (Optional[str]): The title or label for the example input paragraph. Default is `Input`. Default is `"Input"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `input`. Default is `"input"`.
            speaker (Optional[str]): The speaker for the example input. Default is `human` if chat context is enabled (see `<example>`). Default is `"human"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`. Default is `"hidden"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionColon (Optional[bool]): Indicates whether to append a colon after the caption.
            By default, this is true for `bold` or `plain` captionStyle, and false otherwise.

        Example:
            ```xml
            <input>What is the capital of France?</input>
            ```
            
            When used with a template:
            
            ```xml
            <input>What is the capital of {{country}}?</input>
            ```
        """
        return self.tag(
            tag_name="ExampleInput",
            caption=caption,
            captionSerialized=captionSerialized,
            speaker=speaker,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionColon=captionColon,
            **kwargs,
        )
    
    def example_output(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        speaker: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionColon: Optional[bool] = None,
        **kwargs: Any,
    ):
        """ExampleOutput (`<output>`) is a paragraph that represents an example output.
        By default, it's spoken by a AI speaker in a chat context, but you can manually specify the speaker.

        Args:
            caption (Optional[str]): The title or label for the example output paragraph. Default is `Output`. Default is `"Output"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `output`. Default is `"output"`.
            speaker (Optional[str]): The speaker for the example output. Default is `ai` if chat context is enabled (see `<example>`). Default is `"ai"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`. Default is `"hidden"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionColon (Optional[bool]): Indicates whether to append a colon after the caption.
            By default, this is true for `bold` or `plain` captionStyle, and false otherwise.

        Example:
            ```xml
            <output>The capital of France is Paris.</output>
            ```
            
            When used with a template:
            
            ```xml
            <output>The capital of {{country}} is {{capital}}.</output>
            ```
        """
        return self.tag(
            tag_name="ExampleOutput",
            caption=caption,
            captionSerialized=captionSerialized,
            speaker=speaker,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionColon=captionColon,
            **kwargs,
        )
    
    def question(
        self,
        questionCaption: Optional[str] = None,
        answerCaption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """Question (`<qa>`) is actually a combination of a question and a prompt for the answer.
        It's usually used at the end of a prompt to ask a question.
        The question is followed by a prompt for answer (e.g., `Answer:`) to guide the model to respond.

        Args:
            questionCaption (Optional[str]): The title or label for the question paragraph. Default is `Question`. Default is `"Question"`.
            answerCaption (Optional[str]): The title or label for the answer paragraph. Default is `Answer`. Default is `"Answer"`.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes. Default is `question`. Default is `"question"`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `bold`. Default is `"bold"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <qa>What is the capital of France?</qa>
            ```
        """
        return self.tag(
            tag_name="Question",
            questionCaption=questionCaption,
            answerCaption=answerCaption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def system_message(
        self,
        **kwargs: Any,
    ):
        """Wrap the contents in a system message.


        Example:
            ```xml
            <system-msg>Answer concisely.</system-msg>
            ```
        """
        return self.tag(
            tag_name="SystemMessage",
            **kwargs,
        )
    
    def human_message(
        self,
        **kwargs: Any,
    ):
        """Wrap the contents in a user message.


        Example:
            ```xml
            <user-msg>What is the capital of France?</user-msg>
            ```
        """
        return self.tag(
            tag_name="HumanMessage",
            **kwargs,
        )
    
    def ai_message(
        self,
        **kwargs: Any,
    ):
        """Wrap the contents in a AI message.


        Example:
            ```xml
            <ai-msg>Paris</ai-msg>
            ```
        """
        return self.tag(
            tag_name="AiMessage",
            **kwargs,
        )
    
    def message_content(
        self,
        content: Optional[Any] = None,
        **kwargs: Any,
    ):
        """Display a message content.

        Args:
            content (Optional[Any]): The content of the message. It can be a string, or an array of strings and multimedia content.

        Example:
            ```xml
            <msg-content content="What is the capital of France?" />
            ```
        """
        return self.tag(
            tag_name="MessageContent",
            content=content,
            **kwargs,
        )
    
    def conversation(
        self,
        messages: Optional[Any] = None,
        selectedMessages: Optional[str] = None,
        **kwargs: Any,
    ):
        """Display a conversation between system, human and AI.

        Args:
            messages (Optional[Any]): A list of message. Each message should have a `speaker` and a `content` field.
            selectedMessages (Optional[str]): The messages to be selected. If not provided, all messages will be selected.
            You can use a string like `2` to specify a single message, or slice like `2:4` to specify a range of messages (2 inclusive, 4 exclusive).
            Or use `-6:` to select the last 6 messages.

        Example:
            ```xml
            <conversation messages="{{[{ speaker: 'human', content: 'What is the capital of France?' }, { speaker: 'ai', content: 'Paris' }]}}" />
            ```
        """
        return self.tag(
            tag_name="Conversation",
            messages=messages,
            selectedMessages=selectedMessages,
            **kwargs,
        )
    
    def table(
        self,
        syntax: Optional[str] = None,
        records: Optional[Any] = None,
        columns: Optional[Any] = None,
        src: Optional[str] = None,
        parser: Optional[str] = None,
        selectedColumns: Optional[Any] = None,
        selectedRecords: Optional[Any] = None,
        maxRecords: Optional[int] = None,
        maxColumns: Optional[int] = None,
        **kwargs: Any,
    ):
        """Displaying a table with records and columns.

        Args:
            syntax (Optional[str]): The output syntax of the content. Choices: `"markdown"`, `"html"`, `"json"`, `"text"`, `"csv"`, `"tsv"`, `"xml"`.
            records (Optional[Any]): A list, each element is an object / dictionary / list of elements. The keys are the fields and the values are the data in cells.
            columns (Optional[Any]): A list of column definitions. Each column definition is an object with keys "field", "header", and "description".
            The field is the key in the record object, the header is displayed in the top row, and the description is meant to be an explanation.
            Columns are optional. If not provided, the columns are inferred from the records.
            src (Optional[str]): The source file to read the data from. This must be provided if records is not provided.
            parser (Optional[str]): The parser to use for reading the data. If not provided, it will be inferred from the file extension. Choices: `"auto"`, `"csv"`, `"tsv"`, `"excel"`, `"json"`, `"jsonl"`.
            selectedColumns (Optional[Any]): The selected columns to display. If not provided, all columns will be displayed.
            It should be an array of column field names, e.g. `["name", "age"]`; or a string like `2:4` to select columns 2 (inclusive) to 4 (exclusive).
            There is a special column name called `index` which is the enumeration of the records starting from 0.
            You can also use a special value called `+index` to add the index column to the original table.
            selectedRecords (Optional[Any]): The selected records to display. If not provided, all records will be displayed.
            It should be an array of record indices, e.g. `[0, 1]`; or a string like `2:4` to select records 2 (inclusive) to 4 (exclusive).
            maxRecords (Optional[int]): The maximum number of records to display. If not provided, all records will be displayed.
            maxColumns (Optional[int]): The maximum number of columns to display. If not provided, all columns will be displayed.

        Example:
            ```xml
            <table records="{{[{ name: 'Alice', age: 20 }, { name: 'Bob', age: 30 }]}}" />
            ```
            
            To import an excel file, and display the first 10 records in csv syntax:
            
            ```xml
            <table src="data.xlsx" parser="excel" maxRecords="10" syntax="csv" />
            ```
        """
        return self.tag(
            tag_name="Table",
            syntax=syntax,
            records=records,
            columns=columns,
            src=src,
            parser=parser,
            selectedColumns=selectedColumns,
            selectedRecords=selectedRecords,
            maxRecords=maxRecords,
            maxColumns=maxColumns,
            **kwargs,
        )
    
    def tree(
        self,
        syntax: Optional[str] = None,
        items: Optional[List[Any]] = None,
        showContent: Optional[bool] = None,
        **kwargs: Any,
    ):
        """Renders a tree structure in various formats.

        Args:
            syntax (Optional[str]): The output syntax to use for rendering the tree Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"text"`, `"xml"`.
            items (Optional[List[Any]]): Array of tree items to render
            showContent (Optional[bool]): Whether to show content values of tree items

        Example:
            ```xml
            <Tree items={treeData} syntax="markdown" showContent={true} />
            ```
        """
        return self.tag(
            tag_name="Tree",
            syntax=syntax,
            items=items,
            showContent=showContent,
            **kwargs,
        )
    
    def folder(
        self,
        syntax: Optional[str] = None,
        src: Optional[str] = None,
        data: Optional[List[Any]] = None,
        filter: Optional[str] = None,
        maxDepth: Optional[int] = None,
        showContent: Optional[bool] = None,
        **kwargs: Any,
    ):
        """Displays a directory structure as a tree.

        Args:
            syntax (Optional[str]): The output syntax of the content. Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"text"`, `"xml"`.
            src (Optional[str]): The source directory path to display.
            data (Optional[List[Any]]): Alternative to src, directly provide tree data structure.
            filter (Optional[str]): A regular expression to filter files.
              The regex is applied to the folder names and file names (not the full path).
              Directories are included by default unless all of their nested content is filtered out.
              When filter is on, empty directories will not be shown.
            maxDepth (Optional[int]): Maximum depth of directory traversal. Default is 3.
            showContent (Optional[bool]): Whether to show file contents. Default is false.

        Example:
            To display a directory structure with a filter for Python files:
            ```xml
            <folder src="project_dir" filter=".*\\.py$" maxDepth="3" />
            ```
        """
        return self.tag(
            tag_name="Folder",
            syntax=syntax,
            src=src,
            data=data,
            filter=filter,
            maxDepth=maxDepth,
            showContent=showContent,
            **kwargs,
        )
    
    def captioned_paragraph(
        self,
        caption: Optional[str] = None,
        captionSerialized: Optional[str] = None,
        captionStyle: Optional[str] = None,
        captionTextTransform: Optional[str] = None,
        captionEnding: Optional[str] = None,
        **kwargs: Any,
    ):
        """CaptionedParagraph (`<cp>` for short) creates a paragraph with a customized caption title.

        Args:
            caption (Optional[str]): The title or label for the paragraph. Required.
            captionSerialized (Optional[str]): The serialized version of the caption when using "serializer" syntaxes.
              By default, it's same as `caption`.
            captionStyle (Optional[str]): Determines the style of the caption,
            applicable only for "markup" syntaxes. Default is `header`. Default is `"header"`. Choices: `"header"`, `"bold"`, `"plain"`, `"hidden"`.
            captionTextTransform (Optional[str]): Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`. Default is `"none"`. Choices: `"upper"`, `"level"`, `"capitalize"`, `"none"`.
            captionEnding (Optional[str]): A caption can ends with a colon, a newline or simply nothing.
            If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise. Choices: `"colon"`, `"newline"`, `"colon-newline"`, `"none"`.

        Example:
            ```xml
            <cp caption="Constraints">
              <list>
                <item>Do not exceed 1000 tokens.</item>
                <item>Please use simple words.</item>
              </list>
            </cp>
            ```
        """
        return self.tag(
            tag_name="CaptionedParagraph",
            caption=caption,
            captionSerialized=captionSerialized,
            captionStyle=captionStyle,
            captionTextTransform=captionTextTransform,
            captionEnding=captionEnding,
            **kwargs,
        )
    
    def webpage(
        self,
        url: Optional[str] = None,
        src: Optional[str] = None,
        buffer: Optional[bytes] = None,
        base64: Optional[str] = None,
        extractText: Optional[bool] = None,
        selector: Optional[str] = None,
        **kwargs: Any,
    ):
        """Displays content from a webpage.

        Args:
            url (Optional[str]): The URL of the webpage to fetch and display.
            src (Optional[str]): Local file path to an HTML file to display.
            buffer (Optional[bytes]): HTML content as string or buffer.
            base64 (Optional[str]): Base64 encoded HTML content.
            extractText (Optional[bool]): Whether to extract plain text content (true) or convert HTML to structured POML (false). Default is false.
            selector (Optional[str]): CSS selector to extract specific content from the page (e.g., "article", ".content", "#main"). Default is "body".

        Example:
            Display content from a URL:
            ```xml
            <webpage url="https://example.com" />
            ```
            
            Extract only specific content using a selector:
            ```xml
            <webpage url="https://example.com" selector="main article" />
            ```
            
            Convert HTML to structured POML components:
            ```xml
            <webpage url="https://example.com" extractText="false" />
            ```
        """
        return self.tag(
            tag_name="Webpage",
            url=url,
            src=src,
            buffer=buffer,
            base64=base64,
            extractText=extractText,
            selector=selector,
            **kwargs,
        )
    
    def text(
        self,
        syntax: Optional[str] = None,
        className: Optional[str] = None,
        speaker: Optional[str] = None,
        name: Optional[str] = None,
        type: Optional[str] = None,
        writerOptions: Optional[Any] = None,
        **kwargs: Any,
    ):
        """Text (`<text>`, `<poml>`) is a wrapper for any contents.
        By default, it uses `markdown` syntax and writes the contents within it directly to the output.
        When used with "markup" syntaxes, it renders a standalone section preceded and followed by one blank line.
        It's mostly used in the root element of a prompt, but it should also work in any other places.
        This component will be automatically added as a wrapping root element if it's not provided:
        1. If the first element is pure text contents, `<poml syntax="text">` will be added.
        2. If the first element is a POML component, `<poml syntax="markdown">` will be added.

        Args:
            syntax (Optional[str]): The syntax of the content. Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"xml"`, `"text"`.
            className (Optional[str]): A class name for quickly styling the current block with stylesheets.
            speaker (Optional[str]): The speaker of the content. By default, it's determined by the context and the content. Choices: `"human"`, `"ai"`, `"system"`.
            name (Optional[str]): The name of the content, used in serialization.
            type (Optional[str]): The type of the content, used in serialization.
            writerOptions (Optional[Any]): An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

        Example:
            ```xml
            <poml syntax="text">
            Contents of the whole prompt.
            
            1. Your customized list.
            2. You don't need to know anything about POML.
            </poml>
            ```
            
            To render the whole prompt in markdown syntax with a "human" speaker:
            
            ```xml
            <poml syntax="markdown" speaker="human">
              <p>You are a helpful assistant.</p>
              <p>What is the capital of France?</p>
            </poml>
            ```
        """
        return self.tag(
            tag_name="Text",
            syntax=syntax,
            className=className,
            speaker=speaker,
            name=name,
            type=type,
            writerOptions=writerOptions,
            **kwargs,
        )
    
    def paragraph(
        self,
        blankLine: Optional[bool] = None,
        **kwargs: Any,
    ):
        """Paragraph (`<p>`) is a standalone section preceded by and followed by two blank lines in markup syntaxes.
        It's mostly used for text contents.

        Args:
            blankLine (Optional[bool]): Whether to add one more blank line (2 in total) before and after the paragraph.

        Example:
            ```xml
            <p>Contents of the paragraph.</p>
            ```
        """
        return self.tag(
            tag_name="Paragraph",
            blankLine=blankLine,
            **kwargs,
        )
    
    def inline(
        self,
        syntax: Optional[str] = None,
        className: Optional[str] = None,
        speaker: Optional[str] = None,
        writerOptions: Optional[Any] = None,
        **kwargs: Any,
    ):
        """Inline (`<span>`) is a container for inline content.
        When used with markup syntaxes, it wraps text in an inline style, without any preceding or following blank characters.
        In serializer syntaxes, it's treated as a generic value.
        Inline elements are not designed to be used alone (especially in serializer syntaxes).
        One might notice problematic renderings (e.g., speaker not applied) when using it alone.

        Args:
            syntax (Optional[str]): The syntax of the content. Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"xml"`, `"text"`.
            className (Optional[str]): A class name for quickly styling the current block with stylesheets.
            speaker (Optional[str]): The speaker of the content. By default, it's determined by the context and the content. Choices: `"human"`, `"ai"`, `"system"`.
            writerOptions (Optional[Any]): An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

        Example:
            ```xml
            <p>I'm listening to <span>music</span> right now.</p>
            ```
        """
        return self.tag(
            tag_name="Inline",
            syntax=syntax,
            className=className,
            speaker=speaker,
            writerOptions=writerOptions,
            **kwargs,
        )
    
    def newline(
        self,
        newLineCount: Optional[float] = None,
        **kwargs: Any,
    ):
        """Newline (`<br>`) explicitly adds a line break, primarily in markup syntaxes.
        In serializer syntaxes, it's ignored.

        Args:
            newLineCount (Optional[float]): The number of linebreaks to add.

        Example:
            ```xml
            <br />
            ```
        """
        return self.tag(
            tag_name="Newline",
            newLineCount=newLineCount,
            **kwargs,
        )
    
    def header(
        self,
        **kwargs: Any,
    ):
        """Header (`<h>`) renders headings in markup syntaxes.
        It's commonly used to highlight titles or section headings.
        The header level will be automatically computed based on the context.
        Use SubContent (`<section>`) for nested content.


        Example:
            ```xml
            <Header syntax="markdown">Section Title</Header>
            ```
        """
        return self.tag(
            tag_name="Header",
            **kwargs,
        )
    
    def sub_content(
        self,
        **kwargs: Any,
    ):
        """SubContent (`<section>`) renders nested content, often following a header.
        The headers within the section will be automatically adjusted to a lower level.


        Example:
            ```xml
            <h>Section Title</h>
            <section>
              <h>Sub-section Title</h>  <!-- Nested header -->
              <p>Sub-section details</p>
            </section>
            ```
        """
        return self.tag(
            tag_name="SubContent",
            **kwargs,
        )
    
    def bold(
        self,
        **kwargs: Any,
    ):
        """Bold (`<b>`) emphasizes text in a bold style when using markup syntaxes.


        Example:
            ```xml
            <p><b>Task:</b> Do something.</p>
            ```
        """
        return self.tag(
            tag_name="Bold",
            **kwargs,
        )
    
    def italic(
        self,
        **kwargs: Any,
    ):
        """Italic (`<i>`) emphasizes text in an italic style when using markup syntaxes.


        Example:
            ```xml
            Your <i>italicized</i> text.
            ```
        """
        return self.tag(
            tag_name="Italic",
            **kwargs,
        )
    
    def strikethrough(
        self,
        **kwargs: Any,
    ):
        """Strikethrough (`<s>`, `<strike>`) indicates removed or invalid text in markup syntaxes.


        Example:
            ```xml
            <s>This messages is removed.</s>
            ```
        """
        return self.tag(
            tag_name="Strikethrough",
            **kwargs,
        )
    
    def underline(
        self,
        **kwargs: Any,
    ):
        """Underline (`<u>`) draws a line beneath text in markup syntaxes.


        Example:
            ```xml
            This text is <u>underlined</u>.
            ```
        """
        return self.tag(
            tag_name="Underline",
            **kwargs,
        )
    
    def code(
        self,
        inline: Optional[bool] = None,
        lang: Optional[str] = None,
        **kwargs: Any,
    ):
        """Code is used to represent code snippets or inline code in markup syntaxes.

        Args:
            inline (Optional[bool]): Whether to render code inline or as a block. Default is `true`. Default is `"true"`.
            lang (Optional[str]): The language of the code snippet.

        Example:
            ```xml
            <code inline="true">const x = 42;</code>
            ```
            
            ```xml
            <code lang="javascript">
            const x = 42;
            </code>
            ```
        """
        return self.tag(
            tag_name="Code",
            inline=inline,
            lang=lang,
            **kwargs,
        )
    
    def list(
        self,
        listStyle: Optional[str] = None,
        **kwargs: Any,
    ):
        """List (`<list>`) is a container for multiple ListItem (`<item>`) elements.
        When used with markup syntaxes, a bullet or numbering is added.

        Args:
            listStyle (Optional[str]): The style for the list marker, such as dash or star. Default is `dash`. Default is `"dash"`. Choices: `"star"`, `"dash"`, `"plus"`, `"decimal"`, `"latin"`.

        Example:
            ```xml
            <list listStyle="decimal">
              <item>Item 1</item>
              <item>Item 2</item>
            </list>
            ```
        """
        return self.tag(
            tag_name="List",
            listStyle=listStyle,
            **kwargs,
        )
    
    def list_item(
        self,
        **kwargs: Any,
    ):
        """ListItem (`<item>`) is an item within a List component.
        In markup mode, it is rendered with the specified bullet or numbering style.


        Example:
            ```xml
            <list listStyle="decimal">
              <item blankLine="true">Item 1</item>
              <item>Item 2</item>
            </list>
            ```
        """
        return self.tag(
            tag_name="ListItem",
            **kwargs,
        )
    
    def object(
        self,
        syntax: Optional[str] = None,
        data: Optional[Any] = None,
        **kwargs: Any,
    ):
        """Object (`<obj>`, `<dataObj>`) displays external data or object content.
        When in serialize mode, it's serialized according to the given serializer.

        Args:
            syntax (Optional[str]): The syntax or serializer of the content. Default is `json`. Default is `"json"`. Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"xml"`.
            data (Optional[Any]): The data object to render.

        Example:
            ```xml
            <Object syntax="json" data="{ key: 'value' }" />
            ```
        """
        return self.tag(
            tag_name="Object",
            syntax=syntax,
            data=data,
            **kwargs,
        )
    
    def image(
        self,
        src: Optional[str] = None,
        alt: Optional[str] = None,
        base64: Optional[str] = None,
        type: Optional[str] = None,
        position: Optional[str] = None,
        maxWidth: Optional[int] = None,
        maxHeight: Optional[int] = None,
        resize: Optional[float] = None,
        syntax: Optional[str] = None,
        **kwargs: Any,
    ):
        """Image (`<img>`) displays an image in the content.
        Alternatively, it can also be shown as an alt text by specifying the `syntax` prop.
        Note that syntax must be specified as `multimedia` to show the image.

        Args:
            src (Optional[str]): The path to the image file.
            alt (Optional[str]): The alternative text to show when the image cannot be displayed.
            base64 (Optional[str]): The base64 encoded image data. It can not be specified together with `src`.
            type (Optional[str]): The MIME type of the image **to be shown**. If not specified, it will be inferred from the file extension.
              If specified, the image will be converted to the specified type. Can be `image/jpeg`, `image/png`, etc., or without the `image/` prefix.
            position (Optional[str]): The position of the image. Default is `here`. Default is `"here"`. Choices: `"top"`, `"bottom"`, `"here"`.
            maxWidth (Optional[int]): The maximum width of the image to be shown.
            maxHeight (Optional[int]): The maximum height of the image to be shown.
            resize (Optional[float]): The ratio to resize the image to to be shown.
            syntax (Optional[str]): Only when specified as `multimedia`, the image will be shown.
              Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent). Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"xml"`, `"multimedia"`.

        Example:
            ```xml
            <Image src="path/to/image.jpg" alt="Image description" position="bottom" />
            ```
        """
        return self.tag(
            tag_name="Image",
            src=src,
            alt=alt,
            base64=base64,
            type=type,
            position=position,
            maxWidth=maxWidth,
            maxHeight=maxHeight,
            resize=resize,
            syntax=syntax,
            **kwargs,
        )
    
    def audio(
        self,
        src: Optional[str] = None,
        base64: Optional[str] = None,
        alt: Optional[str] = None,
        type: Optional[str] = None,
        position: Optional[str] = None,
        syntax: Optional[str] = None,
        **kwargs: Any,
    ):
        """Audio (`<audio>`) embeds an audio file in the content.
        
        Accepts either a file path (`src`) or base64-encoded audio data (`base64`).
        The MIME type can be provided via `type` or will be inferred from the file extension.

        Args:
            src (Optional[str]): Path to the audio file. If provided, the file will be read and encoded as base64.
            base64 (Optional[str]): Base64-encoded audio data. Cannot be used together with `src`.
            alt (Optional[str]): The alternative text to show when the image cannot be displayed.
            type (Optional[str]): The MIME type of the audio (e.g., audio/mpeg, audio/wav). If not specified, it will be inferred from the file extension.
              The type must be consistent with the real type of the file. The consistency will NOT be checked or converted.
              The type can be specified with or without the `audio/` prefix.
            position (Optional[str]): The position of the image. Default is `here`. Default is `"here"`. Choices: `"top"`, `"bottom"`, `"here"`.
            syntax (Optional[str]): Only when specified as `multimedia`, the image will be shown.
              Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent). Choices: `"markdown"`, `"html"`, `"json"`, `"yaml"`, `"xml"`, `"multimedia"`.

        Example:
            ```xml
            <Audio src="path/to/audio.mp3" />
            ```
        """
        return self.tag(
            tag_name="Audio",
            src=src,
            base64=base64,
            alt=alt,
            type=type,
            position=position,
            syntax=syntax,
            **kwargs,
        )
    