import os

from common_utils import print_section
from flask import json
from openai import OpenAI

import poml


def get_horoscope(sign):
    return f"{sign}: Next Tuesday you will befriend a baby otter."


if __name__ == "__main__":
    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    # Request 1. Tool call
    context = {
        "tool_request": None,
        "tool_response": None,
    }

    params = poml.poml("../assets/tool_call.poml", context=context, format="openai_chat")
    print_section("Parameters", str(params))
    assert "tools" in params
    response = client.chat.completions.create(model="gpt-4.1-nano", **params)

    # Process tool call
    print_section("Response Choice", str(response.choices[0]))
    tool_call = response.choices[0].message.tool_calls[0]
    context["tool_request"] = {
        "name": tool_call.function.name,
        "parameters": json.loads(tool_call.function.arguments),
        "id": tool_call.id,
    }
    print_section("Tool request", str(context["tool_request"]))
    result = {"horoscope": get_horoscope(**context["tool_request"]["parameters"])}

    # Request 2. Tool response
    context["tool_response"] = {
        "name": tool_call.function.name,
        "result": result,
        "id": tool_call.id,
    }
    print_section("Context", str(context))
    assert isinstance(context["tool_response"]["result"], dict)
    params = poml.poml("../assets/tool_call.poml", context=context, format="openai_chat")
    print_section("Updated Parameters", str(params))
    assert len(params["messages"]) == 3
    assert params["messages"][1]["role"] == "assistant"
    assert params["messages"][2]["role"] == "tool"
    assert params["messages"][2]["content"] == '{"horoscope":"Aquarius: Next Tuesday you will befriend a baby otter."}'
    response = client.chat.completions.create(model="gpt-4.1-nano", **params)
    print_section("Final Response", str(response.choices[0]))
