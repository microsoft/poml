import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from .cli import run

_trace_enabled: bool = False
_trace_log: List[Dict[str, Any]] = []
_trace_dir: Optional[Path] = None


def set_trace(enabled: bool = True, tempdir: Optional[str | Path] = None) -> Optional[Path]:
    """Enable or disable tracing of ``poml`` calls.

    If ``tempdir`` is provided when enabling tracing, a subdirectory named by
    the current timestamp (in nanoseconds) is created inside ``tempdir``. The
    returned directory may be shared with subprocesses by setting the
    ``POML_TRACE`` environment variable in the invoking script.
    """

    global _trace_enabled, _trace_dir
    _trace_enabled = enabled

    if not enabled:
        _trace_dir = None
        return None

    env_dir = os.environ.get("POML_TRACE")
    if tempdir is not None:
        base = Path(tempdir)
        base.mkdir(parents=True, exist_ok=True)
        run_dir = base / str(time.time_ns())
        run_dir.mkdir(parents=True, exist_ok=True)
        _trace_dir = run_dir
    elif env_dir:
        run_dir = Path(env_dir)
        run_dir.mkdir(parents=True, exist_ok=True)
        _trace_dir = run_dir
    else:
        _trace_dir = None
    return _trace_dir


def clear_trace() -> None:
    """Clear the collected trace log."""
    _trace_log.clear()


def get_trace() -> List[Dict[str, Any]]:
    """Return a copy of the trace log."""
    return list(_trace_log)


def write_file(content: str):
    temp_file = tempfile.NamedTemporaryFile("w")
    temp_file.write(content)
    temp_file.flush()
    return temp_file


def poml(
    markup: str | Path, context: dict | str | Path | None = None, stylesheet: dict | str | Path | None = None,
    chat: bool = True, output_file: str | Path | None = None, parse_output: bool = True,
    extra_args: Optional[List[str]] = None
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
            run(*args)

            if output_file_specified:
                with open(output_file, "r") as output_file_handle:
                    result = output_file_handle.read()
            else:
                result = temp_output_file.read()

            if parse_output:
                result = json.loads(result)

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
