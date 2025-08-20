import os
from langfuse.openai import openai

client = openai.OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)

completion = client.chat.completions.create(
    name="test-chat",
    model="gpt-4.1-mini",
    messages=[
        {
            "role": "system",
            "content": "You are a very accurate calculator. You output only the result of the calculation.",
        },
        {"role": "user", "content": "1 + 1 = "},
    ],
    metadata={"someMetadataKey": "someValue"},
)

print(completion)
