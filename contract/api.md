# TEMPER API Contract

This document is the authoritative interface between the local layer (Dev 1 / Claude Code) and the cloud layer (Dev 2 / Antigravity or FastAPI). **Both devs must sign off before either side writes core logic.** Do not change field names without updating both sides and bumping this doc.

---

## Communication model

Antigravity is the **server**. Claude Code is the **client**. All traffic is outbound HTTP from local → cloud. No WebSockets, no push, no NAT issues.

```
Claude Code (local)          Antigravity (cloud)
     │                              │
     │  POST /register  ──────────► │  creates session, kicks off
     │  ◄────────────── session_id  │  test generation + baseline
     │                              │
     │  GET /next-question ────────►│
     │  ◄──── {question} or {done} │  serves queue one at a time
     │                              │
     │  (run through harness)       │
     │                              │
     │  POST /submit-answer ───────►│  stores harness answer + latency
     │  ◄────────── {received:true} │
     │                              │
     │  ... repeat until done ...   │
     │                              │
     │  GET /results ──────────────►│  may return {processing} first
     │  ◄────── report + patches    │
     │                              │
     │  POST /reeval ──────────────►│  re-judge patched dims only
     │  ◄──── reeval_session_id     │
     │                              │
     │  GET /results?session_id=... │  same endpoint, new session id
     │  ◄──── updated report        │
```

---

## Dimension enum

All dimension keys must use exactly these strings throughout both codebases:

```
instruction_adherence
tool_accuracy
output_format
skill_trigger
latency_delta
error_recovery
```

---

## Endpoints

### POST /register

Ingests the environment bundle. Returns a session id immediately (async generation + baseline starts in the background). Dev 1 → Dev 2.

**Request**
```json
{
  "bundle": {
    "system_prompt": "string | null",
    "skills": [
      { "name": "string", "content": "string" }
    ],
    "tools": [
      { "name": "string", "definition": {} }
    ]
  }
}
```

**Response 200**
```json
{ "session_id": "string" }
```

**Response 422** — schema-invalid bundle
```json
{ "error": "string" }
```

**Side effect:** server begins Gemini test-question generation and bare-DeepSeek baseline run in the background. `/next-question` will block (return `{"status":"not_ready"}`) until generation completes.

---

### GET /next-question

Pops the next unanswered question for a session. Dev 1 polls this in a loop.

**Request**
```
GET /next-question?session_id=<string>
```

**Response — question available**
```json
{
  "status": "question",
  "question_id": "string",
  "dimension": "<dimension enum>",
  "prompt": "string"
}
```

**Response — all questions answered**
```json
{ "status": "done" }
```

**Response — generation still running**
```json
{ "status": "not_ready" }
```

Client behavior: on `not_ready`, back off and retry (start at 2s, cap at 10s).

---

### POST /submit-answer

Submits the local harness answer + measured latency for a question. Dev 1 → Dev 2.

**Request**
```json
{
  "session_id": "string",
  "question_id": "string",
  "answer": "string",
  "latency_ms": 1234
}
```

`answer` must include any tool calls the model made, serialized as a string (e.g. JSON blob for tool calls).

`latency_ms` measures inference time only (wall-clock around the DeepSeek call, excluding local assembly).

**Response 200**
```json
{ "received": true }
```

**Idempotency:** re-submitting the same `question_id` updates rather than duplicates.

**Side effect:** when the last answer arrives the server advances status to `judging` (triggers Gemini evaluation).

---

### GET /results

Returns the full evaluation report once judging is complete. Dev 1 polls this after the loop ends.

**Request**
```
GET /results?session_id=<string>
```

**Response — judging still running**
```json
{ "status": "processing" }
```

**Response — ready**
```json
{
  "status": "ready",
  "report": {
    "dimensions": {
      "<dimension enum>": {
        "baseline_score": 72,
        "harness_score": 31,
        "delta": -41,
        "root_cause": "string | null",
        "fixable": true
      }
    }
  },
  "patches": [
    {
      "type": "skill | system_prompt | tool_definition",
      "filename": "string",
      "content": "string"
    }
  ]
}
```

Client behavior on `processing`: back off and retry (start at 3s, cap at 15s).

This endpoint works for both initial session ids and re-eval session ids.

---

### POST /reeval

Triggers re-evaluation of specific dimensions after patches have been applied. Dev 1 → Dev 2.

**Request**
```json
{
  "session_id": "string",
  "dimensions": ["instruction_adherence", "tool_accuracy"],
  "updated_bundle": {
    "system_prompt": "string | null",
    "skills": [ { "name": "string", "content": "string" } ],
    "tools":  [ { "name": "string", "definition": {} } ]
  }
}
```

**Response 200**
```json
{ "reeval_session_id": "string" }
```

After receiving `reeval_session_id`, Dev 1 runs the test loop again (same `/next-question` → `/submit-answer` flow) under this new session id — answering only the re-served (patched-dimension) questions — then polls `GET /results?session_id=<reeval_session_id>`.

---

## Latency Delta

`latency_delta` is **not** an LLM-judged dimension. It has no generated questions. The server computes it from `latency_ms` values submitted with answers to the other dimensions' questions, compared against `latency_baseline_ms` collected during the baseline run.

The client must submit `latency_ms` on every answer (not just latency_delta questions) so the server has a representative timing sample.

---

## Polling semantics summary

| Endpoint | Transient status | Retry start | Retry cap |
|---|---|---|---|
| GET /next-question | `not_ready` | 2s | 10s |
| GET /results | `processing` | 3s | 15s |

Use exponential backoff within these bounds. Log retries so the user sees progress.

---

## Dev 1 sign-off

- [ ] Reviewed and agreed (comment on issue #37)

## Dev 2 sign-off

- [ ] Reviewed and agreed (comment on issue #37)
