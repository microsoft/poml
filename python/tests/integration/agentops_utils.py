"""
References:
https://docs.agentops.ai/v2/usage/public-api#get-trace-metrics
"""

import time

import requests
from common_utils import Colors, print_section, print_separator
from opentelemetry.trace.span import format_trace_id


def get_bearer_token(api_key):
    """Exchange API key for a bearer token"""
    url = "https://api.agentops.ai/public/v1/auth/access_token"
    headers = {"Content-Type": "application/json"}
    data = {"api_key": api_key}

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()["bearer"]
    else:
        raise Exception(f"Failed to get bearer token: {response.status_code} - {response.text}")


def get_trace_details(bearer_token, trace_id):
    """Get comprehensive trace information"""
    url = f"https://api.agentops.ai/public/v1/traces/{trace_id}"
    headers = {"Authorization": f"Bearer {bearer_token}"}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to get trace details: {response.status_code} - {response.text}")


def get_trace_metrics(bearer_token, trace_id):
    """Get trace metrics and statistics"""
    url = f"https://api.agentops.ai/public/v1/traces/{trace_id}/metrics"
    headers = {"Authorization": f"Bearer {bearer_token}"}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to get trace metrics: {response.status_code} - {response.text}")


def get_span_details(bearer_token, span_id):
    """Get detailed span information"""
    url = f"https://api.agentops.ai/public/v1/spans/{span_id}"
    headers = {"Authorization": f"Bearer {bearer_token}"}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to get span details: {response.status_code} - {response.text}")


def get_span_metrics(bearer_token, span_id):
    """Get span metrics"""
    url = f"https://api.agentops.ai/public/v1/spans/{span_id}/metrics"
    headers = {"Authorization": f"Bearer {bearer_token}"}

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to get span metrics: {response.status_code} - {response.text}")


def get_trace_id(trace):
    """
    Extract the trace ID from the trace object.

    Args:
        trace: The trace object containing span context

    Returns:
        The formatted trace ID as a string
    """
    if trace is not None and trace.span is not None and trace.span.context is not None:
        return format_trace_id(trace.span.context.trace_id)
    else:
        raise ValueError("Invalid trace object: missing span context")


def check_trace(trace_id, api_key, span_names, delay_seconds=10):
    """
    Check the trace details and metrics after a delay.

    Args:
        trace_id: The ID of the trace to check
        api_key: The API key for authentication
        span_names: List of span names to check
        delay_seconds: Delay before checking the trace details
    """
    print_separator("TRACE VERIFICATION STARTING", Colors.GREEN)
    print(f"{Colors.YELLOW}Waiting {delay_seconds} seconds before checking trace details...{Colors.ENDC}")
    time.sleep(delay_seconds)

    # Get bearer token
    print(f"{Colors.BLUE}Getting bearer token...{Colors.ENDC}")
    bearer_token = get_bearer_token(api_key)
    assert bearer_token is not None
    print(f"{Colors.GREEN}Bearer token obtained{Colors.ENDC}")

    # Get trace details
    print_separator("TRACE DETAILS", Colors.HEADER)
    trace_details = get_trace_details(bearer_token, trace_id)
    assert trace_details is not None
    print_section("Retrieved trace details for trace", trace_details)

    # Get trace metrics
    print_separator("TRACE METRICS", Colors.HEADER)
    trace_metrics = get_trace_metrics(bearer_token, trace_id)
    assert trace_metrics is not None
    print_section("Retrieved trace metrics", trace_metrics)

    # Get details for chat completion span
    print_separator("SPAN ANALYSIS", Colors.HEADER)
    trace_spans = trace_details.get("spans", [])
    for span_name in span_names:
        spans = [span for span in trace_spans if span.get("span_name") == span_name]
        assert len(spans) > 0, f"No spans found for {span_name}"

        print(f"{Colors.GREEN}{Colors.BOLD}Analyzing spans for: {span_name}{Colors.ENDC}")
        print_section(f"Spans for {span_name}", spans)

        for i, span in enumerate(spans, 1):
            print(f"{Colors.YELLOW}{Colors.BOLD}Span {i}/{len(spans)} - ID: {span['span_id']}{Colors.ENDC}")
            details = get_span_details(bearer_token, span["span_id"])
            assert details is not None
            print_section("Span Details", details)
            print_separator("", Colors.BLUE)

    print_separator("TRACE VERIFICATION COMPLETED", Colors.GREEN)
