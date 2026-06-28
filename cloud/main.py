#!/usr/bin/env python3
"""TEMPER cloud server — FastAPI implementation of all 5 E0.2 endpoints.

Run:
  python main.py                        # live mode (requires GEMINI_API_KEY, DEEPSEEK_API_KEY)
  CLOUD_OFFLINE=true python main.py    # scripted offline mode (no API keys needed)
  make run-cloud                        # convenience alias

Port: CLOUD_PORT env var (default 8001).
"""

import asyncio
import json
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

# Load config first so all modules see the env
import config  # noqa: F401
from config import CLOUD_OFFLINE, PORT
from session import (
    S_AWAITING, S_GENERATING, S_JUDGING, S_READY, S_REGISTERED,
    Session, create_session, get_session,
)

app = FastAPI(title="TEMPER Cloud Server", version="0.1.0")

# ── Pydantic models ───────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    bundle: Any


class SubmitBody(BaseModel):
    session_id: str
    question_id: str
    answer: str
    latency_ms: float


class ReevalBody(BaseModel):
    session_id: str
    dimensions: list[str]
    updated_bundle: Any


# ── helpers ───────────────────────────────────────────────────────────────────

def _require_session(session_id: str) -> Session:
    sess = get_session(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail=f"Unknown session_id: {session_id}")
    return sess


ALL_DIMENSIONS = [
    "instruction_adherence", "tool_accuracy", "output_format",
    "skill_trigger", "latency_delta", "error_recovery",
]


# ── background pipeline ───────────────────────────────────────────────────────

async def _run_pipeline(sess: Session) -> None:
    """Generate questions, run baseline, then wait for harness answers to judge."""
    loop = asyncio.get_event_loop()

    # 1. Generate questions
    try:
        from generator import generate_questions
        dims = sess.reeval_dimensions if sess.kind == "reeval" else ALL_DIMENSIONS
        raw_qs = await loop.run_in_executor(None, generate_questions, sess.bundle, dims)
        from session import Question
        sess.questions = [Question(**q) for q in raw_qs]
        print(f"[pipeline] {sess.session_id}: generated {len(sess.questions)} questions")
    except Exception as exc:
        print(f"[pipeline] question generation failed: {exc}")
        sess.status = S_READY  # unblock client with empty report
        return

    # 2. Run bare DeepSeek baseline
    try:
        from baseline import run_baseline
        baseline_results = await loop.run_in_executor(None, run_baseline, raw_qs)
        for q in sess.questions:
            b = baseline_results.get(q.question_id)
            if b:
                q.baseline_answer = b["answer"]
    except Exception as exc:
        print(f"[pipeline] baseline failed: {exc}")

    # 3. Questions ready for harness answers
    sess.status = S_AWAITING
    print(f"[pipeline] {sess.session_id}: awaiting harness answers")

    # 4. Wait until all harness answers are in
    while not sess.all_answered():
        await asyncio.sleep(0.5)

    # 5. Judge
    sess.status = S_JUDGING
    print(f"[pipeline] {sess.session_id}: judging")
    try:
        from judge import judge_all
        dims = sess.reeval_dimensions if sess.kind == "reeval" else None
        is_reeval = sess.kind == "reeval"
        dims_result = await loop.run_in_executor(
            None, judge_all, sess.questions, sess.bundle, dims, is_reeval
        )
        sess.report = {"dimensions": dims_result}
    except Exception as exc:
        print(f"[pipeline] judging failed: {exc}")
        sess.report = {"dimensions": {}}

    # 6. Generate patches (initial sessions only — not reeval)
    if sess.kind == "initial":
        try:
            from patcher import generate_patches
            sess.patches = await loop.run_in_executor(
                None, generate_patches, sess.report["dimensions"], sess.bundle
            )
            print(f"[pipeline] {sess.session_id}: generated {len(sess.patches)} patches")
        except Exception as exc:
            print(f"[pipeline] patch generation failed: {exc}")

    sess.status = S_READY
    print(f"[pipeline] {sess.session_id}: ready")


# ── endpoints ─────────────────────────────────────────────────────────────────

@app.post("/register")
async def register(body: RegisterBody):
    sess = create_session(body.bundle)
    sess.status = S_GENERATING
    asyncio.create_task(_run_pipeline(sess))
    print(f"[/register] → {sess.session_id}")
    return {"session_id": sess.session_id}


@app.get("/next-question")
async def next_question(session_id: str = Query(...)):
    sess = _require_session(session_id)

    if sess.status == S_GENERATING:
        return {"status": "not_ready"}

    q = sess.next_question()
    if q is None:
        return {"status": "done"}

    print(f"[/next-question] {sess.session_id} → {q.question_id} ({q.dimension})")
    return {
        "status": "question",
        "question_id": q.question_id,
        "dimension": q.dimension,
        "prompt": q.prompt,
    }


@app.post("/submit-answer")
async def submit_answer(body: SubmitBody):
    sess = _require_session(body.session_id)
    found = sess.record_harness_answer(body.question_id, body.answer, body.latency_ms)
    if not found:
        raise HTTPException(status_code=404, detail=f"Unknown question_id: {body.question_id}")
    print(f"[/submit-answer] {body.session_id}/{body.question_id} latency={body.latency_ms}ms")
    return {"received": True}


@app.get("/results")
async def results(session_id: str = Query(...)):
    sess = _require_session(session_id)

    if sess.status != S_READY:
        return {"status": "processing"}

    print(f"[/results] {session_id} → ready")
    return {
        "status": "ready",
        "report": sess.report,
        "patches": sess.patches,
    }


@app.post("/reeval")
async def reeval(body: ReevalBody):
    _require_session(body.session_id)  # validate parent exists
    sess = create_session(
        bundle=body.updated_bundle,
        kind="reeval",
        parent_session_id=body.session_id,
        reeval_dimensions=body.dimensions,
    )
    sess.status = S_GENERATING
    asyncio.create_task(_run_pipeline(sess))
    print(f"[/reeval] dims={body.dimensions} → {sess.session_id}")
    return {"reeval_session_id": sess.session_id}


# ── entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mode = "OFFLINE" if CLOUD_OFFLINE else "LIVE"
    print(f"[temper-cloud] Starting in {mode} mode on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=False)
