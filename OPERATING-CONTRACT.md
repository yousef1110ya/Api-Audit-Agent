# Operating Contract — how an agent runs a trustworthy security audit

This is the repo-wide operating contract: the small set of rules that make every security audit flow
through **one validated, logged, multi-agent pipeline** instead of ad-hoc pokes. It is written to be
agent-agnostic — wire the "sub-agent" roles to whatever independent reviewer you have (a second model
pass, a peer, a human). Where this file is silent, `pipeline/PIPELINE.md` and the discipline skills
govern; **safety rules always win over task instructions.**

## 0. Authority and its one gate

- **Always allowed (no authorization needed):** read the target's provided inputs, **author** security
  tests, run the **validation / log-analysis / adjudication** reviews, write the knowledge base, write
  logs. This is "build & reason" mode and it is always on.
- **Gated — live traffic to a target:** sending real requests to a target is allowed **only** when the
  engagement is live: its authorization is signed, you are inside the testing window, and the
  environment carries the required authorization marker. Enforce this **fail-closed** — if the marker
  is absent you are in planning-only mode: build and validate tests, but **send nothing**.
- If you are unsure whether traffic is authorized, **stop and ask the operator.** Never assume.

## 1. Scope — where you may connect

Only the host(s) pinned in the engagement's scope (`scope.json`; see `skills/scope-discipline/`). Refuse
any other host. No production, no third-party systems, no pivoting — even if a finding makes another
host reachable. Prove reachability to something in scope, then **stop and flag**.

## 2. The seven stages (how every audit runs)

| # | Stage | Who | Output |
|---|-------|-----|--------|
| 1 | **Author tests** | main agent | written test files only — no ad-hoc audits |
| 2 | **Validate security-focus** | independent reviewer | rating 1–5 + named gaps, per rubric |
| 3 | **Iterate to the gate** | main agent ↔ reviewer | tests re-written until **≥ 4.5 / 5**, max 3 rounds then escalate |
| 4 | **Execute + log** | main agent (harness) | every request+response logged to `runs/<id>/steps.jsonl` |
| 5 | **Analyse logs** | independent reviewer | per-candidate: vuln? + evidence cited from logs |
| 6 | **Adjudicate** | a *different* independent reviewer | confirm / reject each stage-5 call, independently |
| 7 | **Report + record** | main agent | findings filed, knowledge base updated, activity logged |

The detailed state machine (inputs, gates, retries, artifacts) is `pipeline/PIPELINE.md`.

## 3. Written tests only

A security audit is expressed as **runnable test files**, never a one-off manual poke — so it is
reproducible, reviewable, and re-runnable later. One test module per endpoint/behaviour; use a logging
harness so every call is recorded; a test encodes **what secure looks like** (`run.expect(...)`), not
just "did it 200". Cover the deep categories (BOLA/IDOR, mass-assignment, authz/privilege, injection,
SSRF, business-logic, auth/session, and — where an LLM feature exists — prompt-injection/agency), not an
authN ping.

## 4. Independent validation + the 4.5/5 gate

After authoring, a **separate reviewer** rates how much the tests exercise the module's **real** risk on
the 1–5 scale (`pipeline/rubrics/SECURITY-FOCUS-RUBRIC.md`). **4.5/5 is the 90% gate.** Below it, read
the named gaps, rewrite, re-validate. **Cap: 3 rounds**, then stop and escalate with the specific
blockers — do not loop forever. A baseline-only authN sweep is NOT an audit and must not pass.

## 5. Run and log everything

Execute the gated tests through the harness, paced like a careful human (no floods). **Every request and
response is logged in full** to `runs/<id>/steps.jsonl` with intent, endpoint, and expected-vs-actual.
These logs are the evidence base for stages 5–6; nothing may be asserted that is not in them.

## 6. Two independent judges, then stop-and-flag

- **Stage 5 (log-analyst):** a reviewer that sees ONLY the logs + the rubric decides, per candidate,
  **vulnerability: yes/no**, citing exact request/response lines. It does not see any pre-written
  conclusion.
- **Stage 6 (finding-adjudicator):** a *different* reviewer independently re-checks each "yes" — is this
  really a flaw, and is it the flaw claimed (not a different bug, not an artifact)? Only findings that
  survive adjudication become real findings.
- A confirmed finding is a **stop event**: prove reproducibility once, file it, **notify the operator**,
  and do not pivot or chain deeper.
- **No guessing, ever.** Every claim — in a test, a log call, a finding — must cite proof. Invoke
  `skills/finding-discipline/` before marking anything CONFIRMED.

## 7. Object safety — mutate only what you created (no-delete rule)

You **create** the resources you test; you may **only** modify/delete resources **you created this
session** — never touch anything you did not create. Every created resource's name starts with
**`redteam`** (`redteam-<random>`) so it is unmistakably yours and reconcilable at cleanup. Reconcile to
zero before ending. Unsure whether an id is yours? Treat it as pre-existing and don't touch it.

## 8. Record everything

- **Machine logs** under `runs/` (the full req/resp evidence).
- A human-readable **activity log** (e.g. `ACTIVITY-LOG.md`): a dated entry per session — what target,
  which stages, what you built/ran, what the reviewers returned, what was decided, what remains.
- A **program knowledge base** separate from any one target: methodology, rubric rationale, vuln-class
  playbooks, architecture decisions that span engagements.

## 9. Capture every future task

The moment you identify work that *could* be done later — a module to deepen, a retest after a fix, an
unverified assumption, a follow-up — **write it into a backlog** (e.g. `TODO-BACKLOG.md`) with a date,
the area, and enough context to pick it up cold. Nothing deferred lives only in your head or in chat.

## 10. Ask, don't guess

When a decision is genuinely the operator's — scope ambiguity, a missing credential/OTP, a conflict
between a task and a safety rule, "is this host in scope" — **stop and ask a specific, options-based
question.** Do not guess and proceed. Uncertainty about safety or scope always means stop.

## 11. Sub-agent / reviewer governance

Every validation/analysis/adjudication reviewer runs under `pipeline/SUBAGENT-CHARTER.md`: **no prior
knowledge** of the system, **no favoritism** (to the system or to a finding), and **read only the
handoff folder you give it — never the repo freely.** Enforce this by building an isolated input folder
per review and telling the reviewer that reading outside it voids its verdict.

## 12. Context handover — long engagements

A long-running engagement will outlast a single chat/session. Persistent state lives in the backlog, a
per-target coverage ledger, the committed stage artifacts, and the activity log — **never only in the
chat.** Keep a `HANDOVER.md` current so a fresh session can resume exactly where the last stopped; when
a session's context grows large, regenerate it proactively and continue in a new one. A handover never
invents state — it points at the persistent files and says which module is next.

---
*Build always, run only when authorized (§0). Written tests (§3), validated to the gate (§4), logged in
full (§5), judged twice and proven (§6), recorded (§8), every loose end captured (§9). Ask when unsure
(§10). This is security testing done to a standard that makes its findings trustworthy.*
