# POML Standalone File Mode

## Introduction to Standalone File Mode

POML (Prompting Markup Language) provides a convenient way to create prompts using a markup language that is easy to read and write. The standalone file mode is the most commonly used approach, where you create a file with a `.poml` extension. This file contains XML-like syntax that POML renders into a prompt. This mode is particularly useful for creating reusable templates and managing complex prompts without embedding POML directly in JSX files or using a Python SDK.

In this mode, you wrap your content with a top-level `<poml>` tag, allowing POML to parse and render your markup correctly. Below is a guide on how to effectively use the standalone file mode.

## Basic Usage

To create a POML file, simply create a file with the `.poml` extension and wrap your content within the `<poml>` tag:

```xml
<poml>
  <p>Hello, world!</p>
</poml>
```

You can also type anything without a `poml` tag, and it will be treated as a string. It's called "free text mode" in POML. However, it has several limitations currently, including unabling to render any XML tags wrapped with `<>`, unabling to use many special characters, and unabling to use all the wonderful features of POML. So, it's always recommended to use the `poml` tag before everything.

**Tip: Glossary for Beginners:**

- **Tag:** A tag is a fundamental building block in XML (and POML). It's used to mark the beginning and end of an element. Tags are enclosed in angle brackets (`<` and `>`). For example, `<p>` is an opening tag, and `</p>` is a closing tag. Everything between the opening and closing tags is considered part of that element.
- **Attribute:** An attribute provides additional information about an element. Attributes are placed inside the opening tag, and they consist of a name and a value (enclosed in double quotes). For example, in `<p speaker="human">`, `speaker` is the attribute name, and `"human"` is the attribute value.
- **Content:** The content is the text or other elements that appear between the opening and closing tags of an element. For example, in `<p>Hello, world!</p>`, "Hello, world!" is the content of the `<p>` element.

**Escape Characters:** In POML, you can use escape characters to include special characters in your content and attribute values. Due to an implementation issue, the escape syntax in POML is slightly different from what you would know in HTML or XML. For example, to include a double quote (`"`) in your content, you can use `#quot;` (rather than `&quot;`). Here are some common escape characters:

1. `#quot;` for `"`
2. `#apos;` for `'`
3. `#amp;` for `&`
4. `#lt;` for `<`
5. `#gt;` for `>`
6. `#hash;` for `#`
7. `#lbrace;` for `{`
8. `#rbrace;` for `}`

It's not necessary to use the escape characters for most cases, but they can be helpful when you are having trouble displaying those characters in certain cases.

## Template Engine

The template engine of POML allows you to incorporate dynamic content and control structures. Here are some key features.

### Expressions

You can use expressions enclosed in double curly brackets (`{{` `}}`) to evaluate variables or expressions dynamically:

```xml
<poml>
  <p>Hello, {{name}}!</p>
</poml>
```

In this example, if `name` is set to "Alice" (e.g., using a `<let>` tag, described below), the output will be "Hello, Alice!".

#### Usage in Attributes

Expressions can also be used within attribute values:

```xml
<poml>
  <task caption="Task #{{index}}">This is task No. {{index}}.</p>
</poml>
```

This renders to the following when `index` is set to 1.

```
# Task #1

This is task No. 1.
```

#### Expression Usages

POML supports various JavaScript expressions within the double curly brackets. This includes but is not limited to:

- **Variables:**  `{{variableName}}`
- **Arithmetic:** `{{a + b}}`, `{{x * y}}`, `{{count / total}}`
- **String Concatenation:** `{{firstName + " " + lastName}}`
- **Array Access:** `{{myArray[0]}}`
- **Object Property Access:** `{{myObject.propertyName}}`
- **Function Calls:** `{{myFunction(arg1, arg2)}}` (if `myFunction` is defined in the context)
- **Ternary Operators:** `{{condition ? valueIfTrue : valueIfFalse}}`
- **Accessing loop variables:** `{{loop.index}}` (explained in the "For Attribute" section)

### Let Expressions

The `<let>` tag allows you to define variables, import data from external files, and set values within your POML template.

#### Syntax 1: Setting a variable from a value

```xml
<poml>
  <let name="greeting">Hello, world!</let>
  <p>{{greeting}}</p>
</poml>
```

This will output "Hello, world!". When using the content approach (as shown above), the text is treated as a literal string.

Alternatively, you can use the `value` attribute which must contain an evaluatable JavaScript expression:

```xml
<poml>
  <let name="greeting" value="'Hello, world!'" />
  <p>{{greeting}}</p>
</poml>
```

Note that when using the `value` attribute, string literals must be properly quoted (e.g., `"'Hello, world!'"` or `'"Hello, world!"'`) since the value is evaluated as JavaScript. The `value` attribute can contain strings, numbers, arrays, objects, or any valid JavaScript expression.

#### Syntax 2: Importing data from a file

```xml
<poml>
  <let name="users" src="users.json" />
  <p>First user: {{users[0].name}}</p>
</poml>
```

This imports the contents of `users.json` and assigns it to the `users` variable.  The `src` attribute specifies the path to the file (relative to the POML file). The optional `type` attribute can specify the file type (e.g., "json", "text", "csv"). If not provided, POML attempts to infer it from the file extension.

#### Syntax 3: Importing data from a file without a name

```xml
<poml>
  <let src="config.json" />
  <p>API Key: {{apiKey}}</p>
</poml>
```
If `config.json` contains `{ "apiKey": "your_api_key" }`, this will output "API Key: your_api_key". When you use `src` without `name`, and the file content is a JSON object, the properties of that object are directly added to the context.

#### Syntax 4: Setting a variable using inline JSON

```xml
<poml>
  <let name="person">
    {
      "name": "Alice",
      "age": 30
    }
  </let>
  <p>Name: {{person.name}}, Age: {{person.age}}</p>
</poml>
```

This defines a `person` variable with the given JSON object. You can also specify the `type` attribute:

```xml
<poml>
  <let name="count" type="integer">5</let>
  <p>Count: {{count}}</p>
</poml>
```

#### Syntax 5: Setting a variable from an expression

```xml
<poml>
  <let name="base" value="10" />
  <let name="increment" value="5" />
  <let name="total" value="{{ base + increment }}" />
  <p>Total: {{ total }}</p>  <!-- Output: Total: 15 -->
</poml>
```

### Type-Autocasting in Attributes

The attributes of components will be automatically cast based on their defined types in the component documentation. This means you don't have to worry about manually converting types in many cases.

- **Boolean:** If an attribute is defined as a boolean, values like `"true"`, `1`, `"1"`, or `{{true}}` will be cast to the boolean value `true`. Similarly, `"false"`, `0`, `"0"`, or `{{false}}` will be cast to `false`.
- **Number:** If an attribute is defined as a number, values like `"123"`, `45.6`, `{{anyNumber}}` or `{{myNumber+1.3}}` will be cast to their corresponding numeric values.
- **Object:** If an attribute is defined as an object, POML will attempt to parse the attribute value as a JSON string. For example, `data="{{{name: 'John', age: 30}}}"` or `data='{"name":"John","age":30}'` will be parsed into the corresponding JavaScript object.
* **String:** If an attribute is a string, no casting is performed.

In the following example, the first auto-casting happened at let, where `true` is converted to boolean at `let` expression.

```xml
<poml>
  <let name="boolVar" type="boolean" value="true"/>
  <let name="numVar" type="number" value="42"/>
  <let name="objVar" type="object" value="{{ { key: 'value' } }}"/>

  <MyComponent boolProp="{{boolVar}}" numProp="{{numVar}}" objProp="{{objVar}}" stringProp="hello"/>
</poml>
```

If MyComponent is defined with `boolProp` as boolean, `numProp` as number, `objProp` as object, and `stringProp` as string, the values will be interpreted and auto-casted again when `MyComponent` is used.

### For Attribute

To loop over a list, use the `for` attribute. The syntax is `for="itemName in listName"`.

```xml
<poml>
  <list>
    <item for="item in ['apple', 'banana', 'cherry']">{{item}}</item>
  </list>
</poml>
```

This will render a list with "apple", "banana", and "cherry".

#### Loop Variables

Inside the loop, you have access to special `loop` variables:

- `loop.index`: The current iteration index (starting from 0).
- `loop.length`: The total number of items in the list.
- `loop.first`: `true` if it's the first iteration, `false` otherwise.
- `loop.last`: `true` if it's the last iteration, `false` otherwise.

Example:

```xml
<poml>
<let name="all_demos" value='[
    { "input": "What is your name?", "output": "My name is POML." },
    { "input": "What can you do?", "output": "I can generate prompts." }
]'/>
  <examples>
    <example for="example in all_demos" chat="false" caption="Example {{ loop.index + 1 }}" captionStyle="header">
      <input>{{ example.input }}</input>
      <output>{{ example.output }}</output>
    </example>
  </examples>
</poml>
```

This will generate two examples, with captions "Example 1" and "Example 2", displaying the input and output from each demo in the `all_demos` array. Note that we use `loop.index + 1` because `loop.index` starts from 0.

### If Condition

You can conditionally render elements using the `if` attribute:

```xml
<poml>
  <let name="isVisible" value="true"/>
  <let name="isHidden" value="{{ !isVisible }}"/>
  <p if="isVisible">This paragraph is visible.</p>
  <p if="isHidden">This paragraph is hidden.</p>
</poml>
```

If `isVisible` is `true`, the first paragraph will be rendered. The second paragraph will not be rendered because isHidden is false. The value of `if` can be a simple variable name (which is treated as a boolean) or a POML expression.

### Include Files

You can split prompts into multiple files and include them using the `<include>` tag.

```xml
<poml>
  <include src="snippet.poml" />
</poml>
```

The file specified in `src` is read and its contents are injected as if they were written in place. Variables from the current context are available inside the included file. The `for` and `if` attributes work as expected:

```xml
<poml>
  <include src="row.poml" for="i in [1,2,3]" />
  <include src="footer.poml" if="showFooter" />
</poml>
```

## Stylesheet

POML allows you to define styles for your elements using the `<stylesheet>` tag.  This enables you to apply CSS-like styles (or, more generally, component attributes) to your markup.

### Using Stylesheet

You can define styles within a `<stylesheet>` tag. The stylesheet must be a valid JSON object and must be placed directly under the root `<poml>` element.

```xml
<poml>
  <stylesheet>
    {
      "p": {
        "syntax": "json"
      }
    }
  </stylesheet>
  <p>This text will be rendered as JSON.</p>
</poml>
```

In this example, all `<p>` elements will have their `syntax` attribute set to `"json"`. You can set any attribute of a component using the stylesheet.

### ClassName Attribute

Elements can be identified with a `className` attribute for styling.  The stylesheet can then target elements with specific class names using a CSS-like selector syntax (using a dot `.` before the class name).

```xml
<poml>
  <table className="csv" records="[[1,2,3],[4,5,6]]"/>
  <stylesheet>
    {
      ".csv": {
        "syntax": "csv",
        "writerOptions": "{\\"csvSeparator\\": \\";\\", \\"csvHeader\\": false}"
      }
    }
  </stylesheet>
</poml>
```

Here, the `<table>` element has the class name "csv".  The stylesheet targets elements with the class "csv" (using `.csv`) and sets their `syntax` to "csv" and `writerOptions` to a specific JSON string. Note the escaped backslashes (`\\`) in the `writerOptions` value, which are necessary because the stylesheet itself is a JSON string.  This example will render to:

```
1;2;3
4;5;6
```

**NOTE:** *The writerOptions API is experimental and is subject to change.*

## Response Schema

Response schemas define the expected structure of AI-generated responses, ensuring that language models return data in a predictable, parsable format. This transforms free-form text generation into structured data generation.

### JSON Schema Format

Use the `parser="json"` attribute to specify JSON Schema format. The schema must be a valid [OpenAPI JSON Schema](https://spec.openapis.org/) object.

```xml
<output-schema parser="json">
  {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" }
    },
    "required": ["name"]
  }
</output-schema>
```

### Expression Format

Use the `parser="eval"` attribute (or omit it for auto-detection) to evaluate JavaScript expressions that return schemas. It should return a [Zod](https://zod.dev/) schema objects or a JavaScript object that complies with [OpenAPI JSON Schema standards](https://spec.openapis.org/):

```xml
<output-schema parser="eval">
  z.object({
    name: z.string(),
    age: z.number().optional()
  })
</output-schema>
```

When `parser` is omitted, POML auto-detects the format:
- If the content starts with `{`, it's treated as JSON
- Otherwise, it's treated as an expression

### Expression Evaluation in Schemas

#### JSON Schema with Template Expressions

JSON schemas support template expressions using `{{ }}` syntax:

```xml
<let name="maxAge" value="100" />
<output-schema parser="json">
  {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { 
        "type": "number",
        "minimum": 0,
        "maximum": {{ maxAge }}
      }
    }
  }
</output-schema>
```

#### Expression Format with JavaScript Evaluation

Expression schemas are evaluated as JavaScript code with access to context variables and the `z` (Zod) variable:

```xml
<let name="fields" value='["name", "email", "age"]' />
<output-schema parser="eval">
  z.object(
    Object.fromEntries(fields.map(f => [f, z.string()]))
  )
</output-schema>
```

The expression can return either:
- A Zod schema object (detected by the presence of `_def` property)
- A plain JavaScript object treated as JSON Schema

**Important limitations:**
- Only one `output-schema` element is allowed per document. Multiple response schemas will result in an error.

## Tool Registration

Tool registration enables AI models to interact with external functions during conversation. Tools are function definitions that tell the AI model what functions are available, what parameters they expect, and what they do. Tool registration is done using the `<tool-definition>` or `<tool>` tag (both are equivalent).

!!! note

    Using tools together with response schema is only supported for some models, e.g., those from OpenAI.

### JSON Schema Format

```xml
<tool-definition name="getWeather" description="Get weather information">
  {
    "type": "object",
    "properties": {
      "location": { "type": "string" },
      "unit": { 
        "type": "string", 
        "enum": ["celsius", "fahrenheit"] 
      }
    },
    "required": ["location"]
  }
</tool-definition>
```

### Expression Format

```xml
<tool-definition name="calculate" description="Perform calculation" parser="eval">
  z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number()
  })
</tool-definition>
```

### Expression Evaluation in Tool Schemas

Tool schemas support the same evaluation modes as response schemas:

#### JSON with Template Expressions

```xml
<let name="maxValue" value="1000" />
<tool-definition name="calculator" description="Calculate values" parser="json">
  {
    "type": "object",
    "properties": {
      "value": { 
        "type": "number",
        "maximum": {{ maxValue }}
      }
    }
  }
</tool-definition>
```

#### Expression Format

```xml
<let name="supportedOperations" value='["add", "subtract", "multiply", "divide"]' />
<tool-definition name="calculator" description="Perform mathematical operations" parser="eval">
  z.object({
    operation: z.enum(supportedOperations),
    a: z.number(),
    b: z.number()
  })
</tool-definition>
```

In expression mode, the `z` variable is automatically available for constructing Zod schemas, and you have direct access to all context variables.

**Required attributes for tools:**
- **name**: Tool identifier (required)
- **description**: Tool description (optional but recommended)
- **parser**: Schema parser, either "json" or "eval" (optional, auto-detected based on content)

### Template Expressions in Attributes

Both schemas and tools support template expressions in their attributes:

```xml
<let name="toolName">calculate</let>
<let name="toolDesc">Perform mathematical calculations</let>
<let name="schemaParser">json</let>

<tool-definition name="{{toolName}}" description="{{toolDesc}}" parser="{{schemaParser}}">
  {
    "type": "object",
    "properties": {
      "operation": { "type": "string" }
    }
  }
</tool-definition>
```

Similarly for output schemas:

```xml
<let name="schemaJson">
{
  "type": "object",
  "properties": {
    "result": { "type": "string" }
  }
}
</let>
<output-schema parser="json">
{{ schemaJson }}
</output-schema>
```

You can define multiple tools in a single document.

## Runtime Parameters

Runtime parameters configure the language model's behavior during execution. These parameters are automatically used in [VSCode's test command](../vscode/features.md) functionality, which is based on the [Vercel AI SDK](https://ai-sdk.dev/).

```xml
<runtime temperature="0.7" 
         max-output-tokens="1000" 
         model="gpt-5"
         top-p="0.9" />
```

All attributes are passed as runtime parameters with automatic type conversion:

### Key Conversion
- Keys are converted from kebab-case to camelCase
- Examples: `max-tokens` → `maxTokens`, `top-p` → `topP`, `frequency-penalty` → `frequencyPenalty`

### Value Conversion
- **Boolean strings**: `"true"` and `"false"` → `true` and `false`
- **Number strings**: `"1000"`, `"0.7"` → `1000`, `0.7`
- **JSON strings**: `'["END", "STOP"]'`, `'{"key": "value"}'` → parsed JSON objects/arrays

### Common Parameters

- **temperature**: Controls randomness (0-2, typically 0.3-0.7 for balanced output)
- **maxOutputTokens**: Maximum response length in tokens
- **model**: Model identifier (e.g., "gpt-5", "claude-4-sonnet")
- **topP**: Nucleus sampling threshold (0-1, typically 0.9-0.95)
- **frequencyPenalty**: Reduces token repetition based on frequency (-2 to 2)
- **presencePenalty**: Reduces repetition based on presence (-2 to 2)
- **seed**: For deterministic outputs (integer value)

The full parameter list depends on whether you're using standard text generation or structured data generation:
- [Text generation parameters](https://ai-sdk.dev/docs/ai-sdk-core/generating-text) - Standard text generation
- [Structured data parameters](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - When using response schemas

The [Vercel AI SDK](https://ai-sdk.dev/) automatically handles parameter validation and conversion for different model providers.
