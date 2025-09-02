import os

import mlflow
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from mlflow_utils import check_trace

if __name__ == "__main__":
    mlflow.langchain.autolog()

    mlflow.set_experiment("poml_baseline")
    mlflow.set_tracking_uri(os.environ["MLFLOW_TRACKING_URI"])

    llm = ChatOpenAI(
        model="gpt-4.1-nano",
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
        max_tokens=128,
    )

    prompt_template = PromptTemplate.from_template(
        "Answer the question as if you are {person}, fully embodying their style, wit, personality, and habits of speech. "
        "Emulate their quirks and mannerisms to the best of your ability, embracing their traits—even if they aren't entirely "
        "constructive or inoffensive. The question is: {question}"
    )

    chain = prompt_template | llm | StrOutputParser()

    result = chain.invoke(
        {
            "person": "Linus Torvalds",
            "question": "Can I just set everyone's access to sudo to make things easier?",
        }
    )
    print(result)

    trace_id = mlflow.get_last_active_trace_id()
    check_trace(trace_id, ["ChatOpenAI"])
