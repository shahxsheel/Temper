"""Session store and state machine for TEMPER cloud server.

State lifecycle:
  registered → generating → awaiting_answers → judging → ready
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

# ── state constants ───────────────────────────────────────────────────────────

S_REGISTERED = "registered"
S_GENERATING = "generating"
S_AWAITING = "awaiting_answers"
S_JUDGING = "judging"
S_READY = "ready"


@dataclass
class Question:
    question_id: str
    dimension: str
    prompt: str
    baseline_answer: str | None = None
    harness_answer: str | None = None
    harness_latency_ms: float | None = None


@dataclass
class Session:
    session_id: str
    kind: str                              # "initial" | "reeval"
    parent_session_id: str | None         # reeval only
    reeval_dimensions: list[str]          # reeval only
    bundle: dict
    status: str = S_REGISTERED

    questions: list[Question] = field(default_factory=list)
    q_cursor: int = 0                      # next question index to serve

    report: dict | None = None
    patches: list[dict] = field(default_factory=list)

    def next_question(self) -> Question | None:
        if self.q_cursor < len(self.questions):
            q = self.questions[self.q_cursor]
            self.q_cursor += 1
            return q
        return None

    def all_answered(self) -> bool:
        return all(q.harness_answer is not None for q in self.questions)

    def record_harness_answer(self, question_id: str, answer: str, latency_ms: float) -> bool:
        for q in self.questions:
            if q.question_id == question_id:
                q.harness_answer = answer
                q.harness_latency_ms = latency_ms
                return True
        return False


# ── in-memory store ───────────────────────────────────────────────────────────

_store: dict[str, Session] = {}
_counter: int = 0


def create_session(bundle: dict, kind: str = "initial",
                   parent_session_id: str | None = None,
                   reeval_dimensions: list[str] | None = None) -> Session:
    global _counter
    _counter += 1
    if kind == "reeval":
        sid = f"reeval_{uuid.uuid4().hex[:8]}"
    else:
        sid = f"sess_{uuid.uuid4().hex[:8]}"
    sess = Session(
        session_id=sid,
        kind=kind,
        parent_session_id=parent_session_id,
        reeval_dimensions=reeval_dimensions or [],
        bundle=bundle,
    )
    _store[sid] = sess
    return sess


def get_session(session_id: str) -> Session | None:
    return _store.get(session_id)
