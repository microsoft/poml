import asyncio
import json
import os

from common_utils import print_section
from mcp import ClientSession, types
from mcp.client.sse import sse_client
from openai import OpenAI

client = OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)


async def main():
    server_url = "http://127.0.0.1:8090/sse"
    async with sse_client(server_url) as (read, write):
        async with ClientSession(read, write) as mcp_session:
            await mcp_session.initialize()
            mcp_tools = (await mcp_session.list_tools()).tools
            print_section("MCP tools", str(mcp_tools))

            # Convert MCP tools into OpenAI Chat Completions tools
            oa_tools = []
            for t in mcp_tools:
                oa_tools.append(
                    {
                        "type": "function",
                        "function": {"name": t.name, "description": t.description, "parameters": t.inputSchema},
                    }
                )

            # Start a chat with a user asking to roll dice
            messages = [
                {"role": "system", "content": "You are a helpful DM assistant. Use the dice-rolling tool when needed."},
                {"role": "user", "content": "Roll 2d4+1"},
            ]

            for _ in range(10):
                resp = client.chat.completions.create(
                    model="gpt-4.1-nano",
                    messages=messages,
                    tools=oa_tools,
                    tool_choice="auto",
                )

                print_section("Response", str(resp))

                msg = resp.choices[0].message
                messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": msg.tool_calls})

                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        fn = tc.function
                        args = json.loads(fn.arguments or "{}")

                        # Call the MCP server tool
                        result = await mcp_session.call_tool(fn.name, args)

                        print_section("Tool result", str(result))

                        # Convert result content into text
                        text_result = ""
                        if result.structuredContent is not None:
                            text_result = json.dumps(result.structuredContent)
                        else:
                            text_result = "\n".join(
                                [c.text for c in result.content if isinstance(c, types.TextContent)]
                            )

                        # Feed tool result back to the chat
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc.id,
                                "name": fn.name,
                                "content": text_result,
                            }
                        )
                    continue  # loop again to let the model process tool output

                # No tool calls => final output
                print_section("Assistant", msg.content or "")
                break
            else:
                raise RuntimeError("Too many iterations")


asyncio.run(main())
