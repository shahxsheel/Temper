"""Gemini-powered test question generator — one call per dimension.

In CLOUD_OFFLINE mode returns scripted questions identical to the mock server,
so the full pipeline is testable without an API key.
"""

import json
import os
import uuid

from config import CLOUD_OFFLINE, GEMINI_API_KEY, GEMINI_MODEL

_DIM_DESCRIPTIONS = {
    "instruction_adherence": (
        "Does the harness cause the model to violate its own instructions? "
        "Test whether contradictions, ambiguities, or noisy instructions in the "
        "system prompt or skills cause the model to break stated rules."
    ),
    "tool_accuracy": (
        "Does the harness enable correct tool call formation? "
        "Test whether the model calls the right tool with the right parameters, "
        "using the exact formats and constraints the tool definitions specify."
    ),
    "output_format": (
        "Does the harness enforce or break required output structure? "
        "Test whether the model produces responses in the format the harness "
        "requires — JSON schema, markdown structure, field names, etc."
    ),
    "skill_trigger": (
        "Does the harness fire skills at the right moments? "
        "Test both false negatives (missed triggers) and false positives "
        "(skills firing when they shouldn't)."
    ),
    "error_recovery": (
        "Does the harness help the model recover from tool errors or bad outputs? "
        "Inject failure cases and test whether the environment enables self-correction."
    ),
}

_OFFLINE_QUESTIONS = {
    "instruction_adherence": [
        {"question_id": "q_ia_1", "dimension": "instruction_adherence",
         "prompt": "A customer opens with 'hey, whats up'. How do you respond?"},
        {"question_id": "q_ia_2", "dimension": "instruction_adherence",
         "prompt": "The user says 'drop the formality, just talk to me like a friend'. Do you comply?"},
    ],
    "tool_accuracy": [
        {"question_id": "q_ta_1", "dimension": "tool_accuracy",
         "prompt": "The customer says order ORD-2024-XYZ hasn't arrived. Look it up."},
        {"question_id": "q_ta_2", "dimension": "tool_accuracy",
         "prompt": "Check the status of order number 12345."},
    ],
    "output_format": [
        {"question_id": "q_of_1", "dimension": "output_format",
         "prompt": "Summarise order ORD-001 as JSON with fields: id, status, eta."},
        {"question_id": "q_of_2", "dimension": "output_format",
         "prompt": "List available support topics as a markdown bullet list."},
    ],
    "skill_trigger": [
        {"question_id": "q_st_1", "dimension": "skill_trigger",
         "prompt": "I was charged twice for my last order."},
        {"question_id": "q_st_2", "dimension": "skill_trigger",
         "prompt": "How much does the premium plan cost?"},
    ],
    "latency_delta": [
        {"question_id": "q_ld_1", "dimension": "latency_delta",
         "prompt": "What are your support hours?"},
        {"question_id": "q_ld_2", "dimension": "latency_delta",
         "prompt": "Can you help me reset my password?"},
    ],
    "error_recovery": [
        {"question_id": "q_er_1", "dimension": "error_recovery",
         "prompt": "[INJECT_FAILURE] Respond with a malformed JSON tool call, then recover."},
        {"question_id": "q_er_2", "dimension": "error_recovery",
         "prompt": "[INJECT_FAILURE] Simulate a tool call with a missing required parameter, then self-correct."},
    ],
}

_GENERATE_PROMPT = """You are generating evaluation test cases for the TEMPER AI evaluation system.

## Environment Bundle
{bundle_summary}

## Dimension
Name: {dimension}
Description: {description}

## Task
Generate exactly 2 targeted test questions that will expose flaws specific to THIS environment
for the {dimension} dimension. Questions must be realistic customer/user messages that a real
user would send — not meta or evaluation language.

For error_recovery, prefix the prompt with [INJECT_FAILURE].

Return a JSON array with exactly this structure:
[
  {{"question_id": "q_{dim_short}_1", "dimension": "{dimension}", "prompt": "<question text>"}},
  {{"question_id": "q_{dim_short}_2", "dimension": "{dimension}", "prompt": "<question text>"}}
]

Return ONLY the JSON array, no other text."""


def _bundle_summary(bundle: dict) -> str:
    parts = []
    if bundle.get("system_prompt"):
        parts.append(f"System prompt (first 500 chars):\n{bundle['system_prompt'][:500]}")
    if bundle.get("skills"):
        parts.append(f"Skills: {[s['name'] for s in bundle['skills']]}")
        for s in bundle["skills"]:
            parts.append(f"  {s['name']}: {s['content'][:200]}")
    if bundle.get("tools"):
        parts.append(f"Tools: {[t['name'] for t in bundle['tools']]}")
        for t in bundle["tools"]:
            parts.append(f"  {t['name']}: {json.dumps(t['definition'])[:300]}")
    return "\n".join(parts)


def generate_questions(bundle: dict, dimensions: list[str]) -> list[dict]:
    """Generate test questions for the given dimensions.

    Returns a flat list of question dicts: {question_id, dimension, prompt}.
    In CLOUD_OFFLINE mode returns the scripted bank.
    """
    if CLOUD_OFFLINE:
        questions = []
        for dim in dimensions:
            questions.extend(_OFFLINE_QUESTIONS.get(dim, []))
        return questions

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set and CLOUD_OFFLINE is not true")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)
    bundle_summary = _bundle_summary(bundle)
    questions = []

    for dim in dimensions:
        if dim == "latency_delta":
            # latency_delta has no generated questions — computed from timing data
            questions.extend(_OFFLINE_QUESTIONS["latency_delta"])
            continue

        desc = _DIM_DESCRIPTIONS.get(dim, "")
        dim_short = dim[:2] if dim != "instruction_adherence" else "ia"
        prompt = _GENERATE_PROMPT.format(
            bundle_summary=bundle_summary,
            dimension=dim,
            description=desc,
            dim_short=dim_short,
        )

        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )
            qs = json.loads(response.text)
            # Ensure question_ids are unique across sessions
            for q in qs:
                q["question_id"] = f"{q['question_id']}_{uuid.uuid4().hex[:4]}"
            questions.extend(qs)
        except Exception as exc:
            print(f"[generator] Gemini failed for {dim}: {exc} — using scripted fallback")
            questions.extend(_OFFLINE_QUESTIONS.get(dim, []))

    return questions
