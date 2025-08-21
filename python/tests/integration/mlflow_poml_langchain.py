import mlflow
import os

import poml
from poml.integration.langchain import LangchainPomlTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from mlflow_utils import check_trace, check_prompt

poml.set_trace("mlflow", trace_dir="logs")

if __name__ == "__main__":
    # Enabling autolog for LangChain will enable trace logging.
    mlflow.langchain.autolog()

    # Optional: Set a tracking URI and an experiment
    mlflow.set_experiment("poml_integration")
    mlflow.set_tracking_uri("http://localhost:5000")

    llm = ChatOpenAI(
        model="gpt-5-nano",
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
        max_tokens=128
    )

    prompt_template = LangchainPomlTemplate.from_file("../assets/explain_code.poml")

    chain = prompt_template | llm | StrOutputParser()

    result = chain.invoke(
        {"code_path": "sample.py"}
    )
    print(result)

    trace_id = mlflow.get_last_active_trace_id()
    check_trace(trace_id, ['ChatOpenAI', 'LangchainPomlTemplate', 'poml'])
    check_prompt("0001.explain_code")
