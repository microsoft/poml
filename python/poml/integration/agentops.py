from __future__ import annotations

from typing import Any

import agentops


def log_poml_call(name: str, prompt: str, context: dict | None, stylesheet: dict | None, result: Any) -> Any:
    """Log the entire poml call to agentops."""

    @agentops.operation(name="poml")
    def poml(prompt, context, stylesheet):
        return result

    poml(prompt, context, stylesheet)
