import mlflow
import mlflow.openai
import openai
from openai import OpenAI
import os
import poml

# Set up MLflow experiment
mlflow.set_experiment("openai-tracing-quickstart")

# Enable automatic tracing for all OpenAI API calls
mlflow.openai.autolog()

poml.set_trace("mlflow", trace_dir="logs")

client = OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)

messages = poml.poml("example_poml.poml", context={"code_path": "example_agentops_original.py"}, format="openai_chat")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    temperature=0.7,
)
response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=messages,
    temperature=0.7,
)
print(response)
