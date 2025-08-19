# Meta

The `<meta>` element provides metadata and configuration for POML documents. It allows you to specify version requirements, disable/enable components, define response schemas, register tools, and set runtime parameters.

## Basic Usage

Meta elements are typically placed at the beginning of a POML document and don't produce any visible output. One POML file can have multiple `<meta>` elements at any position, but they should be used carefully to avoid conflicts.

```xml
<poml>
  <meta minVersion="1.0.0" />
  <p>Your content here</p>
</poml>
```

### Meta Element Types

Meta elements fall into two categories based on whether they include a `type` attribute:

**Without type attribute** - Used for general document configuration:
- Version control (`minVersion`, `maxVersion`)
- Component management (`components`)

**With type attribute** - Used for specific functionalities:
- `type="responseSchema"` - Defines structured output format for AI responses
- `type="tool"` - Registers callable functions for AI models
- `type="runtime"` - Sets language model execution parameters

## Response Schema

Response schemas define the expected structure of AI-generated responses, ensuring that language models return data in a predictable, parsable format. This transforms free-form text generation into structured data generation.

### JSON Schema Format

Use the `lang="json"` attribute to specify JSON Schema format:

```xml
<meta type="responseSchema" lang="json">
  {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" }
    },
    "required": ["name"]
  }
</meta>
```

### Expression Format

Use the `lang="expr"` attribute (or omit it for auto-detection) to evaluate JavaScript expressions that return schemas:

```xml
<meta type="responseSchema" lang="expr">
  z.object({
    name: z.string(),
    age: z.number().optional()
  })
</meta>
```

When `lang` is omitted, POML auto-detects the format:
- If the content starts with `{`, it's treated as JSON
- Otherwise, it's treated as an expression

### Expression Evaluation in Schemas

#### JSON Schema with Template Expressions

JSON schemas support template expressions using `{{ }}` syntax:

```xml
<let name="maxAge" value="100" />
<meta type="responseSchema" lang="json">
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
</meta>
```

#### Expression Format with JavaScript Evaluation

Expression schemas are evaluated as JavaScript code with access to context variables and the `z` (Zod) variable:

```xml
<let name="fields" value='["name", "email", "age"]' />
<meta type="responseSchema" lang="expr">
  z.object(
    Object.fromEntries(fields.map(f => [f, z.string()]))
  )
</meta>
```

The expression can return either:
- A Zod schema object (detected by the presence of `_def` property)
- A plain JavaScript object treated as JSON Schema

**Important limitations:**
- Only one `responseSchema` meta element is allowed per document. Multiple response schemas will result in an error.
- Response schemas cannot be used together with tool definitions in the same document. You must choose between structured responses or tool calling capabilities.

## Tool Registration

Tool registration enables AI models to interact with external functions during conversation. Tools are function definitions that tell the AI model what functions are available, what parameters they expect, and what they do.

**Important:** Tools and response schemas are mutually exclusive. You cannot use both `responseSchema` and `tool` meta elements in the same POML document.

### JSON Schema Format

```xml
<meta type="tool" name="getWeather" description="Get weather information">
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
</meta>
```

### Expression Format

```xml
<meta type="tool" name="calculate" description="Perform calculation" lang="expr">
  z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number()
  })
</meta>
```

### Expression Evaluation in Tool Schemas

Tool schemas support the same evaluation modes as response schemas:

#### JSON with Template Expressions

```xml
<let name="maxValue" value="1000" />
<meta type="tool" name="calculator" description="Calculate values" lang="json">
  {
    "type": "object",
    "properties": {
      "value": { 
        "type": "number",
        "maximum": {{ maxValue }}
      }
    }
  }
</meta>
```

#### Expression Format

```xml
<let name="supportedOperations" value='["add", "subtract", "multiply", "divide"]' />
<meta type="tool" name="calculator" description="Perform mathematical operations" lang="expr">
  z.object({
    operation: z.enum(supportedOperations),
    a: z.number(),
    b: z.number()
  })
</meta>
```

In expression mode, the `z` variable is automatically available for constructing Zod schemas, and you have direct access to all context variables.

**Required attributes for tools:**
- **name**: Tool identifier (required)
- **description**: Tool description (optional but recommended)
- **lang**: Schema language, either "json" or "expr" (optional, auto-detected based on content)

You can define multiple tools in a single document.

## Runtime Parameters

Runtime parameters configure the language model's behavior during execution. These parameters are automatically used in [VSCode's test command](../vscode/features.md) functionality, which is based on the [Vercel AI SDK](https://ai-sdk.dev/).

```xml
<meta type="runtime" 
      temperature="0.7" 
      maxOutputTokens="1000" 
      model="gpt-5"
      topP="0.9" />
```

All attributes except `type` are passed as runtime parameters. Common parameters include:

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
