from __future__ import annotations

from typing import Any
from langfuse import get_client, observe


def log_poml_call(
    name: str, prompt: str, context: dict | None, stylesheet: dict | None, result: Any
) -> Any:
    """Log the entire poml call to Langfuse."""
    client = get_client()

    @observe(name=name)
    def poml(prompt, context, stylesheet):
        client.update_current_generation(prompt=prompt_client)
        return result

    prompt_client = client.create_prompt(
        name=name,
        type="text",
        prompt=prompt
    )

    poml(prompt=prompt, context=context, stylesheet=stylesheet)
