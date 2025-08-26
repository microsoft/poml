import os

import agentops
from agentops_utils import check_trace, get_trace_id
from openai import OpenAI

import poml

if __name__ == "__main__":
    api_key = os.environ["AGENTOPS_API_KEY"]
    agentops.init(auto_start_session=False, api_key=api_key)
    trace = agentops.start_trace("poml_integration")
    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    poml.set_trace("agentops", trace_dir="pomlruns")
    messages = poml.poml("../assets/explain_code.poml", context={"code_path": "sample.py"}, format="openai_chat")
    print(messages)

    response = client.chat.completions.create(model="gpt-4.1-nano", **messages)

    print(response.choices[0].message.content)
    agentops.end_trace(trace, "Success")

    trace_id = get_trace_id(trace)
    check_trace(trace_id, api_key, ["openai.chat.completion", "poml.task"])
