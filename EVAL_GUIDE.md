# EVAL_GUIDE — TEMPER Orchestration Spec

This file is read by Claude Code at the start of every TEMPER session. It defines the two
user-facing commands (`@eval` and `@patch`) and the full control flow each one drives.

---

## Overview

TEMPER evaluates the **harness** wrapped around a model — the system prompt, skills, and tool
definitions — not the model itself. The test-taker is **DeepSeek** (via API). Claude Code is the
orchestration client; it never answers questions itself.

The cloud server (Antigravity) generates test questions with Gemini, runs a bare-DeepSeek baseline,
and judges answers. The local layer (this repo) collects the bundle, drives the test loop, writes
patch artifacts, and renders the report.

**Offline mode:** set `TEMPER_OFFLINE=true` in `.env` and run `make run-mock` to use the mock
server at `http://localhost:8000`. All five endpoints are scripted end-to-end.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | yes (live) | Key for DeepSeek inference calls |
| `ANTIGRAVITY_BASE_URL` | yes (live) | Base URL of the cloud server |
| `DEEPSEEK_MODEL` | no | Default: `deepseek-chat` |
| `GEMINI_API_KEY` | cloud only | Used by Dev 2, not Dev 1 |
| `TEMPER_OFFLINE` | no | Set `true` to route to mock server at localhost:8001 |

Copy `.env.example` to `.env` and fill in values before running any command.

---

## @eval

### What it does

Collects the current environment bundle, registers it with the server, drives the full
question–answer test loop using DeepSeek, and polls for the final report. Renders the report
to the terminal on completion.

### Invocation

```
@eval [path/to/env/dir]
```

If no path is given, defaults to `fixtures/villain_env/`.

### Step-by-step control flow

```
1. COLLECT BUNDLE
   Read system_prompt.md, skills/*.md, tools/*.json from the env directory.
   Assemble into the bundle schema (schemas/environment_bundle.schema.json).
   Validate with jsonschema before proceeding — abort on schema error.

2. REGISTER
   POST /register  body: {bundle}
   Store session_id. Print: "Session: <session_id>"

3. TEST LOOP  (repeat until status == "done")
   a. GET /next-question?session_id=<session_id>
      - status "not_ready"  → back off (start 2s, cap 10s, exponential). Log each retry.
      - status "done"       → exit loop
      - status "question"   → proceed to (b)

   b. Call DeepSeek with the full bundle prepended to the question prompt.
      Measure wall-clock latency_ms (inference only — exclude local assembly).
      Collect the full response including any tool calls (serialize tool calls as JSON string).

   c. POST /submit-answer  body: {session_id, question_id, answer, latency_ms}
      Log: "Answered Q<n> [<dimension>] in <latency_ms>ms"

4. POLL FOR RESULTS  (repeat until status == "ready")
   GET /results?session_id=<session_id>
   - status "processing" → back off (start 3s, cap 15s, exponential). Log each poll.
   - status "ready"      → proceed

5. RENDER REPORT
   Print the eval report to terminal (see Report Rendering below).
   Save raw JSON to local/last_report.json and local/last_session_id.txt.

6. SAVE PATCHES
   For each patch in results.patches:
     Write to local/patches/<filename> (skill → .md, system_prompt → .md, tool_definition → .json).
   Print: "Wrote <n> patches to local/patches/"
```

### Notes

- `latency_delta` is computed server-side from the `latency_ms` values submitted on every answer.
  Always include `latency_ms`; never skip it.
- Re-submitting the same `question_id` updates rather than duplicates (idempotent).
- On any HTTP error: print the status code + body, retry up to 3 times with 2s delay, then abort.

---

## @patch

### What it does

Applies the server-generated patches to the environment, calls `/reeval` for the patched
dimensions, runs the test loop again under the new session id, and renders a diff report
showing pre/post scores.

### Invocation

```
@patch [path/to/env/dir]
```

If no path is given, defaults to `fixtures/villain_env/`.

Requires a prior `@eval` run (reads `local/last_session_id.txt` and `local/patches/`).

### Step-by-step control flow

```
1. LOAD PRIOR STATE
   Read local/last_session_id.txt → session_id.
   Read local/last_report.json → report.
   Read local/patches/ → list of patch files.

2. DETERMINE PATCHED DIMENSIONS
   Inspect report.dimensions for entries where fixable == true and delta < 0.
   Collect their dimension keys → patched_dims.
   Skip dimensions where fixable == false (STRUCTURAL_LIMITATION) — log a note.

3. APPLY PATCHES
   For each patch in local/patches/:
     Overwrite the corresponding file in the env directory.
     (skill patches → skills/<filename>, system_prompt → system_prompt.md,
      tool_definition patches → tools/<filename>)
   Print: "Applied <n> patches to <env_dir>"

4. COLLECT UPDATED BUNDLE
   Re-read the env directory (same as @eval step 1) to pick up patched files.
   Validate against bundle schema.

5. REEVAL
   POST /reeval  body: {session_id, dimensions: patched_dims, updated_bundle}
   Store reeval_session_id. Print: "Re-eval session: <reeval_session_id>"

6. TEST LOOP (same as @eval step 3, using reeval_session_id)
   Server serves only questions for patched dimensions — same poll/answer/submit flow.

7. POLL FOR RESULTS (same as @eval step 4, using reeval_session_id)
   GET /results?session_id=<reeval_session_id>

8. RENDER DIFF REPORT
   Print the before/after report (see Report Rendering below).
   Save updated report to local/last_reeval_report.json.
```

---

## Report Rendering

Both `@eval` (full report) and `@patch` (diff report) use the same renderer
(`local/renderer.py`). The renderer reads a report JSON and prints to stdout.

### Full report format (after @eval)

```
╔══════════════════════════════════════╗
║  TEMPER — Eval Report                ║
║  Session: <session_id>               ║
╚══════════════════════════════════════╝

Dimension           Baseline  Harness   Δ      Status
──────────────────────────────────────────────────────────
instruction_adherence   71       44    −27    NEEDS_PATCH
tool_accuracy           72       31    −41    NEEDS_PATCH
output_format           88       85     −3    PASSING
skill_trigger           60       52     −8    NEEDS_PATCH
latency_delta           90       74    −16    NEEDS_PATCH
error_recovery          38       35     −3    STRUCTURAL_LIMITATION

Root causes:
  instruction_adherence: <root_cause string>
  tool_accuracy:         <root_cause string>
  ...

Patches written to local/patches/ (<n> files)
Run @patch to apply fixes and re-evaluate.
```

### Diff report format (after @patch)

```
╔══════════════════════════════════════╗
║  TEMPER — Re-eval Report             ║
║  Session: <reeval_session_id>        ║
╚══════════════════════════════════════╝

Dimension           Before  After   Move    Status
──────────────────────────────────────────────────
tool_accuracy          31     79    +48    RESOLVED
instruction_adherence  44     82    +38    RESOLVED
error_recovery         35     37     +2    STRUCTURAL_LIMITATION

Unchanged dimensions (not re-evaluated):
  output_format: 85  (PASSING)
  skill_trigger: 52  (NEEDS_PATCH)
  latency_delta: 74  (NEEDS_PATCH)
```

Use `rich` for color: green for RESOLVED/PASSING, red for NEEDS_PATCH, yellow for
STRUCTURAL_LIMITATION. Deltas: green if positive, red if negative, grey if within ±5.

---

## File Layout (local layer)

```
local/
  eval.py          ← @eval entry point (bundle collect + test loop + results poll)
  patch.py         ← @patch entry point (apply patches + reeval loop)
  bundle.py        ← bundle collector (reads env dir, validates schema)
  harness.py       ← DeepSeek inference call (measures latency_ms)
  renderer.py      ← report + diff renderer (rich output)
  client.py        ← HTTP client wrapping all 5 endpoints (retry logic here)
  mock_server.py   ← offline mock (already complete)
  requirements.txt ← already installed in .venv
last_report.json       ← written by @eval
last_reeval_report.json← written by @patch
last_session_id.txt    ← written by @eval
patches/               ← written by @eval, read by @patch
  *.md / *.json
```

---

## API Quick Reference

All five endpoints are documented in `contract/api.md`. Key facts:

| Endpoint | Method | Transient status | Retry start | Retry cap |
|---|---|---|---|---|
| /register | POST | — | — | — |
| /next-question | GET | `not_ready` | 2s | 10s |
| /submit-answer | POST | — | — | — |
| /results | GET | `processing` | 3s | 15s |
| /reeval | POST | — | — | — |

The mock server (port 8000) serves 12 questions then `done`, returns `processing` × 2 then
the sample report + 3 patches. Re-eval serves 4 questions and shows tool_accuracy and
instruction_adherence RESOLVED.

---

## Dimension Reference

```
instruction_adherence   Does the harness cause the model to violate its own instructions?
tool_accuracy           Does the harness enable correct tool call formation?
output_format           Does the harness enforce or break required output structure?
skill_trigger           Does the harness fire skills at the right moments?
latency_delta           Does the harness add token overhead that slows inference?
error_recovery          Does the harness help the model recover from tool errors?
```

`latency_delta` has no generated questions — computed from `latency_ms` on every submission.

---

## Demo Flow (happy path)

```bash
# Terminal 1: start the mock server
make run-mock

# Terminal 2: run the eval
@eval fixtures/villain_env/

# Review the report — tool_accuracy and instruction_adherence will show large negative deltas
# Patches are written to local/patches/

# Apply patches and re-evaluate
@patch fixtures/villain_env/

# Diff report shows tool_accuracy 31→79 (RESOLVED), instruction_adherence 44→82 (RESOLVED)
# error_recovery stays flat — STRUCTURAL_LIMITATION (expected, honest failure)
```

---

## Implementation Notes for E1.x

- **E1.2 (bundle.py):** Read env dir recursively. `skills/` → array of `{name, content}`.
  `tools/` → array of `{name, definition}` (definition is the parsed JSON object).
  `system_prompt.md` → string (null if absent). Validate result with jsonschema.

- **E1.3 (harness.py):** Build messages: `[{role: "system", content: bundle_as_context},
  {role: "user", content: question_prompt}]`. The bundle context is a formatted string
  combining system prompt, skill contents, and tool definitions. Time the API call only.
  Return `{answer: str, latency_ms: int}`.

- **E1.4 (eval.py test loop):** Implement the poll-answer-submit loop exactly as specified
  above. Use exponential backoff from `client.py`. Log every retry and every answered question
  so the user sees live progress.

- **E1.5 (renderer.py):** `render_full(report, session_id, n_patches)` and
  `render_diff(orig_report, reeval_report, reeval_session_id)`. Import `rich.table` and
  `rich.console`. Keep it importable without a live server.

- **E1.6 (patch.py):** Determine patched dims by reading `report["dimensions"]` for entries
  with `fixable == true`. Write patch files into the env dir and call `/reeval`.

- **E1.7 (re-eval loop):** Reuse the test loop from eval.py with the `reeval_session_id`.
  Factor the loop into a shared function in `eval.py` or a separate `loop.py`.

- **E1.8 (pre-cache):** Serialize the sample report and sample reeval (mock server responses)
  to `local/demo_cache/`. The renderer must accept these as input so the demo never depends
  on a live server.
