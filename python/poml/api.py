from __future__ import annotations

import json
import os
import re
import tempfile
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel

from .cli import run

__all__ = [
    "set_trace",
    "clear_trace",
    "get_trace",
    "trace_artifact",
    "poml",
    "Backend",
    "OutputFormat",
]

_trace_enabled: bool = False
_weave_enabled: bool = False
_agentops_enabled: bool = False
_mlflow_enabled: bool = False
_trace_log: List[Dict[str, Any]] = []
_trace_dir: Optional[Path] = None

Backend = Literal["local", "weave", "agentops", "mlflow"]
OutputFormat = Literal["raw", "message_dict", "dict", "openai_chat", "langchain", "pydantic"]


def set_trace(
    enabled: bool | List[Backend] | Backend = True, /, *, trace_dir: Optional[str | Path] = None
) -> Optional[Path]:
    """Enable or disable tracing of ``poml`` calls with optional backend integrations.

    Args:
        enabled: Controls which tracing backends to enable. Can be:
            - True: Enable local tracing only (equivalent to ["local"])
            - False: Disable all tracing (equivalent to [])
            - str: Enable a single backend ("local", "weave", "agentops", "mlflow")
            - List[str]: Enable multiple backends. "local" is auto-enabled if any backends are specified.
        trace_dir: Optional directory for local trace files. If provided when local
            tracing is enabled, a subdirectory named by the current timestamp
            (YYYYMMDDHHMMSSffffff) is created inside trace_dir.

    Returns:
        Path to the trace directory if local tracing is enabled, None otherwise.
        The directory may be shared with POML Node.js by setting the
        POML_TRACE environment variable in the invoking script.

    Available backends:
        - "local": Save trace files to disk
        - "weave": Log to Weights & Biases Weave (requires local tracing)
        - "agentops": Log to AgentOps (requires local tracing)
        - "mlflow": Log to MLflow (requires local tracing)
    """

    if enabled is True:
        enabled = ["local"]
    elif enabled is False:
        enabled = []

    if isinstance(enabled, str):
        enabled = [enabled]

    global _trace_enabled, _trace_dir, _weave_enabled, _agentops_enabled, _mlflow_enabled
    if enabled or "local" in enabled:
        # When enabled is non-empty, we always enable local tracing.
        _trace_enabled = True
        env_dir = os.environ.get("POML_TRACE")
        if trace_dir is not None:
            base = Path(trace_dir)
            base.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d%H%M%S%f")
            run_dir = base / ts
            run_dir.mkdir(parents=True, exist_ok=True)
            _trace_dir = run_dir
        elif env_dir:
            run_dir = Path(env_dir)
            run_dir.mkdir(parents=True, exist_ok=True)
            _trace_dir = run_dir
        else:
            _trace_dir = None
    else:
        _trace_enabled = False
        _trace_dir = None

    if "weave" in enabled:
        _weave_enabled = True
    else:
        _weave_enabled = False

    if "agentops" in enabled:
        _agentops_enabled = True
    else:
        _agentops_enabled = False

    if "mlflow" in enabled:
        _mlflow_enabled = True
    else:
        _mlflow_enabled = False

    return _trace_dir


def clear_trace() -> None:
    """Clear the collected trace log."""
    _trace_log.clear()


def get_trace() -> List[Dict[str, Any]]:
    """Return a copy of the trace log."""
    return list(_trace_log)


def _current_trace_version() -> Optional[str]:
    """Return the current trace version."""
    if not (_trace_enabled and _trace_dir):
        return None
    else:
        return _trace_dir.name


def _latest_trace_prefix() -> Optional[Path]:
    if not (_trace_enabled and _trace_dir):
        return None

    pattern = re.compile(r"^(\d{4}.*?)(?:\.source)?\.poml$")
    latest_idx = -1
    latest_prefix: Optional[Path] = None

    for f in _trace_dir.iterdir():
        match = pattern.match(f.name)
        if not match:
            continue
        prefix_part = match.group(1)
        # skip any source link files
        if prefix_part.endswith(".source"):
            continue
        try:
            idx = int(prefix_part.split(".")[0])
        except ValueError:
            continue
        if idx > latest_idx:
            latest_idx = idx
            latest_prefix = _trace_dir / prefix_part

    return latest_prefix


def _read_latest_traced_file(file_suffix: str, encoding: str | None = None) -> Optional[str]:
    """Read the most recent traced file with the given suffix."""
    prefix = _latest_trace_prefix()
    if prefix is None:
        return None
    path = Path(str(prefix) + file_suffix)
    if not path.exists():
        return None
    with open(path, "r", encoding=encoding) as f:
        return f.read()


def trace_artifact(file_suffix: str, contents: str | bytes, encoding: str | None = None) -> Optional[Path]:
    """Write an additional artifact file for the most recent ``poml`` call. This API is experimental."""
    prefix = _latest_trace_prefix()
    if prefix is None:
        return None
    suffix = file_suffix if file_suffix.startswith(".") else f".{file_suffix}"
    path = Path(str(prefix) + suffix)
    mode = "wb" if isinstance(contents, (bytes, bytearray)) else "w"
    with open(path, mode, encoding=(encoding if mode == "w" else None)) as f:
        f.write(contents)
    return path


def write_file(content: str, encoding: str | None = None):
    temp_file = tempfile.NamedTemporaryFile("w", encoding=encoding)
    temp_file.write(content)
    temp_file.flush()
    return temp_file


class ContentMultiMedia(BaseModel):
    type: str  # image/png, image/jpeg, ...
    base64: str
    alt: Optional[str] = None


class ContentMultiMediaToolRequest(BaseModel):
    type: Literal["application/vnd.poml.toolrequest"]
    id: str
    name: str
    content: Any  # The parameters/input for the tool


class ContentMultiMediaToolResponse(BaseModel):
    type: Literal["application/vnd.poml.toolresponse"]
    id: str
    name: str
    content: Union[str, List[Union[str, ContentMultiMedia]]]  # Rich content


RichContent = Union[
    str, List[Union[str, ContentMultiMedia, ContentMultiMediaToolRequest, ContentMultiMediaToolResponse]]
]

Speaker = Literal["human", "ai", "system", "tool"]


class PomlMessage(BaseModel):
    speaker: Speaker
    content: RichContent


class PomlFrame(BaseModel):
    messages: List[PomlMessage]
    output_schema: Optional[Dict[str, Any]] = None  # because schema is taken
    tools: Optional[List[Dict[str, Any]]] = None
    runtime: Optional[Dict[str, Any]] = None


def _poml_response_to_openai_chat(messages: List[PomlMessage]) -> List[Dict[str, Any]]:
    """Convert PomlMessage objects to OpenAI chat format."""
    openai_messages = []
    speaker_to_role = {
        "human": "user",
        "ai": "assistant",
        "system": "system",
        "tool": "tool",
    }

    for msg in messages:
        role = speaker_to_role.get(msg.speaker)
        if not role:
            raise ValueError(f"Unknown speaker: {msg.speaker}")

        # Handle tool messages separately
        if msg.speaker == "tool":
            # Tool messages should contain a tool response
            if isinstance(msg.content, list):
                for content_part in msg.content:
                    if isinstance(content_part, ContentMultiMediaToolResponse):
                        # Convert rich content to text
                        if isinstance(content_part.content, str):
                            tool_content = content_part.content
                        else:
                            tool_content = _rich_content_to_text(content_part.content)

                        openai_messages.append(
                            {"role": "tool", "content": tool_content, "tool_call_id": content_part.id}
                        )
            elif isinstance(msg.content, str):
                # Simple tool message (shouldn't normally happen but handle gracefully)
                openai_messages.append({"role": "tool", "content": msg.content})
            continue

        # Handle assistant/user/system messages
        if isinstance(msg.content, str):
            openai_messages.append({"role": role, "content": msg.content})
        elif isinstance(msg.content, list):
            text_image_contents = []
            tool_calls = []

            for content_part in msg.content:
                if isinstance(content_part, str):
                    text_image_contents.append({"type": "text", "text": content_part})
                elif isinstance(content_part, ContentMultiMedia):
                    text_image_contents.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{content_part.type};base64,{content_part.base64}"},
                        }
                    )
                elif isinstance(content_part, ContentMultiMediaToolRequest):
                    # Tool requests are only valid in assistant messages
                    if role != "assistant":
                        raise ValueError(f"Tool request found in non-assistant message with speaker: {msg.speaker}")

                    tool_calls.append(
                        {
                            "id": content_part.id,
                            "type": "function",
                            "function": {
                                "name": content_part.name,
                                "arguments": (
                                    json.dumps(content_part.content)
                                    if not isinstance(content_part.content, str)
                                    else content_part.content
                                ),
                            },
                        }
                    )
                elif isinstance(content_part, ContentMultiMediaToolResponse):
                    # Tool responses should be in tool messages, not here
                    raise ValueError(f"Tool response found in {msg.speaker} message; should be in tool message")
                else:
                    raise ValueError(f"Unexpected content part type: {type(content_part)}")

            # Build the message
            message: Dict[str, Any] = {"role": role}

            # Add content if present
            if text_image_contents:
                if len(text_image_contents) == 1 and text_image_contents[0].get("type") == "text":
                    message["content"] = text_image_contents[0]["text"]
                else:
                    message["content"] = text_image_contents

            # Add tool calls if present (assistant only)
            if tool_calls:
                message["tool_calls"] = tool_calls
            elif not text_image_contents:
                # If no content and no tool calls, skip this message
                pass

            # Only add message if it has content or tool_calls
            if "content" in message or "tool_calls" in message:
                openai_messages.append(message)
        else:
            raise ValueError(f"Unexpected content type: {type(msg.content)}")

    return openai_messages


def _rich_content_to_text(content: Union[str, List[Union[str, ContentMultiMedia]]]) -> str:
    """Convert rich content to text representation."""
    if isinstance(content, str):
        return content

    text_parts = []
    for part in content:
        if isinstance(part, str):
            text_parts.append(part)
        elif isinstance(part, ContentMultiMedia):
            # For images and other media, use alt text or type description
            if part.alt:
                text_parts.append(f"[{part.type}: {part.alt}]")
            else:
                text_parts.append(f"[{part.type}]")
        else:
            raise ValueError(f"Unexpected content part type: {type(part)}")

    return "\n\n".join(text_parts)


def _poml_response_to_langchain(messages: List[PomlMessage]) -> List[Dict[str, Any]]:
    """Convert PomlMessage objects to Langchain format."""
    langchain_messages = []
    for msg in messages:
        if isinstance(msg.content, str):
            langchain_messages.append({"type": msg.speaker, "data": {"content": msg.content}})
        elif isinstance(msg.content, list):
            content_parts = []
            tool_calls = []

            for content_part in msg.content:
                if isinstance(content_part, str):
                    content_parts.append({"type": "text", "text": content_part})
                elif isinstance(content_part, ContentMultiMedia):
                    content_parts.append(
                        {
                            "type": "image",
                            "source_type": "base64",
                            "data": content_part.base64,
                            "mime_type": content_part.type,
                        }
                    )
                elif isinstance(content_part, ContentMultiMediaToolRequest):
                    tool_calls.append({"id": content_part.id, "name": content_part.name, "args": content_part.content})
                elif isinstance(content_part, ContentMultiMediaToolResponse):
                    # For tool responses in Langchain format
                    if isinstance(content_part.content, str):
                        tool_content = content_part.content
                    else:
                        tool_content = _rich_content_to_text(content_part.content)

                    langchain_messages.append(
                        {
                            "type": "tool",
                            "data": {
                                "content": tool_content,
                                "tool_call_id": content_part.id,
                                "name": content_part.name,
                            },
                        }
                    )
                else:
                    raise ValueError(f"Unexpected content part: {content_part}")

            # Build the message data
            message_data: Dict[str, Any] = {}
            if content_parts:
                if len(content_parts) == 1 and content_parts[0].get("type") == "text":
                    message_data["content"] = content_parts[0]["text"]
                else:
                    message_data["content"] = content_parts

            if tool_calls:
                message_data["tool_calls"] = tool_calls

            # Only add message if it has content or tool_calls
            if message_data:
                langchain_messages.append({"type": msg.speaker, "data": message_data})
        else:
            raise ValueError(f"Unexpected content type: {type(msg.content)}")
    return langchain_messages


def _camel_case_to_snake_case(name: str) -> str:
    """Convert CamelCase to snake_case."""
    # Insert one underscore before each uppercase letter, then convert to lowercase
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def poml(
    markup: str | Path,
    context: dict | str | Path | None = None,
    stylesheet: dict | str | Path | None = None,
    chat: bool = True,
    output_file: str | Path | None = None,
    format: OutputFormat = "message_dict",
    encoding: str | None = None,
    extra_args: Optional[List[str]] = None,
) -> list | dict | str | PomlFrame:
    """Process POML markup and return the result in the specified format.

    POML (Prompt Orchestration Markup Language) is a markup language for creating
    structured prompts and conversations. This function processes POML markup
    with optional context and styling, returning the result in various formats
    optimized for different LLM frameworks and use cases.

    Args:
        markup: POML markup content as a string, or path to a POML file.
            If a string that looks like a file path but doesn't exist,
            a warning is issued and it's treated as markup content.
        context: Optional context data to inject into the POML template.
            Can be a dictionary, JSON string, or path to a JSON file.
        stylesheet: Optional stylesheet for customizing POML rendering.
            Can be a dictionary, JSON string, or path to a JSON file.
        chat: If True, process as a chat conversation (default).
            If False, process as a single prompt.
        output_file: Optional path to save the output. If not provided,
            output is returned directly without saving to disk.
        format: Output format for the result:
            - "raw": Raw string output from POML processor
            - "message_dict": Legacy format returning just messages array (default)
            - "dict": Full CLI result structure with messages, schema, tools, runtime
            - "openai_chat": OpenAI Chat Completion API format with tool support
            - "langchain": LangChain message format with structured data
            - "pydantic": PomlFrame object with typed Pydantic models
        encoding: Optional file encoding for both reading input POML file and
            writing output file.
        extra_args: Additional command-line arguments to pass to the POML processor.

    Returns:
        The processed result in the specified format:
        - str when format="raw"
        - list when format="message_dict" (legacy messages array)
        - dict when format="dict", "openai_chat", or "langchain"
        - PomlFrame when format="pydantic"

        For format="message_dict": Returns just the messages array for backward
        compatibility. Example: `[{"speaker": "human", "content": "Hello"}]`

        For format="dict": Returns complete structure with all metadata.
        Example: `{"messages": [...], "schema": {...}, "tools": [...], "runtime": {...}}`

        For format="openai_chat": Returns OpenAI Chat Completion format with tool/schema
        support. Includes "messages" in OpenAI format, "tools" if present, "response_format"
        for JSON schema if present, and runtime parameters converted to `snake_case`.

        For format="langchain": Returns LangChain format preserving all metadata with
        "messages" in LangChain format plus schema, tools, and runtime if present.

        For format="pydantic": Returns strongly-typed PomlFrame object containing
        messages as PomlMessage objects, output_schema, tools, and runtime.

    Raises:
        FileNotFoundError: When a specified file path doesn't exist.
        RuntimeError: When the POML processor fails or backend tracing requirements aren't met.
        ValueError: When an invalid output format is specified.

    Examples:
        Basic usage with markup string:
        >>> result = poml("<p>Hello {{name}}!</p>", context={"name": "World"})

        Load from file with context:
        >>> result = poml("template.poml", context="context.json")

        Get OpenAI chat format:
        >>> messages = poml("chat.poml", format="openai_chat")

        Use with custom stylesheet:
        >>> result = poml(
        ...     markup="template.poml",
        ...     context={"user": "Alice"},
        ...     stylesheet={"role": {"captionStyle": "bold"}},
        ...     format="pydantic"
        ... )

        Save output to file:
        >>> poml("template.poml", output_file="output.json", format="raw")

    Note:
        - When tracing is enabled via set_trace(), call details are automatically logged
        - The function supports various backend integrations (Weave, AgentOps, MLflow)
        - Multi-modal content (images, etc.) is supported in chat format
    """
    temp_input_file = temp_context_file = temp_stylesheet_file = None
    trace_record: Dict[str, Any] | None = None
    try:
        if _trace_enabled:
            trace_record = {}
            if isinstance(markup, Path) or os.path.exists(str(markup)):
                path = Path(markup)
                trace_record["markup_path"] = str(path)
                if path.exists():
                    trace_record["markup"] = path.read_text(encoding=encoding)
            else:
                trace_record["markup"] = str(markup)

            if isinstance(context, dict):
                trace_record["context"] = json.dumps(context)
            elif context:
                if os.path.exists(str(context)):
                    cpath = Path(context)
                    trace_record["context_path"] = str(cpath)
                    trace_record["context"] = cpath.read_text(encoding=encoding)
            if isinstance(stylesheet, dict):
                trace_record["stylesheet"] = json.dumps(stylesheet)
            elif stylesheet:
                if os.path.exists(str(stylesheet)):
                    spath = Path(stylesheet)
                    trace_record["stylesheet_path"] = str(spath)
                    trace_record["stylesheet"] = spath.read_text(encoding=encoding)

        if isinstance(markup, Path):
            if not markup.exists():
                raise FileNotFoundError(f"File not found: {markup}")
        else:
            if os.path.exists(markup):
                markup = Path(markup)
            else:
                # Test if the markup looks like a path.
                if re.match(r"^[\w\-./]+$", markup):
                    warnings.warn(
                        f"The markup '{markup}' looks like a file path, but it does not exist. Assuming it is a POML string."
                    )

                temp_input_file = write_file(markup, encoding=encoding)
                markup = Path(temp_input_file.name)
        with tempfile.NamedTemporaryFile("r", encoding=encoding) as temp_output_file:
            if output_file is None:
                output_file = temp_output_file.name
                output_file_specified = False
            else:
                output_file_specified = True
                if isinstance(output_file, Path):
                    output_file = str(output_file)
            args = ["-f", str(markup), "-o", output_file]
            if isinstance(context, dict):
                temp_context_file = write_file(json.dumps(context), encoding=encoding)
                args.extend(["--context-file", temp_context_file.name])
            elif context:
                if os.path.exists(context):
                    args.extend(["--context-file", str(context)])
                else:
                    raise FileNotFoundError(f"File not found: {context}")

            if isinstance(stylesheet, dict):
                temp_stylesheet_file = write_file(json.dumps(stylesheet), encoding=encoding)
                args.extend(["--stylesheet-file", temp_stylesheet_file.name])
            elif stylesheet:
                if os.path.exists(stylesheet):
                    args.extend(["--stylesheet-file", str(stylesheet)])
                else:
                    raise FileNotFoundError(f"File not found: {stylesheet}")

            if chat:
                args.extend(["--chat", "true"])
            else:
                args.extend(["--chat", "false"])

            if _trace_enabled and _trace_dir is not None:
                args.extend(["--traceDir", str(_trace_dir)])

            if extra_args:
                args.extend(extra_args)
            process = run(*args)
            if process.returncode != 0:
                raise RuntimeError(
                    f"POML command failed with return code {process.returncode}. See the log for details."
                )

            if output_file_specified:
                with open(output_file, "r", encoding=encoding) as output_file_handle:
                    result = output_file_handle.read()
            else:
                result = temp_output_file.read()

            if format == "raw":
                # Do nothing
                return_result = trace_result = result
            else:
                parsed_result = trace_result = json.loads(result)

                # Handle the new CLI result format with messages, schema, tools, runtime
                if isinstance(parsed_result, dict) and "messages" in parsed_result:
                    cli_result = parsed_result
                    messages_data = cli_result["messages"]
                else:
                    # Legacy format - just messages
                    cli_result: dict = {"messages": parsed_result}
                    messages_data = parsed_result

                if format == "message_dict":
                    # Legacy behavior - return just the messages
                    return_result = messages_data
                elif format == "dict":
                    # Return the full CLI result structure
                    return_result = cli_result
                else:
                    # Convert to pydantic messages for other formats
                    if chat:
                        pydantic_messages = [PomlMessage(**item) for item in messages_data]
                    else:
                        # TODO: Make it a RichContent object
                        pydantic_messages = [PomlMessage(speaker="human", content=messages_data)]  # type: ignore

                    # Create PomlFrame with full data
                    poml_frame = PomlFrame(
                        messages=pydantic_messages,
                        output_schema=cli_result.get("schema"),
                        tools=cli_result.get("tools"),
                        runtime=cli_result.get("runtime"),
                    )

                    if format == "pydantic":
                        return_result = poml_frame
                    elif format == "openai_chat":
                        # Return OpenAI-compatible format
                        openai_messages = _poml_response_to_openai_chat(pydantic_messages)
                        openai_result: dict = {"messages": openai_messages}

                        # Add tools if present
                        if poml_frame.tools:
                            openai_result["tools"] = [
                                {
                                    "type": "function",
                                    "function": {
                                        "name": tool.get("name", ""),
                                        "description": tool.get("description", ""),
                                        "parameters": tool.get("parameters", {}),
                                    },  # FIXME: hot-fix for the wrong format at node side
                                }
                                for tool in poml_frame.tools
                            ]
                        if poml_frame.output_schema:
                            openai_result["response_format"] = {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": "schema",  # TODO: support schema name
                                    "schema": poml_frame.output_schema,
                                    "strict": True,  # Ensure strict validation
                                },
                            }
                        if poml_frame.runtime:
                            openai_result.update(
                                {_camel_case_to_snake_case(k): v for k, v in poml_frame.runtime.items()}
                            )

                        return_result = openai_result
                    elif format == "langchain":
                        messages_data = _poml_response_to_langchain(pydantic_messages)
                        return_result = {
                            "messages": messages_data,
                            **{k: v for k, v in cli_result.items() if k != "messages"},
                        }
                    else:
                        raise ValueError(f"Unknown output format: {format}")

            if _weave_enabled:
                from .integration import weave

                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("Weave tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml", encoding=encoding)
                context_content = _read_latest_traced_file(".context.json", encoding=encoding)
                stylesheet_content = _read_latest_traced_file(".stylesheet.json", encoding=encoding)

                weave.log_poml_call(
                    trace_prefix.name,
                    poml_content or str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    trace_result,
                )

            if _agentops_enabled:
                from .integration import agentops

                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("AgentOps tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml", encoding=encoding)
                context_content = _read_latest_traced_file(".context.json", encoding=encoding)
                stylesheet_content = _read_latest_traced_file(".stylesheet.json", encoding=encoding)
                agentops.log_poml_call(
                    trace_prefix.name,
                    str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    trace_result,
                )

            if _mlflow_enabled:
                from .integration import mlflow

                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("MLflow tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml", encoding=encoding)
                context_content = _read_latest_traced_file(".context.json", encoding=encoding)
                stylesheet_content = _read_latest_traced_file(".stylesheet.json", encoding=encoding)
                mlflow.log_poml_call(
                    trace_prefix.name,
                    poml_content or str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    trace_result,
                )

            if trace_record is not None:
                trace_record["result"] = trace_result
            return return_result
    finally:
        if temp_input_file:
            temp_input_file.close()
        if temp_context_file:
            temp_context_file.close()
        if temp_stylesheet_file:
            temp_stylesheet_file.close()
        if trace_record is not None:
            _trace_log.append(trace_record)


if os.getenv("POML_TRACE") and not _trace_enabled:
    set_trace(True)
