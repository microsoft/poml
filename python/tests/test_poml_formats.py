import base64
from pathlib import Path

import poml
from poml.api import (
    ContentMultiMedia,
    ContentMultiMediaToolRequest,
    ContentMultiMediaToolResponse,
    PomlMessage,
    _poml_response_to_langchain,
    _poml_response_to_openai_chat,
)

PNG_DATA = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
BASE64_PREFIX = PNG_DATA[:28]


def _create_image(tmp_path: Path) -> Path:
    img_path = tmp_path / "tiny.png"
    img_path.write_bytes(base64.b64decode(PNG_DATA))
    return img_path


def test_poml_format_dict(tmp_path: Path):
    img_path = _create_image(tmp_path)
    markup = f'<p>Image <img src="{img_path}" alt="tiny" syntax="multimedia"/></p>'
    result = poml.poml(markup, format="message_dict")
    assert result[0]["speaker"] == "human"
    assert result[0]["content"][0] == "Image "
    img = result[0]["content"][1]
    assert img["type"] == "image/png"
    assert img["alt"] == "tiny"
    assert img["base64"].startswith(BASE64_PREFIX)


def test_poml_format_pydantic(tmp_path: Path):
    img_path = _create_image(tmp_path)
    markup = f'<p>Image <img src="{img_path}" alt="tiny" syntax="multimedia"/></p>'
    result = poml.poml(markup, format="pydantic")
    msg = result.messages[0]
    assert isinstance(msg, PomlMessage)
    assert msg.speaker == "human"
    assert msg.content[0] == "Image "
    image = msg.content[1]
    assert isinstance(image, ContentMultiMedia)
    assert image.type == "image/png"
    assert image.alt == "tiny"
    assert image.base64.startswith(BASE64_PREFIX)


def test_poml_format_openai_chat(tmp_path: Path):
    img_path = _create_image(tmp_path)
    markup = f'<p>Image <img src="{img_path}" alt="tiny" syntax="multimedia"/></p>'
    result = poml.poml(markup, format="openai_chat")["messages"]
    msg = result[0]
    assert msg["role"] == "user"
    assert msg["content"][0] == {"type": "text", "text": "Image "}
    image = msg["content"][1]
    assert image["type"] == "image_url"
    url = image["image_url"]["url"]
    assert url.startswith("data:image/png;base64," + BASE64_PREFIX)


def test_poml_format_langchain(tmp_path: Path):
    img_path = _create_image(tmp_path)
    markup = f'<p>Image <img src="{img_path}" alt="tiny" syntax="multimedia"/></p>'
    result = poml.poml(markup, format="langchain")["messages"]
    msg = result[0]
    assert msg["type"] == "human"
    first = msg["data"]["content"][0]
    assert first == {"type": "text", "text": "Image "}
    image = msg["data"]["content"][1]
    assert image["type"] == "image"
    assert image["source_type"] == "base64"
    assert image["mime_type"] == "image/png"
    assert image["data"].startswith(BASE64_PREFIX)


def test_tool_call_openai_conversion():
    """Test tool call conversion to OpenAI format"""
    markup = """<poml>
    <human-msg>Search for Python</human-msg>
    <tool-request id="call_123" name="search" parameters="{{ { query: 'Python' } }}" />
    <tool-response id="call_123" name="search">Python is a language.</tool-response>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")["messages"]
    expected = [
        {"role": "user", "content": "Search for Python"},
        {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {"name": "search", "arguments": '{"query": "Python"}'},
                }
            ],
        },
        {"role": "tool", "content": "Python is a language.", "tool_call_id": "call_123"},
    ]
    assert result == expected


def test_tool_call_langchain_conversion():
    """Test tool call conversion to Langchain format"""
    markup = """<poml>
    <tool-request id="call_456" name="calculate" parameters="{{ { expression: '2 + 2' } }}" />
    <tool-response id="call_456" name="calculate">4</tool-response>
    </poml>"""

    result = poml.poml(markup, format="langchain")["messages"]
    expected = [
        {
            "type": "ai",
            "data": {"tool_calls": [{"id": "call_456", "name": "calculate", "args": {"expression": "2 + 2"}}]},
        },
        {"type": "tool", "data": {"content": "4", "tool_call_id": "call_456", "name": "calculate"}},
    ]
    assert result == expected


def test_message_dict_format():
    """Test message_dict format returns just messages array"""
    markup = "<p>Hello world</p>"
    result = poml.poml(markup, format="message_dict")
    expected = [{"speaker": "human", "content": "Hello world"}]
    assert result == expected


def test_dict_format_with_schema_tools_runtime():
    """Test dict format returns full structure with schema, tools, and runtime"""
    markup = """<poml>
    <output-schema>{"type": "object", "properties": {"answer": {"type": "string"}}, "required": ["answer"]}</output-schema>
    <tool-definition name="search" description="Search for information">
        {"type": "object", "properties": {"query": {"type": "string"}}}
    </tool-definition>
    <runtime temperature="0.5" max-tokens="150" />
    <p>What is AI?</p>
    </poml>"""

    result = poml.poml(markup, format="dict")
    expected = {
        "messages": [{"speaker": "human", "content": "What is AI?"}],
        "schema": {"type": "object", "properties": {"answer": {"type": "string"}}, "required": ["answer"]},
        "tools": [
            {
                "type": "function",
                "name": "search",
                "description": "Search for information",
                "parameters": {"type": "object", "properties": {"query": {"type": "string"}}},
            }
        ],
        "runtime": {"temperature": 0.5, "maxTokens": 150},
    }
    assert result == expected


def test_openai_chat_with_schema():
    """Test OpenAI format with JSON schema response format"""
    markup = """<poml>
    <output-schema>{"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}</output-schema>
    <p>Summarize this text</p>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")
    expected = {
        "messages": [{"role": "user", "content": "Summarize this text"}],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "schema",
                "schema": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
                "strict": True,
            },
        },
    }
    assert result == expected


def test_openai_chat_with_runtime():
    """Test OpenAI format converts runtime params to snake_case"""
    markup = """<poml>
    <runtime temperature="0.3" max-tokens="100" top-p="0.9" />
    <p>Hello</p>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")
    expected = {"messages": [{"role": "user", "content": "Hello"}], "temperature": 0.3, "max_tokens": 100, "top_p": 0.9}
    assert result == expected


def test_openai_chat_with_tools():
    """Test OpenAI format with tool definitions"""
    markup = """<poml>
    <tool-definition name="get_weather" description="Get weather information">
        {
            "type": "object",
            "properties": {
                "location": {"type": "string"}
            },
            "required": ["location"]
        }
    </tool-definition>
    <p>What's the weather?</p>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")
    expected = {
        "messages": [{"role": "user", "content": "What's the weather?"}],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather information",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                        "required": ["location"],
                    },
                },
            }
        ],
    }
    assert result == expected


def test_langchain_with_schema_tools_runtime():
    """Test LangChain format preserves all metadata"""
    markup = """<poml>
    <output-schema>{"type": "object", "properties": {"result": {"type": "number"}}, "required": ["result"]}</output-schema>
    <tool-definition name="calculate" description="Calculate numbers">
        {"type": "object", "properties": {"operation": {"type": "string"}}}
    </tool-definition>
    <runtime temperature="0.7" />
    <p>Calculate something</p>
    </poml>"""

    result = poml.poml(markup, format="langchain")
    expected = {
        "messages": [{"type": "human", "data": {"content": "Calculate something"}}],
        "schema": {"type": "object", "properties": {"result": {"type": "number"}}, "required": ["result"]},
        "tools": [
            {
                "type": "function",
                "name": "calculate",
                "description": "Calculate numbers",
                "parameters": {"type": "object", "properties": {"operation": {"type": "string"}}},
            }
        ],
        "runtime": {"temperature": 0.7},
    }
    assert result == expected


def test_pydantic_format_with_full_frame():
    """Test pydantic format returns PomlFrame with all fields"""
    markup = """<poml>
    <output-schema>{"type": "object"}</output-schema>
    <tool-definition name="test" description="Test tool">
        {"type": "object", "properties": {"input": {"type": "string"}}}
    </tool-definition>
    <runtime temperature="0.5" />
    <p>Test message</p>
    </poml>"""

    from poml.api import PomlFrame, PomlMessage

    result = poml.poml(markup, format="pydantic")
    assert isinstance(result, PomlFrame)
    assert len(result.messages) == 1
    assert isinstance(result.messages[0], PomlMessage)
    assert result.messages[0].speaker == "human"
    assert result.messages[0].content == "Test message"

    # Check metadata fields
    assert result.output_schema is not None
    assert result.output_schema["type"] == "object"
    assert result.tools is not None
    assert len(result.tools) == 1
    assert result.runtime is not None
    assert result.runtime["temperature"] == 0.5


def test_mixed_tool_calls_openai():
    """Test complex tool call scenario in OpenAI format"""
    markup = """<poml>
    <human-msg>Search for Python tutorials</human-msg>
    <ai-msg>I'll search for Python tutorials for you.</ai-msg>
    <tool-request id="call_001" name="web_search" parameters='{"query": "Python tutorials beginners"}' />
    <tool-response id="call_001" name="web_search">Found 5 tutorials: 1. Python Basics, 2. Learn Python...</tool-response>
    <ai-msg>I found 5 Python tutorials for you.</ai-msg>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")["messages"]
    expected = [
        {"role": "user", "content": "Search for Python tutorials"},
        {
            "role": "assistant",
            "content": "I'll search for Python tutorials for you.",
            "tool_calls": [
                {
                    "id": "call_001",
                    "type": "function",
                    "function": {"name": "web_search", "arguments": '{"query": "Python tutorials beginners"}'},
                }
            ],
        },
        {
            "role": "tool",
            "content": "Found 5 tutorials: 1. Python Basics, 2. Learn Python...",
            "tool_call_id": "call_001",
        },
        {"role": "assistant", "content": "I found 5 Python tutorials for you."},
    ]
    assert result == expected


def test_runtime_camel_case_conversion():
    """Test various runtime parameter name conversions"""
    markup = """<poml>
    <runtime 
        maxTokens="1000"
        topP="0.95"
        frequencyPenalty="0.5"
        presencePenalty="0.3"
        stop-sequences='["END", "STOP"]'
    />
    <p>Test</p>
    </poml>"""

    result = poml.poml(markup, format="openai_chat")
    expected = {
        "messages": [{"role": "user", "content": "Test"}],
        "max_tokens": 1000,
        "top_p": 0.95,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.3,
        "stop_sequences": ["END", "STOP"],
    }
    assert result == expected
