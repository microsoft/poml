import asyncio
import json
import os

from common_utils import print_section
from mcp import ClientSession, types
from mcp.client.sse import sse_client
from openai import OpenAI

import poml

client = OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)


async def main():
    context = {
        "system": "You are a helpful DM assistant. Use the dice-rolling tool when needed.",
        "input": "Roll 2d4+1",
        "tools": [],
        "interactions": [],
    }
    server_url = "http://127.0.0.1:8090/sse"
    async with sse_client(server_url) as (read, write):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            mcp_tools = (await mcp_session.list_tools()).tools
            print_section("MCP tools", str(mcp_tools))

            # Convert MCP tools into context need by POML
            for t in mcp_tools:
                context["tools"].append({"name": t.name, "description": t.description, "schema": t.inputSchema})

            for _ in range(10):
                print_section("Context", json.dumps(context, indent=2))

                params = poml.poml("../assets/dynamic_tools.poml", context=context, format="openai_chat")
                assert "tools" in params, "tools missing in params"
                assert "model" in params, "model missing in params"

                resp = client.chat.completions.create(**params)

                print_section("Response", str(resp))

                msg = resp.choices[0].message
                if msg.tool_calls:
                    responses = []
                    for tc in msg.tool_calls:
                        fn = tc.function
                        args = json.loads(fn.arguments or "{}")

                        # Call the MCP server tool
                        result = await mcp_session.call_tool(fn.name, args)
                        print_section("Tool result", str(result))
                        responses.append({"id": tc.id, "name": fn.name, "input": args, "output": result.model_dump()})
                    context["interactions"].append(responses)
                    continue  # loop again to let the model process tool output
                else:
                    # No tool calls => final output
                    print_section("Assistant", msg.content or "")
                    break
            else:
                raise RuntimeError("Too many iterations")


asyncio.run(main())
