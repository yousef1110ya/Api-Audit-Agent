# PIPELINE.md — the canonical seven-stage state machine

This is the exact sequence every security audit follows. The orchestrator (the main agent) drives it; the
judging work is delegated to **isolated sub-agents** (see `SUBAGENT-CHARTER.md`). Each stage names its inputs,
its gate, its retries, and the artifact it must leave behind. Nothing advances until the prior gate is met.

> Build-and-reason stages (1,2,3,5,6,7) run **always**. Only stage 4 (live execution) requires the app's
> authorization to be live (`../OPERATING-CONTRACT.md` §0). If not authorized: do stages 1–3, stop before 4, and record
> in `TODO-BACKLOG.md` that execution is pending sign-off.

```
        ┌── reject + named gaps ──┐
        ▼                         │
[1 AUTHOR] ──► [2 VALIDATE] ──► score ≥ 4.5? ──no(≤3×)──► [3 ITERATE] ──┘
   tests        (sub-agent)         │ yes                      │ still <4.5 after 3 → STOP, ask operator
                                     ▼
                              [4 EXECUTE+LOG] ──► runs/<id>/steps.jsonl (every req+resp)
                                     │
                                     ▼
                              [5 LOG-ANALYSIS] (sub-agent) ──► candidates: vuln? + evidence
                                     │
                                     ▼
                              [6 ADJUDICATION] (different sub-agent) ──► confirm / reject each
                                     │
                                     ▼
                              [7 REPORT + KB + ACTIVITY-LOG]
```

---

## Stage 1 — Author tests (main agent)
- **Input:** the app's provided scope (its `mission/`, its `knowledge-base/` API docs, the OpenAPI/collection).
- **Do:** write runnable test files (`pipeline/templates/TEST-TEMPLATE.mjs` as the skeleton), one per
  endpoint/behaviour, using `pipeline/lib/harness.mjs`. Cover the deep categories (the OPERATING-CONTRACT), not just
  an authN ping. Encode "what secure looks like" with `run.expect(...)`.
- **Artifact:** test files under the app's `testing/tests/…`; a short `test-plan.md` listing what each targets.
- **Gate:** tests exist, parse (`node --check`), and are object-safe (create-own-`redteam`-object, no bulk
  writes on ids you didn't create).

## Stage 2 — Validate security-focus (test-validator sub-agent)
- **Input (handoff only):** the test files + `SUBAGENT-CHARTER.md` + the test-validator role card +
  `rubrics/SECURITY-FOCUS-RUBRIC.md`. **Nothing else** — not the app KB, not the findings register, not the repo.
- **Do:** the sub-agent rates each module 1–5 for how much it exercises the module's *real* risk, names the
  concrete gaps, and returns JSON matching `schemas/rating.schema.json`.
- **Artifact:** `runs/<id>/stage2-rating.json` (+ the handoff folder, preserved for audit).
- **Gate:** overall score **≥ 4.5 / 5** (the 90% bar). `< 4.5` → Stage 3.

## Stage 3 — Iterate to the gate (main agent ↔ validator)
- **Do:** read the validator's named gaps, **rewrite/extend the tests** to close them, then re-run Stage 2 on a
  fresh handoff (a new, uninfluenced validator instance — no memory of the prior round).
- **Cap:** **3 rounds.** If the score is still `< 4.5` after the third, **STOP** and escalate to the operator
  with the specific unresolved gaps and why they're hard. Do not loop indefinitely.
- **Artifact:** each round's rating under `runs/<id>/stage2-rating.rN.json`; the decision in `ACTIVITY-LOG.md`.

## Stage 4 — Execute + log (main agent, harness) — AUTHORIZATION-GATED
- **Precondition:** app engagement is live (env has the authorization marker; `loadEnv` doesn't throw).
- **Do:** run the gated tests through the harness, paced like a careful human (no floods, no high-concurrency).
  Every request and response is logged in full to `runs/<id>/steps.jsonl` with intent + expected-vs-actual.
- **Artifact:** `runs/<id>/steps.jsonl` + `manifest.json`.
- **Gate:** the run completes; the log is well-formed (one JSON object per line).

## Stage 5 — Log analysis (log-analyst sub-agent)
- **Input (handoff only):** the `steps.jsonl` (+ the relevant test files for context) + charter + log-analyst
  role card + `rubrics/SECURITY-FOCUS-RUBRIC.md` for what secure looks like. **No pre-written conclusions.**
- **Do:** for each candidate behaviour, decide **vulnerability: yes / no / needs-more-data**, and cite the
  exact step numbers + request/response fields as evidence. Returns JSON per `schemas/log-finding.schema.json`.
- **Artifact:** `runs/<id>/stage5-analysis.json` with an evidence block per candidate.

## Stage 6 — Adjudication (finding-adjudicator sub-agent — a DIFFERENT agent)
- **Input (handoff only):** the stage-5 candidates it must judge **plus the raw evidence** (the cited log
  excerpts) + charter + adjudicator role card + `rubrics/FINDING-ADJUDICATION-RUBRIC.md`. It is told to assume
  stage 5 may be wrong in either direction.
- **Do:** independently decide for each "yes": is this a **real** security flaw, and is it the flaw claimed
  (not a different bug, not a test artifact, not expected behaviour)? Default to REJECT when evidence is
  insufficient. Returns JSON per `schemas/adjudication.schema.json` with a verdict + reasoning per candidate.
- **Artifact:** `runs/<id>/stage6-adjudication.json`.
- **Gate:** only candidates with verdict `CONFIRMED` become findings. `PLAUSIBLE`/`REJECTED` are recorded but
  not reported as findings (PLAUSIBLE → a `TODO-BACKLOG.md` item to gather the missing proof).

## Stage 7 — Report + record (main agent)
- **Do:** file each CONFIRMED finding with the app's reporting kit (evidence links to the exact steps/scripts),
  update the app's findings register, update the **program** `knowledge-base/` with anything cross-cutting,
  append a session entry to `logs/ACTIVITY-LOG.md`, and push any deferred work to `TODO-BACKLOG.md`.
- **Stop-and-flag:** a CONFIRMED finding means notify the operator; do not pivot or chain deeper.

---

## Invariants (true at every stage)
1. **Proof or silence.** No claim without a cited artifact. `finding-discipline` skill before CONFIRMED.
2. **Isolation.** Judging sub-agents read only their handoff folder. Build each with `lib/handoff.mjs`.
3. **Independence.** Stage 2, 5, and 6 are *fresh* agents with no memory of each other; stage 6 ≠ stage 5 agent.
4. **No-delete / object-safety.** Mutate only `redteam`-prefixed objects you created; reconcile to zero.
5. **Everything logged.** Machine logs in `runs/`; narrative in `ACTIVITY-LOG.md`.
6. **Capture the tail.** Any deferred idea/retest/assumption → `TODO-BACKLOG.md` immediately.
7. **Ask when unsure.** Scope/credential/authorization ambiguity → stop and ask, options-based.
