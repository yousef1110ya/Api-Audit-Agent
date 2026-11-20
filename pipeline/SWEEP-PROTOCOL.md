# SWEEP-PROTOCOL.md — running the full pipeline across a whole app, with ZERO loss of rigor

A full-app sweep (every module/endpoint) uses the **exact same seven stages** as a single-module run
(`PIPELINE.md`) — applied to **every module**, with **no shortcuts for scale**. This file pins the rules that a
sweep must not break, and defines the machine-checkable bar for calling a module `done`. It governs the sweep;
where silent, `PIPELINE.md` and `../OPERATING-CONTRACT.md` govern.

## The non-negotiables (same rules, every module, every step)

1. **Identical Stage 1→7 per module.** Author tests → validate to the gate → iterate → run+log → log-analyse →
   adjudicate → record. No module is marked tested on a lesser process.

2. **Per-MODULE gate — never a batch average.** The gate is **each module individually ≥ 4.5 / 5**. When a
   Stage-2 validator rates several modules at once, a module advances **only if its own score ≥ 4.5**. A strong
   module may not lift a weak one. A module below 4.5 is re-authored and re-validated (≤ 3 rounds, then escalate
   to the operator) — exactly as for a single run.

3. **Judges stay isolated and independent.** Every Stage 2 / 5 / 6 agent reads only its handoff folder
   (`lib/handoff.mjs`), has no app KB and no prior-round memory, and **Stage 6 ≠ the Stage 5 agent**. Batching
   *which modules one agent looks at* is allowed for efficiency; **coupling a judge to another stage's
   conclusion, or to the repo, is not.**

4. **Proof or silence.** Every verdict cites a logged step/file. `finding-discipline` before any CONFIRMED.
   Default to the lower verdict when proof is thin (Stage 5 → `no`/`needs-more-data`; Stage 6 → REJECTED).

5. **Object-safety & pacing hold at scale.** Create only `redteam`-prefixed objects, mutate only what you
   created, reconcile the registry to zero per batch. **No floods / no high-concurrency live traffic** (ROE):
   live execution is paced and controlled even though authoring/judging may fan out. A big sweep is many small
   paced batches, never a blast.

6. **Batching is an invocation convenience, not a rigor discount.** You MAY give one author/validator/analyst/
   adjudicator several modules at once. You MAY NOT thereby skip any module's gate, iteration, run log, or
   adjudication. Each module carries its own full artifact set (below).

## Status ladder (ledger `status`) — maps 1:1 to the stages
`not_started → authored → gate_passed → run → analyzed → adjudicated → done`
(`partial` = stages all passed but endpoint-breadth/categories still incomplete for that module.)

## A module is `done` only when ALL of these artifacts exist (machine-checked by `lib/verify-coverage.mjs`)
- **Stage 1** — a committed test file under `testing/tests/<module>*.test.mjs`.
- **Stage 2** — a rating that includes this module with **score ≥ 4.5** (and the run's `gate_met` logic applied
  per-module). Recorded in the ledger as `gate_score`.
- **Stage 4** — at least one run id whose `steps.jsonl` exists and has ≥ 1 logged step for this module.
- **Stage 5** — a log-analysis that covers this module's candidates (its run logs were analysed).
- **Stage 6** — an adjudication verdict for **every** Stage-5 `yes` candidate belonging to this module.
- **Coverage** — every endpoint of the module in `endpoint-inventory.json` is exercised by at least the
  authn/authz baseline **or** a deep test; applicable deep categories (per `rubrics/SECURITY-FOCUS-RUBRIC.md`)
  each have a test. Endpoint-level ticks live in the ledger.

If any artifact is missing, the module is **not** `done` — the coverage-auditor flags it and it is re-run.

## What "fully covered" means (the completeness bar the auditor enforces)
1. **Every module** reaches `done` (or `partial` with an explicit, logged reason + a backlog item).
2. **Every endpoint** in `endpoint-inventory.json` is accounted for: covered by a baseline authn/authz check
   and/or a deep test; none silently skipped.
3. **Every applicable deep category** per module has a real test (not a `PENDING` stub).
4. The **coverage-auditor** independently confirms 1–3 by running `lib/verify-coverage.mjs` AND reading the
   ledger vs the inventory vs the raw logs — and names anything missing. Silent truncation is a protocol breach;
   any bounded/skipped coverage must be `log()`ged and backlogged, never hidden.

## The sweep loop (per batch)
1. Pick the next risk-ordered batch from the ledger (`module_order_by_risk`).
2. **Author** tests (sub-agent, from app docs + proven scripts) → `node --check`.
3. **Validate** (isolated Stage-2) → per-module gate → iterate the sub-4.5 modules (≤3 rounds) → escalate if stuck.
4. **Run** live, paced, object-safe → logs.
5. **Analyse** (isolated Stage-5) → **Adjudicate** (isolated Stage-6, different agent).
6. **Update the ledger** (status, gate_score, verdict, run_ids, stage refs, endpoint ticks) + commit.
7. When all batches are done → **coverage-auditor** → re-run any gaps it finds → only then declare the sweep complete.
