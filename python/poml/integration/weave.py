from __future__ import annotations

from typing import Any

import weave


def log_poml_call(name: str, prompt: str, context: dict | None, stylesheet: dict | None, result: Any) -> Any:
    """Log the entire poml call to weave."""

    @weave.op
    def poml(prompt, context, stylesheet):
        return result

    prompt_ref = weave.publish(prompt, name=name)
    if context is not None:
        context_ref = weave.publish(context, name=name + ".context")
    else:
        context_ref = context
    if stylesheet is not None and stylesheet != "{}":
        stylesheet_ref = weave.publish(stylesheet, name=name + ".stylesheet")
    else:
        stylesheet_ref = stylesheet

    poml(prompt_ref, context_ref, stylesheet_ref)
