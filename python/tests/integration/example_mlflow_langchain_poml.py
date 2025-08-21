import mlflow
import os

import poml
from poml.integration.langchain import LangchainPomlTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

poml.set_trace("mlflow", trace_dir="logs")

# Enabling autolog for LangChain will enable trace logging.
mlflow.langchain.autolog()

# Optional: Set a tracking URI and an experiment
mlflow.set_experiment("LangChain")
mlflow.set_tracking_uri("http://localhost:5000")

llm = ChatOpenAI(
    model="gpt-4o-mini",
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"]
)

prompt_template = LangchainPomlTemplate.from_file("example_poml.poml")

chain = prompt_template | llm | StrOutputParser()

result = chain.invoke(
    {"code_path": "example_agentops_original.py"}
)
print(result)
