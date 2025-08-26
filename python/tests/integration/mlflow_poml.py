import os

import mlflow
import mlflow.openai
from mlflow_utils import check_prompt, check_trace
from openai import OpenAI

import poml

if __name__ == "__main__":
    poml.set_trace("mlflow", trace_dir="pomlruns")

    mlflow.set_experiment("poml_integration")
    mlflow.set_tracking_uri("http://localhost:5000")

    mlflow.openai.autolog()

    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    messages = poml.poml("../assets/explain_code.poml", context={"code_path": "sample.py"}, format="openai_chat")
    print("POML messages:", messages)

    trace_id = mlflow.get_last_active_trace_id()
    check_trace(trace_id, ["poml"])

    response = client.chat.completions.create(model="gpt-4.1-nano", **messages)

    print("Response:", response.choices[0].message.content)

    trace_id = mlflow.get_last_active_trace_id()
    check_trace(trace_id, ["Completions"])
    check_prompt("0001.explain_code")
