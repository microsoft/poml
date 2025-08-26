"""Minimal POML Python sanity check.

Parses a simple <p> tag and verifies the output.
"""

from poml import poml

output = poml("<p>hello world</p>")
if output != [{"speaker": "human", "content": "hello world"}]:
    raise RuntimeError(f"Unexpected output: {output}")
print(output)
