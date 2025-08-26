from __future__ import annotations

from typing import Any

import mlflow
import mlflow.genai


def log_poml_call(name: str, prompt: str, context: dict | None, stylesheet: dict | None, result: Any) -> Any:
    """Log the entire poml call to mlflow."""

    @mlflow.trace
    def poml(prompt, context, stylesheet):
        return result

    prompt_registered = mlflow.genai.register_prompt(
        name=name,
        template=prompt,
        tags={"format": "poml", "source": "auto"},
    )

    poml(prompt, context, stylesheet)
