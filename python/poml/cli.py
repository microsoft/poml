from __future__ import annotations

import os
import subprocess
import sys
from typing import Any, NoReturn

import nodejs_wheel


def node(*args: str, **kwargs: Any) -> subprocess.CompletedProcess[bytes | str]:
    return nodejs_wheel.node(args, return_completed_process=True, **kwargs)


def run(*args: str, **kwargs: Any) -> subprocess.CompletedProcess[bytes | str]:
    script = os.path.join(os.path.dirname(__file__), "js", "cli.js")
    if not os.path.exists(script):
        raise RuntimeError(f"Expected CLI entrypoint: {script} to exist")

    return node(script, *args, **kwargs)


def entrypoint() -> NoReturn:
    sys.exit(run(*sys.argv[1:]).returncode)
