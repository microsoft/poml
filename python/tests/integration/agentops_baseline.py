import os
import time

import agentops
from agentops_utils import check_trace, get_trace_id
from openai import OpenAI

if __name__ == "__main__":
    api_key = os.environ["AGENTOPS_API_KEY"]
    agentops.init(auto_start_session=False, api_key=api_key)
    trace = agentops.start_trace("poml_baseline")
    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    response = client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[{"role": "user", "content": "Write a haiku about AI and humans working together"}],
    )

    print(response.choices[0].message.content)
    agentops.end_trace(trace, "Success")

    trace_id = get_trace_id(trace)
    check_trace(trace_id, api_key, ["openai.chat.completion"])
