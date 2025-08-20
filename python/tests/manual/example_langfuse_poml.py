import os
import poml
from langfuse.openai import openai

client = openai.OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)

poml.set_trace("langfuse", trace_dir="logs")

messages = poml.poml("example_poml.poml", context={"code_path": "example_agentops_original.py"}, format="openai_chat")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
)

print(response)
