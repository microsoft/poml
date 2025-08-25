# Travel Expense Agent - Part 2: Debug Workflow with VS Code Extension


The core concept is simple: POML files act as templates that get rendered with your Python data, then sent to LLMs to get structured responses back. The `to_strict_json_schema` function automatically converts your Pydantic models into JSON schemas that guide the LLM's output format.

Setting up tracing helps you debug and improve your prompts over time:

```python
poml.set_trace(trace_dir="pomlruns")
```

This creates detailed logs of every interaction, which becomes invaluable as your system grows in complexity.


## Testing and Debugging

The tracing system captures detailed information about each step, making it easy to identify where improvements are needed. You can examine the exact prompts sent to the LLM, the responses received, and timing information for performance optimization.

When working with complex workflows like this, start by testing each step individually with known inputs. Once each step works reliably, test the complete pipeline. The structured data flow makes it easy to create test fixtures and verify outputs.