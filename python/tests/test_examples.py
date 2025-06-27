import re
import poml
import json
import pytest
from pathlib import Path
from typing import Any, TypedDict

example_directory = Path(__file__).parent.parent.parent / "examples"


class Message(TypedDict):
    speaker: str
    contents: list[str]


def parse_expects(expect_file: Path) -> list[Message]:
    content = expect_file.read_text().replace("\r\n", "\n")

    # Split by speaker headers (===== speaker =====)
    sections = re.split(r"===== (\w+) =====\n\n", content)

    messages = []

    # Process sections in pairs (speaker, content)
    for i in range(1, len(sections), 2):
        if i + 1 < len(sections):
            speaker = sections[i]
            raw_content = sections[i + 1].strip("\n")

            # Parse content for mixed text and images
            contents = []

            # Find all JSON image objects first
            image_pattern = r'\{"type":"[^"]+","base64":"[^\n"]+?(\n|$)'

            # Split content while keeping track of positions
            last_end = 0
            for match in re.finditer(image_pattern, raw_content):
                # Add text before this image (if any)
                text_before = raw_content[last_end : match.start()].strip("\n")
                if text_before:
                    contents.append(text_before)

                # Add image (first 50 chars of base64)
                try:
                    img_data = json.loads(match.group())
                    base64_content = img_data.get("base64", "")
                    prefix = base64_content[:50]
                    contents.append(prefix)
                except json.JSONDecodeError:
                    # Fallback: extract base64 with regex
                    base64_match = re.search(r'"base64":"([^"\.]+)', match.group())
                    if base64_match:
                        prefix = base64_match.group(1)[:50]
                        contents.append(prefix)

                last_end = match.end()

            # Add any remaining text after the last image
            remaining_text = raw_content[last_end:].strip("\n")
            if remaining_text:
                contents.append(remaining_text)

            messages.append({"speaker": speaker, "contents": contents})

    return messages


def _diff(expected: list[Message], actual: Any) -> str:
    if not isinstance(actual, list):
        return f"Expected a list of messages, got {type(actual).__name__}"
    if len(expected) != len(actual):
        return f"Expected {len(expected)} messages, got {len(actual)}"

    for i, (exp, act) in enumerate(zip(expected, actual)):
        if not isinstance(act, dict):
            return f"Message {i} is not a dict: {type(act).__name__}"
        if exp["speaker"] != act.get("speaker"):
            return f"Message {i} speaker mismatch: expected '{exp['speaker']}', got '{act.get('speaker')}'"
        if "content" not in act:
            return f"Message {i} missing 'content' key"
        if isinstance(act["content"], str):
            if len(exp["contents"]) != 1 or exp["contents"][0] != act["content"].strip("\n"):
                return f"Message {i} contents mismatch: expected {exp['contents']}, got {repr(act['content'])}"
            continue
        if not isinstance(act["content"], list):
            return f"Message {i} contents is not a list: {type(act['content']).__name__}"
        if len(exp["contents"]) != len(act.get("content", [])):
            return f"Message {i} content length mismatch: expected {len(exp['contents'])}, got {len(act.get('content', []))}"
        for j, (exp_content, act_content) in enumerate(zip(exp["contents"], act.get("content", []))):
            if isinstance(act_content, str) and exp_content == act_content.strip("\n"):
                continue
            if isinstance(act_content, dict):
                if "base64" in act_content and act_content["base64"].startswith(exp_content):
                    continue
            return f"Message {i} content {j} mismatch: expected '{exp_content}', got '{act_content}'"
    return ""


def list_example_files():
    """
    Test that all example files can be processed without errors.
    """
    return list(sorted(example_directory.glob("*.poml")))


@pytest.mark.parametrize("example_file", list_example_files())
def test_example_file(example_file):
    """
    Test that a specific example file can be processed without errors.
    """
    result = poml.poml(example_file)
    expect_file = example_directory / "expects" / (example_file.stem + ".txt")
    if not expect_file.exists():
        raise FileNotFoundError(f"Expected output file not found: {expect_file}")

    # Parse the expected output
    expected_messages = parse_expects(expect_file)
    diff = _diff(expected_messages, result)
    if diff:
        raise AssertionError(f"Example {example_file.name} failed:\n{diff}")
