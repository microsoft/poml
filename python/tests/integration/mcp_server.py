import random
import re
from typing import Any, Dict

from fastmcp import FastMCP

app = FastMCP(
    name="dmcp",
    version="0.1.0",
)

# The JSON Schema you provided (unchanged), attached to the tool
ROLL_SCHEMA: Dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {"diceRollExpression": {"type": "string"}},
    "required": ["diceRollExpression"],
    "additionalProperties": False,
}


def _roll_once(count: int, sides: int) -> int:
    return sum(random.randint(1, sides) for _ in range(count))


def _eval_dice(expr: str) -> int:
    """
    Very small parser for expressions like: 2d6 + 1d4 - 3 + d8
    - Supports + and - between terms
    - A term can be NdM (dice) or integer
    - N defaults to 1 if omitted (e.g., 'd6' == '1d6')
    """
    # Normalize spaces
    s = expr.replace(" ", "")
    # Tokenize by +/-, preserving the sign on each term
    # Example: "2d4+1-3+d6" -> ['+2d4', '+1', '-3', '+d6']
    parts = re.findall(r"[+-]?[^+-]+", s)
    total = 0
    for part in parts:
        if not part:
            continue
        sign = 1
        if part[0] == "+":
            part = part[1:]
        elif part[0] == "-":
            sign = -1
            part = part[1:]

        if "d" in part or "D" in part:
            n_str, m_str = re.split(r"[dD]", part, maxsplit=1)
            n = int(n_str) if n_str else 1
            m = int(m_str)
            total += sign * _roll_once(n, m)
        else:
            total += sign * int(part)
    return total


@app.tool(
    name="roll",
    description=(
        "Given a string of text describing a dice roll in Dungeons and Dragons, "
        "provide a result of the roll.\n\n"
        "Example input: 2d6 + 1d4\n"
        "Example output: 14"
    ),
)
def roll(diceRollExpression: str) -> str:
    """
    Returns the total as text (MCP 'text' content), e.g., "14".
    """
    total = _eval_dice(diceRollExpression)
    return str(total)


if __name__ == "__main__":
    app.run(transport="sse", host="127.0.0.1", port=8090)
