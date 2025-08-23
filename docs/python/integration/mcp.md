# MCP (Model Context Protocol) Integration

The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. MCP provides a standardized way for AI models to access context and invoke tools from various services.

!!! warning

    This document discusses a workaround to use POML with MCP. Native support for MCP is planned for a future release.

POML does not have built-in support for MCP yet. Currently, we resort to tool calls with templates to emulate MCP-like behavior. Here's how to integrate MCP servers with POML.

!!! note

    Some providers support calling MCP servers remotely, e.g., [OpenAI Response API](https://platform.openai.com/docs/api-reference/responses). Those behaviors are outside the scope of this document because developers do not need to handle MCP invocations at all.

TODO: explain how MCP works (list tools, handle tools, etc.), and why the dynamic tool approach applies to MCP.

## Dynamic Tools with MCP

POML can work with MCP servers by dynamically loading tool definitions and handling tool interactions through context. This approach uses POML's templating capabilities to create a flexible integration.

### POML Template for Dynamic Tools

Here's the POML template (`dynamic_tools.poml`) that enables MCP integration:

```xml
<poml>
  <system-msg>{{ system }}</system-msg>
  <human-msg>{{ input }}</human-msg>

  <!-- Dynamic tool definitions from MCP server -->
  <div for="tool in tools">
    <tool-definition name="{{ tool.name }}" description="{{ tool.description }}">
      {{ tool.schema }}
    </tool-definition>
  </div>

  <!-- Handle tool interactions -->
  <div for="i in interactions">
    <tool-request for="res in i" id="{{ res.id }}" name="{{ res.name }}" parameters="{{ res.input }}" />
    <tool-response for="res in i" id="{{ res.id }}" name="{{ res.name }}">
      <object data="{{ res.output }}"/>
    </tool-response>
  </div>

  <runtime model="gpt-4o-mini"/>
</poml>
```

### Key Components Explained

1. **Dynamic Tool Loading**: The `<div for="tool in tools">` loop iterates through tools discovered from the MCP server
2. **Tool Definitions**: Each tool's name, description, and JSON schema are inserted dynamically
3. **Interaction History**: The interactions loop maintains the conversation history with tool calls and responses
4. **Context-Driven**: All dynamic content is provided through the context parameter

## Complete Example with MCP Server

Here's a complete example using a public MCP demo server for dice rolling:

```python
import os
import json
import asyncio
from openai import OpenAI
import poml
from mcp import ClientSession, types
from mcp.client.sse import sse_client

client = OpenAI()

async def mcp_loop(mcp_session):
    # Get available tools from MCP server
    mcp_tools = (await mcp_session.list_tools()).tools
    print(f"Available MCP tools: {mcp_tools}")

    # Convert MCP tools to POML context format
    for tool in mcp_tools:
        context["tools"].append({
            "name": tool.name,
            "description": tool.description,
            "schema": tool.inputSchema
        })

    # Interaction loop
    while True:
        # Generate OpenAI parameters from POML
        params = poml.poml("dynamic_tools.poml", context=context, format="openai_chat")

        # Call OpenAI API
        response = client.chat.completions.create(**params)
        message = response.choices[0].message

        if message.tool_calls:
            # Process tool calls
            responses = []
            for tool_call in message.tool_calls:
                function = tool_call.function
                args = json.loads(function.arguments or "{}")

                # Call MCP server tool
                result = await mcp_session.call_tool(function.name, args)
                print(f"Tool {function.name} result: {result}")

                # Add to interaction history
                responses.append({
                    "id": tool_call.id,
                    "name": function.name,
                    "input": args,
                    "output": result.model_dump()
                })

            context["interactions"].append(responses)
        else:
            # Final response
            print(f"Assistant: {message.content}")
            break

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
            await mcp_loop(mcp_session)

asyncio.run(main())
```

## Comparison with Direct MCP Usage

Without POML:

```python
# Manual message and tool management
messages = []
for tool in mcp_tools:
    # Manually format tools for OpenAI
    # Manually track conversation history
    # Manually handle tool calls and responses
```

With POML:

```python
# Declarative template handles formatting
# Automatic message history management
# Clean separation of prompt logic
params = poml.poml("dynamic_tools.poml", context=context, format="openai_chat")
```

## Future Native Support

Native MCP support in POML is planned and will provide a set of simplified syntaxes for MCP operations. Until then, this template-based approach provides a workaround solution for MCP integration with POML.
