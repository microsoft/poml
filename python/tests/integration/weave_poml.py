import os
from datetime import datetime, timezone

import weave
from openai import OpenAI
from weave_utils import check_prompt, check_trace

import poml

if __name__ == "__main__":
    weave.init("poml_weave_integration")

    # Set time cutoff to current time (timezone-aware) to capture only this run's traces
    time_cutoff = datetime.now(timezone.utc)
    print(f"Time cutoff (UTC): {time_cutoff.isoformat()}")

    poml.set_trace("weave", trace_dir="pomlruns")

    messages = poml.poml("../assets/explain_code.poml", context={"code_path": "sample.py"}, format="openai_chat")
    print("POML messages:", messages)

    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    response = client.chat.completions.create(model="gpt-4.1-nano", **messages)

    print("Response:", response.choices[0].message.content)

    prompt_ref = weave.get("0001.explain_code")
    print(f"Prompt reference: {prompt_ref}")

    check_prompt("0001.explain_code")
    check_trace(["openai.chat.completions.create", "poml"], time_cutoff)
