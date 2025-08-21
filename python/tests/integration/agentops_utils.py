"""
References:
https://docs.agentops.ai/v2/usage/public-api#get-trace-metrics
"""

import requests
import time
from opentelemetry.trace.span import format_trace_id


def get_bearer_token(api_key):
    """Exchange API key for a bearer token"""
    url = "https://api.agentops.ai/public/v1/auth/access_token"
    headers = {"Content-Type": "application/json"}
    data = {"api_key": api_key}

    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        print(response.json())
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
    print(f"Waiting {delay_seconds} seconds before checking trace details...")
    time.sleep(delay_seconds)

    # Get bearer token
    bearer_token = get_bearer_token(api_key)
    assert bearer_token is not None

    # Get trace details
    trace_details = get_trace_details(bearer_token, trace_id)
    assert trace_details is not None
    print(f"Retrieved trace details for trace:", trace_details)

    # Get trace metrics
    trace_metrics = get_trace_metrics(bearer_token, trace_id)
    assert trace_metrics is not None
    print("Retrieved trace metrics:", trace_metrics)

    # Get details for chat completion span
    trace_spans = trace_details.get("spans", [])
    for span_name in span_names:
        spans = [span for span in trace_spans if span.get("span_name") == span_name]
        assert len(spans) > 0, f"No spans found for {span_name}"
        print(f"Spans for {span_name}:", spans)
        for span in spans:
            details = get_span_details(bearer_token, span["span_id"])
            assert details is not None
            print(f"Span ID: {span['span_id']}:", details)
