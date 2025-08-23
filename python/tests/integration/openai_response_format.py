import os
from flask import json
import poml
from openai import OpenAI

if __name__ == "__main__":
    client = OpenAI(
        base_url=os.environ["OPENAI_API_BASE"],
        api_key=os.environ["OPENAI_API_KEY"],
    )

    params = poml.poml("../assets/response_format.poml", format="openai_chat")
    print(params)
    assert "response_format" in params
    response = client.chat.completions.create(model="gpt-4.1-nano", **params)
    print(response.choices[0])
    result = json.loads(response.choices[0].message.content)
    print(result)
    assert "name" in result
    assert "date" in result
    assert isinstance(result["participants"], list)
