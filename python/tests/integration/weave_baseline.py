import os
from datetime import datetime, timedelta, timezone

import weave
from openai import OpenAI
from weave_utils import check_trace

if __name__ == "__main__":
    weave.init("poml_baseline")

    # Set time cutoff to current time (timezone-aware) to capture only this run's traces
    time_cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
    print(f"Time cutoff (UTC): {time_cutoff.isoformat()}")

    prompt = weave.MessagesPrompt(
        [
            {
                "role": "system",
                "content": "You will be provided with a description of a scene and your task is to provide a single word that best describes an associated emotion.",
            },
            {"role": "user", "content": "{scene}"},
        ]
    )
    weave.publish(prompt, name="emotion_prompt")

    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    response = client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=prompt.format(scene="A dog is lying on a dock next to a fisherman."),
    )

    print("Response:", response.choices[0].message.content)

    prompt_ref = weave.get("emotion_prompt")
    print(f"Prompt reference: {prompt_ref}")

    check_trace(["openai.chat.completions.create"], time_cutoff=time_cutoff)
