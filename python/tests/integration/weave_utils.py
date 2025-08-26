import time
from datetime import datetime, timezone

import weave
from common_utils import Colors, print_section, print_separator


def check_trace(must_have_ops, time_cutoff=None, delay_seconds=10, limit=10):
    """
    Check the trace details and verify required operations are present.

    Args:
        must_have_ops: List of operation names that must be present in recent traces
        time_cutoff: DateTime cutoff for filtering recent traces (timezone-aware)
        delay_seconds: Delay before checking the trace details
        limit: Maximum number of calls to retrieve
    """
    print_separator("WEAVE TRACE VERIFICATION STARTING", Colors.GREEN)
    print(f"{Colors.YELLOW}Waiting {delay_seconds} seconds before checking trace details...{Colors.ENDC}")
    time.sleep(delay_seconds)

    # Get weave client
    print_separator("WEAVE CLIENT SETUP", Colors.HEADER)
    client = weave.get_client()
    assert client is not None, "Weave client is not initialized"
    print(f"{Colors.GREEN}Weave client obtained for project: {client.project}{Colors.ENDC}")

    # Set time cutoff if not provided (default to 5 minutes ago)
    if time_cutoff is None:
        from datetime import timedelta

        time_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)

    # Ensure time_cutoff is timezone-aware
    if time_cutoff.tzinfo is None:
        time_cutoff = time_cutoff.replace(tzinfo=timezone.utc)

    print_section("Time cutoff (UTC)", time_cutoff.isoformat())

    # Get recent calls
    print_separator("RETRIEVING RECENT CALLS", Colors.HEADER)
    calls = list(client.get_calls(limit=limit, sort_by=[{"field": "started_at", "direction": "desc"}]))
    print(f"{Colors.BLUE}Retrieved {len(calls)} calls{Colors.ENDC}")

    # Filter calls by time cutoff
    recent_calls = []
    for call in calls:
        call_time = call.started_at
        # Ensure call time is timezone-aware
        if hasattr(call_time, "tzinfo") and call_time.tzinfo is None:
            call_time = call_time.replace(tzinfo=timezone.utc)

        if call_time >= time_cutoff:
            recent_calls.append(call)

    print(f"{Colors.GREEN}Found {len(recent_calls)} calls after time cutoff{Colors.ENDC}")

    if not recent_calls:
        print(f"{Colors.RED}No recent calls found after the time cutoff!{Colors.ENDC}")
        return

    # Analyze recent calls
    print_separator("CALL ANALYSIS", Colors.HEADER)
    found_operations = set()

    for i, call in enumerate(recent_calls, 1):
        op_name = call._op_name.split("/")[-1] if call._op_name else "unknown"
        found_operations.add(op_name)

        print(f"{Colors.YELLOW}{Colors.BOLD}Call {i}/{len(recent_calls)} - {op_name}{Colors.ENDC}")
        print(f"Trace ID: {call.trace_id}")
        print(f"Started: {call.started_at}")
        print(f"Status: {call.summary.get('weave', {}).get('status', 'unknown')}")
        print(f"{Colors.BLUE}{Colors.BOLD}Input:{Colors.ENDC} {call.inputs}")
        print(f"{Colors.BLUE}{Colors.BOLD}Output:{Colors.ENDC} {call.output}")
        if call.exception:
            print(f"{Colors.RED}Exception: {call.exception}{Colors.ENDC}")
        print_separator("", Colors.BLUE)

        if op_name.startswith("poml"):
            # Check for POML-specific format
            assert "prompt" in call.inputs, "POML call does not contain 'prompt' in inputs"
            assert "messages" in call.output, "POML call does not contain 'messages' in output"

    # Check for required operations
    if must_have_ops:
        print_separator("REQUIRED OPERATION VERIFICATION", Colors.HEADER)
        print_section("Found operations", list(found_operations))

        missing_ops = []
        for required_op in must_have_ops:
            # Check for partial matches (e.g., "openai.chat.completions.create" matches patterns)
            found = any(required_op in op for op in found_operations)
            if found:
                print(f"{Colors.GREEN}[OK] Found required operation: {required_op}{Colors.ENDC}")
            else:
                print(f"{Colors.RED}[ERROR] Missing required operation: {required_op}{Colors.ENDC}")
                missing_ops.append(required_op)

        if missing_ops:
            raise AssertionError(f"Missing required operations: {missing_ops}")
        else:
            print(f"{Colors.GREEN}{Colors.BOLD}[SUCCESS] All required operations found!{Colors.ENDC}")

    print_separator("WEAVE TRACE VERIFICATION COMPLETED", Colors.GREEN)


def check_prompt(prompt_name):
    """
    Check the prompt details and content.

    Args:
        prompt_name: The name of the prompt to check
    """
    print_separator("PROMPT VERIFICATION", Colors.GREEN)
    prompt = weave.get(prompt_name)

    print_section("Prompt content", prompt)
    assert prompt.startswith("<poml>"), "Prompt content does not start with '<poml>'"

    print_separator("PROMPT VERIFICATION COMPLETED", Colors.GREEN)
