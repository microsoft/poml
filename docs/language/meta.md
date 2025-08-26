# Meta

POML documents support two types of meta elements that control document behavior and configuration:

1. **The `<meta>` element** - Defines the most fundamental metadata about a POML file, such as version requirements and component control
2. **Meta-like components** - Elements that look like normal POML components but affect prompt rendering and LLM execution without appearing in the final prompt messages (e.g., `<stylesheet>`, `<output-schema>`, `<tool-definition>`, `<runtime>`)

## The `<meta>` Element

The `<meta>` element provides core metadata and configuration for POML documents. It allows you to specify version requirements and disable/enable components.

### Basic Usage

Meta elements are typically placed at the beginning of a POML document and don't produce any visible output. One POML file can have multiple `<meta>` elements at any position, but they should be used carefully to avoid conflicts.

```xml
<poml>
  <meta minVersion="1.0.0" />
  <p>Your content here</p>
</poml>
```

### Meta Element Usage

Meta elements are used for general document configuration:

- Version control (`minVersion`, `maxVersion`)
- Component management (`components`)

## Version Control

Version requirements ensure compatibility between documents and the POML runtime. This prevents runtime errors when documents require specific POML features.

```xml
<meta minVersion="0.5.0" maxVersion="2.0.0" />
```

- **minVersion**: Minimum required POML version. If the current version is lower, an error is thrown.
- **maxVersion**: Maximum supported POML version. Documents may not work correctly with newer versions.

Version checking uses semantic versioning (MAJOR.MINOR.PATCH) and occurs during document parsing.

## Component Control

The `components` attribute dynamically enables or disables POML components within a document. This is useful for conditional content, feature flags, or restricting elements in specific contexts.

### Disabling Components

Prefix component names with `-` to disable them:

```xml
<meta components="-table" />
<!-- Now <table> elements will throw an error -->
```

You can disable multiple components:

```xml
<meta components="-table,-image" />
```

### Re-enabling Components

Use `+` prefix to re-enable previously disabled components:

```xml
<meta components="-table" />
<!-- table is disabled -->
<meta components="+table" />
<!-- table is re-enabled -->
```

Component aliases can be disabled independently of the main component name. For example, if a component has both a main name and aliases, you can disable just the alias while keeping the main component available.

## Meta-like Components

The following sections describe components that behave like meta elements - they affect how the prompt is processed and executed but don't appear in the final prompt messages sent to the LLM.

### Stylesheet

POML allows you to define styles for your elements using the `<stylesheet>` tag. This enables you to apply CSS-like styles (or, more generally, component attributes) to your markup.

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

#### ClassName Attribute

Elements can be identified with a `className` attribute for styling. The stylesheet can then target elements with specific class names using a CSS-like selector syntax (using a dot `.` before the class name).

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

Here, the `<table>` element has the class name "csv". The stylesheet targets elements with the class "csv" (using `.csv`) and sets their `syntax` to "csv" and `writerOptions` to a specific JSON string. Note the escaped backslashes (`\\`) in the `writerOptions` value, which are necessary because the stylesheet itself is a JSON string. This example will render to:

```
1;2;3
4;5;6
```

**NOTE:** _The writerOptions API is experimental and is subject to change._

### Response Schema

Response schemas define the expected structure of AI-generated responses, ensuring that language models return data in a predictable, parsable format. This transforms free-form text generation into structured data generation.

#### JSON Schema Format

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

#### Expression Format

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

#### Expression Evaluation in Schemas

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

### Tool Registration

Tool registration enables AI models to interact with external functions during conversation. Tools are function definitions that tell the AI model what functions are available, what parameters they expect, and what they do. Tool registration is done using the `<tool-definition>` or `<tool>` tag (both are equivalent).

<!-- prettier-ignore -->
!!! note

    Using tools together with response schema is only supported for some models, e.g., those from OpenAI.

#### JSON Schema Format

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

#### Expression Format

```xml
<tool-definition name="calculate" description="Perform calculation" parser="eval">
  z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number()
  })
</tool-definition>
```

#### Expression Evaluation in Tool Schemas

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

#### Template Expressions in Attributes

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

### Runtime Parameters

Runtime parameters configure the language model's behavior during execution. These parameters are automatically used in [VSCode's test command](../vscode/features.md) functionality, which is based on the [Vercel AI SDK](https://ai-sdk.dev/).

```xml
<runtime temperature="0.7"
         max-output-tokens="1000"
         model="gpt-5"
         top-p="0.9" />
```

All attributes are passed as runtime parameters with automatic type conversion:

#### Key Conversion

- Keys are converted from kebab-case to camelCase
- Examples: `max-tokens` → `maxTokens`, `top-p` → `topP`, `frequency-penalty` → `frequencyPenalty`

#### Value Conversion

- **Boolean strings**: `"true"` and `"false"` → `true` and `false`
- **Number strings**: `"1000"`, `"0.7"` → `1000`, `0.7`
- **JSON strings**: `'["END", "STOP"]'`, `'{"key": "value"}'` → parsed JSON objects/arrays

#### Common Parameters

- **provider**: Language model provider (e.g., "openai", "anthropic", "microsoft")
- **model**: Model identifier (e.g., "gpt-5", "claude-4-sonnet")
- **temperature**: Controls randomness (0-2, typically 0.3-0.7 for balanced output)
- **maxOutputTokens**: Maximum response length in tokens
- **topP**: Nucleus sampling threshold (0-1, typically 0.9-0.95)
- **frequencyPenalty**: Reduces token repetition based on frequency (-2 to 2)
- **presencePenalty**: Reduces repetition based on presence (-2 to 2)
- **seed**: For deterministic outputs (integer value)

What parameters are available does not really matter, unless you are passing them to an LLM SDK. POML's built-in VS Code runner is based on the [Vercel AI SDK](https://ai-sdk.dev/). Therefore, the full parameter list depends on whether you're using standard text generation or structured data generation:

- [Text generation parameters](https://ai-sdk.dev/docs/ai-sdk-core/generating-text) - Standard text generation
- [Structured data parameters](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - When using response schemas

The [Vercel AI SDK](https://ai-sdk.dev/) automatically handles parameter validation and conversion for different model providers.

If you are using the POML Python SDK, the runtime parameters are converted to snake case and returned as a dictionary. For example, `maxOutputTokens` becomes `max_output_tokens`, and `topP` becomes `top_p`.
