import mlflow
import os

import poml
from poml.integration.llamaindex import LlamaIndexPomlTemplate
from llama_index.core.output_parsers.langchain import LangchainOutputParser
from llama_index.llms.openai import OpenAI

# Set up POML tracing
poml.set_trace("mlflow", trace_dir="logs")

# Enable autolog for LlamaIndex (note: using llamaindex instead of langchain)
mlflow.llama_index.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_experiment("LlamaIndex")
mlflow.set_tracking_uri("http://localhost:5000")


llm = OpenAI(
    model="gpt-4o-mini",
    api_base=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"]
)

prompt_template = LlamaIndexPomlTemplate.from_file("example_poml.poml")

result = prompt_template.invoke(
    llm=llm,
    variables={"code_path": "example_agentops_original.py"}
)

print(result)