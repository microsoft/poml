import os
from flask import json
import poml
from openai import OpenAI
from common_utils import print_section

if __name__ == "__main__":
    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    params = poml.poml("../assets/response_format.poml", format="openai_chat")
    print_section("Parameters", str(params))
    assert "response_format" in params
    response = client.chat.completions.create(model="gpt-4.1-nano", **params)
    print_section("Response Choice", str(response.choices[0]))
    result = json.loads(response.choices[0].message.content)
    print_section("Parsed Result", str(result))
    assert "name" in result
    assert "date" in result
    assert isinstance(result["participants"], list)
