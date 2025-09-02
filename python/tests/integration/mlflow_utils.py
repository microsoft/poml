import time

import mlflow
import mlflow.genai
from common_utils import Colors, print_section, print_separator


def check_trace(trace_id, must_have, delay_seconds=5):
    """
    Check the trace details and metrics after a delay.

    Args:
        trace_id: The ID of the trace to check
        must_have: List of span names that must be present in the trace
        delay_seconds: Delay before checking the trace details
    """
    print_separator("TRACE VERIFICATION STARTING", Colors.GREEN)
    print(f"{Colors.YELLOW}Waiting {delay_seconds} seconds before checking trace details...{Colors.ENDC}")
    time.sleep(delay_seconds)

    # Get trace details
    print_separator("TRACE DETAILS", Colors.HEADER)
    assert trace_id is not None, "No trace ID found after invocation"
    full_trace = mlflow.get_trace(trace_id)
    assert full_trace is not None, "No trace details found for the given trace ID"

    print_section("Retrieved trace info", full_trace.info)

    print_separator("SPAN ANALYSIS", Colors.HEADER)
    for i, span in enumerate(full_trace.data.spans, 1):
        print(
            f"{Colors.YELLOW}{Colors.BOLD}Span {i}/{len(full_trace.data.spans)} - {span.name} ({span.span_id}){Colors.ENDC}"
        )
        print_section("Span Details", span.to_dict())
        print_separator("", Colors.BLUE)

    # Check for required spans after analyzing all spans
    if must_have:
        print_separator("REQUIRED SPAN VERIFICATION", Colors.HEADER)
        span_names = [span.name for span in full_trace.data.spans]
        print_section("Found span names", span_names)

        missing_spans = []
        for required_span in must_have:
            if required_span in span_names:
                print(f"{Colors.GREEN}[OK] Found required span: {required_span}{Colors.ENDC}")
            else:
                print(f"{Colors.RED}[ERROR] Missing required span: {required_span}{Colors.ENDC}")
                missing_spans.append(required_span)

        if missing_spans:
            raise AssertionError(f"Missing required spans: {missing_spans}")
        else:
            print(f"{Colors.GREEN}{Colors.BOLD}[SUCCESS] All required spans found!{Colors.ENDC}")

    print_separator("TRACE VERIFICATION COMPLETED", Colors.GREEN)


def check_prompt(prompt_name):
    """
    Check the prompt details and content.

    Args:
        prompt_name: The name of the prompt to check
    """
    print_separator("PROMPT VERIFICATION", Colors.GREEN)
    # It's always version 1 on CI, but it's not always on local
    # But it's a little difficult to get the correct version
    prompt = mlflow.genai.load_prompt(prompt_name, version=1)
    print_section("Retrieved prompt info", prompt)

    print_section("Prompt content", prompt.template)
    assert prompt.template.startswith("<poml>"), "Prompt content does not start with '<poml>'"

    print_separator("PROMPT VERIFICATION COMPLETED", Colors.GREEN)
