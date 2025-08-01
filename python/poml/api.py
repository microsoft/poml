from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Literal, Union
from pydantic import BaseModel
import warnings
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
OutputFormat = Literal["raw", "dict", "openai_chat", "langchain", "pydantic"]

def set_trace(
    enabled: bool | List[Backend] | Backend = True,
    /, *,
    trace_dir: Optional[str | Path] = None
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


def _read_latest_traced_file(file_suffix: str) -> Optional[str]:
    """Read the most recent traced file with the given suffix."""
    prefix = _latest_trace_prefix()
    if prefix is None:
        return None
    path = Path(str(prefix) + file_suffix)
    if not path.exists():
        return None
    with open(path, "r") as f:
        return f.read()


def trace_artifact(file_suffix: str, contents: str | bytes) -> Optional[Path]:
    """Write an additional artifact file for the most recent ``poml`` call."""
    prefix = _latest_trace_prefix()
    if prefix is None:
        return None
    suffix = file_suffix if file_suffix.startswith(".") else f".{file_suffix}"
    path = Path(str(prefix) + suffix)
    mode = "wb" if isinstance(contents, (bytes, bytearray)) else "w"
    with open(path, mode) as f:
        f.write(contents)
    return path


def write_file(content: str):
    temp_file = tempfile.NamedTemporaryFile("w")
    temp_file.write(content)
    temp_file.flush()
    return temp_file


class ContentMultiMedia(BaseModel):
    type: str  # image/png, image/jpeg, ...
    base64: str
    alt: Optional[str] = None


RichContent = Union[str, List[Union[str, ContentMultiMedia]]]

Speaker = Literal["human", "assistant", "system"]


class PomlMessage(BaseModel):
    speaker: Speaker
    content: RichContent


def _poml_response_to_openai_chat(messages: List[PomlMessage]) -> List[Dict[str, Any]]:
    """Convert PomlMessage objects to OpenAI chat format."""
    openai_messages = []
    speaker_to_role = {
        "human": "user",
        "assistant": "assistant",
        "system": "system",
    }
    
    for msg in messages:
        if msg.speaker not in speaker_to_role:
            raise ValueError(f"Unknown speaker: {msg.speaker}")
        role = speaker_to_role[msg.speaker]

        if isinstance(msg.content, str):
            openai_messages.append({"role": role, "content": msg.content})
        elif isinstance(msg.content, list):
            contents = []
            for content_part in msg.content:
                if isinstance(content_part, str):
                    contents.append({"type": "text", "text": content_part})
                elif isinstance(content_part, ContentMultiMedia):
                    contents.append({
                        "type": "image_url",
                        "image_url": {"url": f'data:{content_part.type};base64,{content_part.base64}'}
                    })
                else:
                    raise ValueError(f"Unexpected content part: {content_part}")
            openai_messages.append({"role": role, "content": contents})
        else:
            raise ValueError(f"Unexpected content type: {type(msg.content)}")
    
    return openai_messages


def _poml_response_to_langchain(messages: List[PomlMessage]) -> List[Dict[str, Any]]:
    """Convert PomlMessage objects to Langchain format."""
    langchain_messages = []
    for msg in messages:
        if isinstance(msg.content, str):
            langchain_messages.append({
                "type": msg.speaker,
                "data": {"content": msg.content}
            })
        elif isinstance(msg.content, list):
            content_parts = []
            for content_part in msg.content:
                if isinstance(content_part, str):
                    content_parts.append({"type": "text", "text": content_part})
                elif isinstance(content_part, ContentMultiMedia):
                    content_parts.append({
                        "type": "image",
                        "source_type": "base64",
                        "data": content_part.base64,
                        "mime_type": content_part.type,
                    })
                else:
                    raise ValueError(f"Unexpected content part: {content_part}")
            langchain_messages.append({
                "type": msg.speaker,
                "data": {"content": content_parts}
            })
        else:
            raise ValueError(f"Unexpected content type: {type(msg.content)}")
    return langchain_messages


def poml(
    markup: str | Path,
    context: dict | str | Path | None = None,
    stylesheet: dict | str | Path | None = None,
    chat: bool = True,
    output_file: str | Path | None = None,
    format: OutputFormat = "dict",
    extra_args: Optional[List[str]] = None,
) -> list | dict | str:
    temp_input_file = temp_context_file = temp_stylesheet_file = None
    trace_record: Dict[str, Any] | None = None
    try:
        if _trace_enabled:
            trace_record = {}
            if isinstance(markup, Path) or os.path.exists(str(markup)):
                path = Path(markup)
                trace_record["markup_path"] = str(path)
                if path.exists():
                    trace_record["markup"] = path.read_text()
            else:
                trace_record["markup"] = str(markup)

            if isinstance(context, dict):
                trace_record["context"] = json.dumps(context)
            elif context:
                if os.path.exists(str(context)):
                    cpath = Path(context)
                    trace_record["context_path"] = str(cpath)
                    trace_record["context"] = cpath.read_text()
            if isinstance(stylesheet, dict):
                trace_record["stylesheet"] = json.dumps(stylesheet)
            elif stylesheet:
                if os.path.exists(str(stylesheet)):
                    spath = Path(stylesheet)
                    trace_record["stylesheet_path"] = str(spath)
                    trace_record["stylesheet"] = spath.read_text()

        if isinstance(markup, Path):
            if not markup.exists():
                raise FileNotFoundError(f"File not found: {markup}")
        else:
            if os.path.exists(markup):
                markup = Path(markup)
            else:
                # Test if the markup looks like a path.
                if re.match(r"^[\w\-./]+$", markup):
                    warnings.warn(f"The markup '{markup}' looks like a file path, but it does not exist. Assuming it is a POML string.")

                temp_input_file = write_file(markup)
                markup = Path(temp_input_file.name)
        with tempfile.NamedTemporaryFile("r") as temp_output_file:
            if output_file is None:
                output_file = temp_output_file.name
                output_file_specified = False
            else:
                output_file_specified = True
                if isinstance(output_file, Path):
                    output_file = str(output_file)
            args = ["-f", str(markup), "-o", output_file]
            if isinstance(context, dict):
                temp_context_file = write_file(json.dumps(context))
                args.extend(["--context-file", temp_context_file.name])
            elif context:
                if os.path.exists(context):
                    args.extend(["--context-file", str(context)])
                else:
                    raise FileNotFoundError(f"File not found: {context}")

            if isinstance(stylesheet, dict):
                temp_stylesheet_file = write_file(json.dumps(stylesheet))
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
                raise RuntimeError(f"POML command failed with return code {process.returncode}. See the log for details.")

            if output_file_specified:
                with open(output_file, "r") as output_file_handle:
                    result = output_file_handle.read()
            else:
                result = temp_output_file.read()

            if format == "raw":
                # Do nothing
                pass
            else:
                result = json.loads(result)
                if format != "dict":
                    # Continue to validate the format.
                    if chat:
                        pydantic_result = [PomlMessage(**item) for item in result]
                    else:
                        # TODO: Make it a RichContent object
                        pydantic_result = [PomlMessage(speaker="human", content=result)]

                    if format == "pydantic":
                        return pydantic_result
                    elif format == "openai_chat":
                        return _poml_response_to_openai_chat(pydantic_result)
                    elif format == "langchain":
                        return _poml_response_to_langchain(pydantic_result)
                    else:
                        raise ValueError(f"Unknown output format: {format}")

            if _weave_enabled:
                from .integration import weave
                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("Weave tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml")
                context_content = _read_latest_traced_file(".context.json")
                stylesheet_content = _read_latest_traced_file(".stylesheet.json")

                weave.log_poml_call(
                    trace_prefix.name,
                    poml_content or str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    result
                )

            if _agentops_enabled:
                from .integration import agentops
                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("AgentOps tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml")
                context_content = _read_latest_traced_file(".context.json")
                stylesheet_content = _read_latest_traced_file(".stylesheet.json")
                agentops.log_poml_call(
                    trace_prefix.name,
                    str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    result
                )

            if _mlflow_enabled:
                from .integration import mlflow
                trace_prefix = _latest_trace_prefix()
                current_version = _current_trace_version()
                if trace_prefix is None or current_version is None:
                    raise RuntimeError("MLflow tracing requires local tracing to be enabled.")
                poml_content = _read_latest_traced_file(".poml")
                context_content = _read_latest_traced_file(".context.json")
                stylesheet_content = _read_latest_traced_file(".stylesheet.json")
                mlflow.log_poml_call(
                    trace_prefix.name,
                    poml_content or str(markup),
                    json.loads(context_content) if context_content else None,
                    json.loads(stylesheet_content) if stylesheet_content else None,
                    result
                )

            if trace_record is not None:
                trace_record["result"] = result
            return result
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
