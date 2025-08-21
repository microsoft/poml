import weave
import os
from openai import OpenAI

weave.init("intro-example")

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
    model="gpt-4o",
    messages=prompt.format(scene="A dog is lying on a dock next to a fisherman."),
)
