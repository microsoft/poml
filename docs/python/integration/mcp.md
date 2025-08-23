# MCP (Model Context Protocol) Integration

The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. MCP provides a standardized way for AI models to access context and invoke tools from various services.

!!! warning

    POML does not have built-in support for MCP yet. Currently, we resort to tool calls with templates to emulate MCP-like behavior. Native support for MCP is planned for a future release.

!!! note

    Some providers support calling MCP servers remotely, e.g., [OpenAI Response API](https://platform.openai.com/docs/api-reference/responses). Those behaviors are outside the scope of this document because developers do not need to handle MCP invocations at all.

## How MCP Works

MCP (Model Context Protocol) operates on a client-server architecture where:

1. **Tool Discovery**: MCP servers expose available tools/functions that can be called
2. **Tool Invocation**: Clients (LLM applications) can invoke these tools with parameters
3. **Response Handling**: Servers execute the tools and return results to the client

The MCP workflow typically involves:

- **Initialization**: Establish connection with the MCP server
- **List Tools**: Query the server for available tools and their schemas
- **Tool Execution**: When the LLM needs a tool, send the request to the MCP server
- **Result Integration**: Incorporate tool results back into the conversation

## Installation

```bash
pip install mcp
```

## Dynamic Tools with MCP

POML can work with MCP servers by dynamically loading tool definitions and handling tool interactions through context. This approach uses POML's templating capabilities to create a flexible integration.

The dynamic tool approach is ideal for MCP integration because:

- MCP servers provide tools dynamically at runtime
- Tool schemas vary between different MCP servers
- The same POML template can work with any MCP server
- Tool interactions need to be tracked across conversation turns

### POML Template for Dynamic Tools

Here's the POML template (`dynamic_tools.poml`) that enables MCP integration:

```xml
<poml>
  <system-msg>{{ system }}</system-msg>
  <human-msg>{{ input }}</human-msg>

  <!-- Dynamic Tool Loading: Iterates through tools discovered from the MCP server -->
  <div for="tool in tools">
    <!-- Each tool's name, description, and JSON schema are inserted dynamically -->
    <tool-definition name="{{ tool.name }}" description="{{ tool.description }}">
      {{ tool.schema }}
    </tool-definition>
  </div>

  <!-- Interaction History: Maintains conversation history with tool calls and responses -->
  <div for="i in interactions">
    <!-- All dynamic content is provided through the context parameter -->
    <tool-request for="res in i" id="{{ res.id }}" name="{{ res.name }}" parameters="{{ res.input }}" />
    <tool-response for="res in i" id="{{ res.id }}" name="{{ res.name }}">
      <!-- Embeds the tool output directly via POML's Object componenet. -->
      <object data="{{ res.output }}"/>
    </tool-response>
  </div>

  <runtime model="gpt-4.1"/>
</poml>
```

## Complete Example with MCP Server

Here's a complete example using a public MCP demo server for dice rolling.

### 1. Tool Discovery and Conversion

```python
async def discover_mcp_tools(mcp_session):
    """Discover available tools from MCP server and convert to POML format"""
    mcp_tools = (await mcp_session.list_tools()).tools
    print(f"Available MCP tools: {mcp_tools}")

    # Convert MCP tools to POML context format.
    # The format must be compatible with the POML template above.
    poml_tools = []
    for tool in mcp_tools:
        poml_tools.append({
            "name": tool.name,
            "description": tool.description,
            "schema": tool.inputSchema
        })
    return poml_tools
```

### 2. Process Tool Calls

```python
async def process_tool_calls(mcp_session, tool_calls):
    """Execute MCP tool calls and format responses"""
    responses = []
    for tool_call in tool_calls:
        function = tool_call.function
        args = json.loads(function.arguments or "{}")

        # Call MCP server tool
        result = await mcp_session.call_tool(function.name, args)
        print(f"Tool {function.name} result: {result}")

        # Format for POML context.
        # This format must be compatible with the POML template above.
        responses.append({
            "id": tool_call.id,
            "name": function.name,
            "input": args,
            "output": result.model_dump()
        })
    return responses
```

### 3. Main Conversation Loop

```python
async def run_mcp_conversation(mcp_session, context):
    """Run the conversation loop with MCP tools"""
    # Discover and add tools to context
    context["tools"] = await discover_mcp_tools(mcp_session)

    client = OpenAI()

    # Conversation loop
    while True:
        # Generate OpenAI parameters from POML
        params = poml.poml("dynamic_tools.poml", context=context, format="openai_chat")
        response = client.chat.completions.create(**params)
        message = response.choices[0].message

        if message.tool_calls:
            # Process and add tool responses to context
            responses = await process_tool_calls(mcp_session, message.tool_calls)
            context["interactions"].append(responses)
        else:
            # Final response - conversation complete
            print(f"Assistant: {message.content}")
            return message.content
```

### 4. Complete Integration

```python
import json
import asyncio
from openai import OpenAI
import poml
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    # Initialize context for POML
    context = {
        "system": "You are a helpful DM assistant. Use the dice-rolling tool when needed.",
        "input": "Roll 2d4+1",
        "tools": [],
        "interactions": []
    }

    # Connect to MCP server (using public demo server)
    server_url = "https://dmcp-server.deno.dev/sse"

    async with sse_client(server_url) as (read, write):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            result = await run_mcp_conversation(mcp_session, context)
            print(f"Conversation completed: {result}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Comparison with Direct MCP Usage

### Without POML (Direct Approach)

```python
# Manually manage message roles and format
messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": msg.tool_calls})
messages.append({"role": "tool", "tool_call_id": tc.id, "name": fn.name, "content": text_result})

# Manually format tool results from MCP
if result.structuredContent is not None:
    text_result = json.dumps(result.structuredContent)
else:
    text_result = "\n".join([c.text for c in result.content if isinstance(c, types.TextContent)])

# Convert MCP tools to OpenAI format
oa_tools.append({
    "type": "function",
    "function": {"name": t.name, "description": t.description, "parameters": t.inputSchema}
})
```

### With POML (Template Approach)

```python
# Simply track tool request/response pairs
context["interactions"].append([
    {"id": tc.id, "name": fn.name, "input": args, "output": result.model_dump()}
])
```

The key differences are:
- **Message management**: Direct approach requires remembering `"role": "assistant"` vs `"role": "tool"` formats; POML manages this automatically through request/response pairs
- **Content rendering**: Manual string conversion and formatting vs POML's `<object>` component handling all content types
- **Tool formatting**: Manual OpenAI-specific formatting vs declarative template that handles the conversion

## Future Native Support

Native MCP support in POML is planned and will provide a set of simplified syntaxes for MCP operations. Until then, this template-based approach provides a workaround solution for MCP integration with POML.
