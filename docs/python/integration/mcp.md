// intro to what is MCP.

!!! warning

    This document discusses a workaround to use POML with MCP. Native support for MCP is planned for a future release.

POML does not have built-in support for MCP yet. Currenly, we resort to tool calls with templates to emulate a MCP-like behavior. Here's how.

!!! note

    Some providers support calling MCP servers at remote, e.g., [OpenAI Response API](https://platform.openai.com/docs/api-reference/responses). Those behaviors are outside the scope of this document because developers do not need to handle MCP invocations at all.
