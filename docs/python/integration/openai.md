# OpenAI Integration

POML provides seamless integration with the OpenAI Python SDK, allowing you to use POML files directly with OpenAI's chat completion API.

## Basic Usage

POML can generate OpenAI-compatible parameters from your prompt files. Use the `format="openai_chat"` parameter to get the correct format:

```python
import poml
from openai import OpenAI

client = OpenAI()

# Load POML and get OpenAI-compatible parameters
params = poml.poml("prompt.poml", format="openai_chat")

# Use directly with OpenAI SDK
response = client.chat.completions.create(**params)
```

## Getting Chat Completion Messages

When you use `format="openai_chat"`, POML returns a dictionary containing all the parameters needed for OpenAI's chat completion API:

```python
params = poml.poml("prompt.poml", format="openai_chat")
# params contains:
# {
#   "messages": [...],  # List of chat messages
#   "model": "gpt-4",   # If specified in POML
#   "temperature": 0.7, # If specified in POML
#   ...
# }
```

## Runtime Parameters

POML supports runtime parameters through the `<runtime>` tag. These parameters are converted to snake_case for OpenAI compatibility:

```xml
<poml>
  <system-msg>You are a helpful assistant.</system-msg>
  <human-msg>Hello!</human-msg>

  <runtime
    model="gpt-4.1"
    temperature="0.7"
    max-tokens="150"
    top-p="1.0"
    frequency-penalty="0.5"
    presencePenalty="0.0"
  />
  <!-- can be camelCase -->
</poml>
```

The runtime parameters are automatically converted:

- `max_tokens` -> `max_tokens`
- `temperature` -> `temperature`
- `top_p` -> `top_p`
- `frequency_penalty` -> `frequency_penalty`
- `presence_penalty` -> `presence_penalty`

## Response Format (Structured Output)

POML supports OpenAI's structured output feature through the `<output-schema>` tag:

```xml
<poml>
  <system-msg>Extract the event information.</system-msg>
  <human-msg>Alice and Bob are going to a science fair on Friday.</human-msg>
  <output-schema>
  z.object({
    name: z.string(),
    date: z.string(),
    participants: z.array(z.string()),
  });
  </output-schema>
</poml>
```

Example usage:

```python
params = poml.poml("response_format.poml", format="openai_chat")
# params will include "response_format" for structured output

response = client.chat.completions.create(model="gpt-4.1", **params)
result = json.loads(response.choices[0].message.content)
print(result)
# Output: {'name': 'Science Fair', 'date': 'Friday', 'participants': ['Alice', 'Bob']}
```

## Tool Calls

POML supports OpenAI's function calling through tool definitions:

```xml
<poml>
  <p>What is my horoscope? I am an Aquarius.</p>

  <tool-definition name="get_horoscope" description="Get today's horoscope for an astrological sign.">
  {
      "type": "object",
      "properties": {
          "sign": {
              "type": "string",
              "description": "An astrological sign like Taurus or Aquarius"
          }
      },
      "required": ["sign"]
  }
  </tool-definition>

  <!-- Handle tool interactions with context -->
  <tool-request if="tool_request" id="{{ tool_request.id }}" name="{{ tool_request.name }}" parameters="{{ tool_request.parameters }}" />
  <tool-response if="tool_response" id="{{ tool_response.id }}" name="{{ tool_response.name }}">
    <object data="{{ tool_response.result }}"/>
  </tool-response>
</poml>
```

Example implementation with tool calls:

```python
# Initial request
context = {
    "tool_request": None,
    "tool_response": None,
}

params = poml.poml("tool_call.poml", context=context, format="openai_chat")
response = client.chat.completions.create(model="gpt-4.1", **params)

# Process tool call
tool_call = response.choices[0].message.tool_calls[0]
context["tool_request"] = {
    "name": tool_call.function.name,
    "parameters": json.loads(tool_call.function.arguments),
    "id": tool_call.id,
}

# Execute the function
result = {"horoscope": get_horoscope(**context["tool_request"]["parameters"])}

# Send tool response back
context["tool_response"] = {
    "name": tool_call.function.name,
    "result": result,
    "id": tool_call.id,
}

params = poml.poml("tool_call.poml", context=context, format="openai_chat")
response = client.chat.completions.create(model="gpt-4.1", **params)
print(response.choices[0].message.content)
```
