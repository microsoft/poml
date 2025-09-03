import json
from typing import Dict, List, Literal, Optional, Union

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field

import poml
from poml.integration.pydantic import to_strict_json_schema


def tarvel_expense_agent(document_paths: List[str], employee_email: str):
    client = OpenAI()

    extra_params = {"model": "gpt-5-nano", "reasoning_effort": "low"}

    # Setup POML tracing (optional)
    poml.set_trace(trace_dir="pomlruns")

    # Step 1: Extract structured dasta from documents
    documents = []
    for document_path in document_paths:
        context = {
            "file": document_path,
            "document_output_schema": to_strict_json_schema(Document),
        }
        print(context)
        extraction_prompt = poml.poml("203_expense_extract_document.poml", context, format="openai_chat")
        extraction_resp = client.chat.completions.create(
            **extraction_prompt,
            **extra_params,
        )
        document = Document.model_validate_json(extraction_resp.choices[0].message.content)
        documents.append(document)
        print("=== EXTRACTED DOCUMENT ===")
        print(document.model_dump_json())
        print()

    # Step 2: Identify relevant policy rules
    context = {
        "email_text": employee_email,
        "extracted_documents": [doc.model_dump() for doc in documents],
        "rules_output_schema": to_strict_json_schema(RelevantRules),
    }
    rules_prompt = poml.poml("204_expense_extract_rules.poml", context, format="openai_chat")
    rules_resp = client.chat.completions.create(
        **rules_prompt,
        **extra_params,
    )
    relevant_rules = RelevantRules.model_validate_json(rules_resp.choices[0].message.content)
    print("=== RELEVANT RULES ===")
    print(relevant_rules.model_dump_json(indent=2))
    print()

    # Step 3: Check compliance and make decision
    context = {
        "trip_context": relevant_rules.trip_context.model_dump(),
        "extracted_documents": [doc.model_dump() for doc in documents],
        "relevant_rules": relevant_rules.model_dump(),
        "compliance_output_schema": to_strict_json_schema(ComplianceCheck),
    }
    compliance_prompt = poml.poml("205_expense_check_compliance.poml", context, format="openai_chat")
    compliance_resp = client.chat.completions.create(
        **compliance_prompt,
        **extra_params,
    )
    compliance_check = ComplianceCheck.model_validate_json(compliance_resp.choices[0].message.content)
    print("=== COMPLIANCE CHECK ===")
    print(compliance_check.model_dump_json(indent=2))
    print()

    # Step 4: Generate email response
    context = {
        "trip_context": relevant_rules.trip_context.model_dump(),
        "extracted_documents": [doc.model_dump() for doc in documents],
        "relevant_rules": relevant_rules.model_dump(),
        "compliance_result": compliance_check.model_dump(),
    }
    email_prompt = poml.poml("206_expense_send_email.poml", context, format="openai_chat")
    email_resp = client.chat.completions.create(
        **email_prompt,
        **extra_params,
    )
    print("=== EMAIL RESPONSE ===")
    print(email_resp.choices[0].message.tool_calls)
    print()

    tool_call_args = json.loads(email_resp.choices[0].message.tool_calls[0].function.arguments)
    mock_send_email(**tool_call_args)


# ======== Types Used in Step 1 =========


class LineItem(BaseModel):
    date: Optional[str] = Field(..., description="YYYY-MM-DD")
    description: str
    category: str = Field(
        ...,
        description=(
            "e.g., lodging, meals, ground_transportation, rental_car, "
            "communications, visa, entertainment, supplies, incidentals"
        ),
    )
    amount: float


class TotalByCategory(BaseModel):
    category: str
    amount: float


class Document(BaseModel):
    source: str = Field(..., description="Filename or doc label")
    doc_type: Literal["hotel_invoice", "flight_itinerary", "receipt", "other"]
    merchant: Optional[str] = Field(..., description="Merchant or provider name")
    currency: Optional[str] = Field(..., description="ISO currency code, e.g., USD, EUR")
    lines: List[LineItem]
    subtotals_by_category: List[TotalByCategory] = Field(
        ...,
        description="=Sum per category within this single document. DO NOT include overall/combined totals here.",
    )


# ======== Types Used in Step 2 =========


class TripContext(BaseModel):
    is_international: Optional[bool] = Field(..., description="Indicates whether the trip is international.")
    trip_length_days: Optional[float] = Field(..., description="Number of days for the trip.")


class Rule(BaseModel):
    rule_id: int = Field(..., description="Unique identifier for the rule.")
    category: str = Field(
        ...,
        description=(
            "Type of expense the rule applies to, such as lodging, meals, " "transportation, insurance, or booking."
        ),
    )
    type: str = Field(
        ...,
        description=(
            "Defines the kind of restriction, such as daily cap, receipt " "threshold, or preapproval requirement."
        ),
    )
    scope: str = Field(
        ...,
        description="Specifies whether the rule applies domestically, internationally, or to any trip.",
    )
    reference: str = Field(..., description="Reference to policy section or appendix.")
    value: Optional[Union[str, float, bool]] = Field(
        ..., description="Limit or requirement. Can be numeric, boolean, or text."
    )
    unit: Optional[str] = Field(..., description="Measurement unit such as USD/day, hours, or enum value.")
    requires_preapproval: Optional[bool] = Field(..., description="True if the expense requires preapproval.")
    non_reimbursable: Optional[bool] = Field(..., description="True if the expense is not reimbursable.")


class RelevantRules(BaseModel):
    trip_context: TripContext = Field(..., description="Context about the trip used for applying rules.")
    rules: List[Rule] = Field(..., description="List of policy rules to apply.")


# ======== Types Used in Step 3 =========


class RuleCheck(BaseModel):
    rule_id: int
    satisfied: bool
    evidence: str = Field(
        ...,
        description="Short reference: category sums, lines, dates, class of service, receipt threshold checks, etc.",
    )
    over_by: Optional[float] = Field(..., description="Amount exceeding the cap, if any.")
    severity: Literal["low", "medium", "high"]
    suggested_fix: str


class ComplianceCheck(BaseModel):
    totals_by_category: List[TotalByCategory] = Field(
        ...,
        description="Combined totals in USD by category across all documents.",
    )
    overall_total_usd: float
    rule_checks: List[RuleCheck]
    decision: Literal["approve", "needs_fixes", "reject"]


def mock_send_email(to, subject, body):
    print("\n=== MOCK EMAIL SENT ===")
    print("To:     ", to)
    print("Subject:", subject)
    print("Body:\n", body)


if __name__ == "__main__":
    document_paths = [
        "assets/203_flight_itinerary.pdf",
        "assets/203_hotel_invoice.pdf",
        "assets/203_meal_receipt.png",
        "assets/203_taxi_receipt.png",
    ]
    employee_email = """
    Hi, I just got back from a business trip to New York. Attached are my expense reports.
    Please let me know if you need any more information to process my reimbursement.
    Thanks!
    """
    tarvel_expense_agent(document_paths, employee_email)
