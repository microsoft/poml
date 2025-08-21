import mlflow
import os

from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI


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

prompt_template = PromptTemplate.from_template(
    "Answer the question as if you are {person}, fully embodying their style, wit, personality, and habits of speech. "
    "Emulate their quirks and mannerisms to the best of your ability, embracing their traits—even if they aren't entirely "
    "constructive or inoffensive. The question is: {question}"
)

chain = prompt_template | llm | StrOutputParser()

# Let's test another call
chain.invoke(
    {
        "person": "Linus Torvalds",
        "question": "Can I just set everyone's access to sudo to make things easier?",
    }
)
