# Security Testing Method — an agent-agnostic operating system for trustworthy security work

This folder turns *"an AI agent that looks for security bugs"* into *"an AI agent whose security
findings you can actually trust."* It is a complete, portable **method** — the disciplines, the rating
system, the validation pipeline, and the attack/audit playbooks — distilled from real engagements and
stripped of everything specific to any one client or any one agent framework.

It is **not** a knowledge base about a particular application. It is the *way of working*: how to find a
vulnerability, prove it, rate it, revise that rating when the proof doesn't hold up, and report it to a
standard that survives scrutiny. Any agent (or human) can load it and operate the same way.

> **New here? Read this file top to bottom, then run the onboarding (`ONBOARDING.md`) to set up your
> machine, then load `INDEX.md` and start working.** The whole kit is ~75 files; you do not need to read
> them all — you load the one skill that matches the task you're about to do.

---

## 1. The problem this solves

Point a capable model at a target and say "find vulnerabilities," and you get output that *looks* like a
pentest report but can't be trusted, because an unsupervised agent fails in four specific ways:

- **It over-calls.** A reflected string becomes "XSS." A `200 OK` becomes "broken access control." A DNS
  callback becomes "SSRF." Plausible-sounding, unproven, and wrong often enough to poison the whole
  report.
- **It under-calls.** It checks that login works, calls the surface "tested," and never touches the IDOR,
  the mass-assignment, or the business-logic flaw where the real risk lives.
- **It confirms the right bug for the wrong reason.** The exploit works — via a *different* flaw than the
  one it claims. The finding is "confirmed" and the remediation fixes nothing.
- **It wanders out of scope.** A finding makes another host reachable, so it reaches — and now you have an
  unauthorized-access incident instead of a report.

This kit is an answer to all four. It makes the agent behave like a disciplined tester: **write the test,
get it independently judged, run it under full logging, prove impact, have a second independent judge
confirm it's the bug claimed, and only then call it a finding — inside a hard authorization boundary.**

---

## 2. The one idea everything hangs on

> **No `[CONFIRMED]` without proof — and no rating that can't be revised when the proof doesn't hold up.**

This is test-driven development, pointed at offense. In TDD, code doesn't exist until a test proves it
works. Here, a **finding doesn't exist until an evidence artifact proves its impact.** A hunch, a status
code, a reflected payload — none of those are findings. They are *leads*. A lead becomes a finding only
when it clears a specific, per-class proof bar and survives an independent check.

And crucially: **a rating is a claim at a point in time, not a verdict carved in stone.** When a re-test
after a fix can't reproduce the impact, or a second judge finds a benign explanation, the rating comes
*down* — on the record, with the reason. Killing a false positive is a **success**, not a failure. A
short list of five proven findings beats a long list of fifty maybes.

---

## 3. What an agent actually *does* with this — an audit, end to end

When an agent runs an engagement with this kit, here is the actual loop it executes. Each stage has a
gate; nothing advances until the gate is met. (Full state machine: `pipeline/PIPELINE.md`. Operating
rules: `OPERATING-CONTRACT.md`.)

```
   AUTHORIZATION CHECK ──► is this target in scope, in-window, marker present?   (skills/scope-discipline)
            │  no ──► planning-only: build & validate tests, send NOTHING
            ▼ yes
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ 1. AUTHOR     Write runnable tests — one per behaviour, each encoding          │
  │               "what secure looks like," covering the DEEP classes (IDOR,       │
  │               mass-assignment, authz, injection, SSRF, logic, auth) — not just │
  │               "does login work."                                              │
  │                                                                               │
  │ 2. VALIDATE   An INDEPENDENT reviewer scores the tests 1–5 for how much they   │
  │  (gate 4.5)   exercise the REAL risk, and names the gaps. Below 4.5/5 → fix    │
  │               and re-score. Max 3 rounds, then stop and escalate. A login-only │
  │               sweep cannot pass this gate.                                     │
  │                                                                               │
  │ 3. EXECUTE    Run the gated tests through a harness that logs EVERY request    │
  │  + LOG        and response in full. These logs are the evidence base; nothing  │
  │               may later be claimed that isn't in them.                         │
  │                                                                               │
  │ 4. ANALYZE    A SECOND independent reviewer reads ONLY the logs (never the     │
  │               conclusions) and decides, per candidate: vulnerability yes/no,   │
  │               citing exact request/response lines.                            │
  │                                                                               │
  │ 5. ADJUDICATE A THIRD, DIFFERENT reviewer re-checks each "yes": is it real,    │
  │               and is it the bug CLAIMED — not a different bug, not a test       │
  │               artifact, not expected behaviour? Default to REJECT when unsure. │
  │                                                                               │
  │ 6. REPORT     Only survivors become findings, each with honest CVSS, grounded  │
  │               evidence, and a specific fix. A confirmed finding is a STOP       │
  │               event: prove it once, file it, notify the human — do not chain   │
  │               deeper or pivot to new hosts.                                    │
  └──────────────────────────────────────────────────────────────────────────────┘
```

The repeated word is **independent**. The value of a second and third judge is that they are
*uncorrelated* with the first guess — they can't see the conclusion they're supposed to reach, and they
can only read the evidence folder handed to them. That is what turns "the model thinks it's a bug" into
"three separate passes, two of them trying to *disprove* it, all agree the evidence proves it."

> You wire "independent reviewer" to whatever you have: a second model pass, a peer agent, or a human.
> The method doesn't care *who* the judge is — only that it didn't produce the thing it's judging and
> can't see the answer it's meant to give.

---

## 4. The life of a single finding

Zoom in on one bug to see the rating machinery (`skills/finding-discipline/`) in motion:

1. **Born `[POSSIBLE]`.** The agent notices something — a URL parameter that fetches server-side, an
   object id it can change. It is a lead, nothing more.
2. **Meets the proof bar.** Each class has a specific artifact that proves impact
   (`skills/finding-discipline/references/finding-evidence-standards.md`): SSRF needs the *internal
   response body* (not a DNS ping); IDOR needs *another principal's* data (not your own object); RCE
   needs *command output*; XSS needs *script execution*. Until that artifact exists on disk, it stays
   `[POSSIBLE]`.
3. **Passes the mechanical gate.** `validate_findings.py` checks, deterministically, that the evidence
   exists and the right structured proof-signal is set. It can output `CONFIRMED / POSSIBLE / INFO /
   REJECTED`. It cannot be sweet-talked — it reads bytes and booleans — but it also can't tell if a
   boolean is *honest*.
4. **Survives the independent reviewer.** A human/second-model pass answers seven questions
   (`finding-validation-runtime.md`) and returns **PASS / KILL / DOWNGRADE**: Is it grounded? Faithfully
   cited? The right mechanism with no benign alternative? Complete proof? Honest severity? Independent?
   Free of hedge-words? Any failure drops or kills it.
5. **Rated honestly.** Severity reflects *demonstrated* impact — data sensitivity × access gained × ease
   — never the category's worst case. Over-rating a real bug is itself a defect.
6. **Revised when reality changes (REDO).** After a fix, the same gate re-runs
   (`skills/reporting-and-severity/`): can't reproduce → **downgraded/remediated**; still reproduces →
   stays confirmed, re-dated; a `[POSSIBLE]`'s missing leg now captured → **promoted**. Nothing is ever
   silently deleted — the history is part of the evidence.

That lifecycle is the difference between a report that holds up in a remediation meeting and one that
gets picked apart in the first five minutes.

---

## 5. The three pillars (and where they live)

| Pillar | What it guarantees | Where |
|--------|--------------------|-------|
| **A rating system** | every finding is `[CONFIRMED]`/`[POSSIBLE]`/`[INFO]`, every claim carries a confidence grounded in what you can *quote* | `skills/finding-discipline/` |
| **A re-rating mechanism** | ratings are revised — `PASS / KILL / DOWNGRADE`, promote/remediate — when a re-test or second judge changes what's proven | `skills/finding-discipline/references/finding-validation-runtime.md` + `skills/reporting-and-severity/` |
| **An independent pipeline** | findings are discovered, validated in isolation (evidence kept), proven, and judged *twice* before anyone calls them real | `pipeline/` + `OPERATING-CONTRACT.md` |

---

## 6. The safety model — this never bends

Everything outward-facing is gated. These are not guidelines; they are the boundary of authorized work:

- **Authorization first (`OPERATING-CONTRACT.md` §0).** Live traffic is allowed *only* when the
  engagement is signed, in-window, and the environment carries the authorization marker. Otherwise the
  agent is in **planning-only** mode — it builds and validates tests but sends nothing. Fail-closed.
- **Scope is a boundary, not a springboard (`skills/scope-discipline/`).** Every target is checked
  against a declared `scope.json` before the first packet. A finding that makes another host reachable is
  a **stop-and-flag**, never a reason to reach it. Look-alikes (`app.example.com.evil.com`) are rejected.
- **Mutate only what you created (no-delete rule).** Any object the agent creates to test with is
  prefixed `redteam-` and is the *only* thing it may modify or delete. It never touches what it didn't
  create, and reconciles to zero before finishing.
- **Ask, don't guess.** When a decision is genuinely the operator's — scope ambiguity, a missing
  credential, a conflict between an instruction and a safety rule — the agent **stops and asks a
  specific, options-based question.** Uncertainty about safety or scope always means stop.

---

## 7. The map of the kit

```
Security/
├─ README.md              ← you are here (what this is + how it works)
├─ ONBOARDING.md          ← set up your machine to run the kit (prereqs, tools, verify, scaffold)
├─ onboard.py             ← portable bootstrapper: checks tools, self-tests the rating gate, scaffolds an engagement
├─ INDEX.md               ← one-line map of every skill + method doc; load the one that matches your task
├─ OPERATING-CONTRACT.md  ← the operating rules every audit runs under (build-always / run-gated, 7 stages, object-safety)
│
├─ skills/                ← portable skill folders — each is SKILL.md (+ references/, + scripts/ where shipped)
│  ├─ finding-discipline/     ★ THE RATING SYSTEM: tiers, proof bar, confidence, the re-rating gate (+ rating tooling)
│  ├─ scope-discipline/       ★ safety: no target without authorization
│  ├─ reporting-and-severity/   honest CVSS, report structure, and re-assessment (REDO)
│  ├─ web-pentest/            web & API attack playbooks
│  ├─ recon-osint/            external attack-surface mapping & OSINT
│  ├─ vulnerability-analysis/ source-code auditing (taint, SAST, deserialization, supply chain)
│  ├─ owasp-security/         OWASP Top 10 / ASVS / LLM & agentic AI security review
│  ├─ cloud-security/         AWS/Azure/GCP identity & metadata attack methodology
│  └─ container-k8s-escape/   container breakout & Kubernetes privilege-escalation methodology
│
└─ pipeline/              ← the multi-agent validation pipeline (how findings get judged before they ship)
   ├─ PIPELINE.md             ← the seven-stage state machine
   ├─ METHOD-RATIONALE.md     ← why it's shaped this way (independence, the two-judge design)
   ├─ SUBAGENT-CHARTER.md     ← the law every independent reviewer runs under
   ├─ SWEEP-PROTOCOL.md       ← covering a large surface completely without silent gaps
   ├─ agents/                 ← role cards: test-author, test-validator, log-analyst, finding-adjudicator
   ├─ rubrics/                ← the 1–5 security-focus rubric (4.5 gate) + the adjudication rubric
   ├─ schemas/                ← JSON schemas for each reviewer's structured verdict
   ├─ templates/              ← the test template + the evidence template
   └─ lib/                    ← reference implementation: logging harness, handoff isolation, coverage check
```

★ = **gate skill**: load it *before* the action it governs (before rating/reporting a finding; before
the first packet), not after.

---

## 8. How to use it (as an agent or a human)

1. **Set up once** — follow `ONBOARDING.md` (or run `python onboard.py check`). It verifies Python, the
   optional Node harness and external security tools, and self-tests the rating gate so you know the kit
   actually runs on your machine.
2. **Start an engagement** — `python onboard.py scaffold ./my-engagement` creates a workspace with a
   `scope.json` to fill in, plus `runs/`, `evidence/`, and `findings/` folders.
3. **Load by task** — point your agent at `INDEX.md`; it loads the skill whose `description` matches what
   it's about to do. Gate skills load first.
4. **Run the loop** — author tests → validate to the 4.5 gate → execute + log → analyze → adjudicate →
   report, judging independently at each step (`pipeline/PIPELINE.md`).
5. **Rate with discipline** — never mark `[CONFIRMED]` without clearing the proof bar and the gate; let
   re-tests downgrade or kill findings freely.

---

## 9. What is intentionally *not* here

This kit ships **methodology, detection/validation logic, and the rating tooling** — not weaponized
exploit code. The runnable attack scripts from the original skills (IMDS credential harvesters,
device-code phishers, container-escape PoCs, JWT forgers, SSRF toolkits, etc.) were deliberately left
out. Each skill's `SCRIPTS.md` records what existed and what it did, so an authorized operator can
rebuild equivalent tooling. The command examples throughout the docs document *intended tool behaviour* —
treat them as a specification, not as bundled weapons. The tooling the **method itself** depends on (the
finding validator and evidence kit) *does* ship, under `skills/finding-discipline/scripts/`.

---

*Build always, run only when authorized. Write the test, validate it to the gate, log everything, prove
it, have it judged twice, rate it honestly, revise the rating when reality says so. That is the whole
method — and the reason its findings are worth believing.*
