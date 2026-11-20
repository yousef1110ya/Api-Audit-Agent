# Why the pipeline looks like this

## Why it exists
A single agent that "looks for bugs and writes a report" produces findings you cannot trust: it may
**over-call** (plausible-but-wrong), **under-call** (miss the real risk while the tests only check
authentication), or **confirm a bug via a different cause than it claims**. This pipeline is built so
that by the time something is called a finding, it has survived: a written reproducible test, an
independent quality gate on those tests, a full-fidelity run log, and **two** independent judgements on
the evidence.

## External inspiration
The shape follows a published autonomous-security method (OpenAI, *"A thousand fewer paths to root"*,
2026): a multi-stage pipeline that **discovers** security-relevant targets → **dynamically validates**
each candidate in an isolated sandbox (preserving runtime evidence) → **assesses exploitability** by
building a PoC → generates a patch → **human review**. The lesson taken most seriously: in a preliminary
run, a meaningful fraction of claimed root exploits actually reached root via a *different* bug than the
one assigned — so they added **an independent check that each exploit uses its intended vulnerability**.

## How those stages map to ours
| External stage | Our stage | Trust property it buys |
|---|---|---|
| Discover audit targets | 1 Author tests (deep categories, not authN-only) | we test where the risk actually is |
| Dynamic validation in a sandbox, keep evidence | 4 Execute + **log every req/resp** | the evidence is complete and replayable |
| Exploitability / PoC | the test itself + `run.expect` secure-outcome | "it reproduces" is written down, not asserted |
| **Independent check it's the intended bug** | 6 Adjudication (separate reviewer) | no plausible-but-wrong / wrong-cause findings |
| Human review | 7 Report → operator stop-and-flag | a human signs off before it's acted on |
| *(ours, added)* | 2–3 Validate+iterate the tests to ≥4.5/5 | the audit can't ship as an authN baseline |

## The two things we added beyond the source method
1. **A quality gate on the tests, before running them.** The source method validates *findings*; we also
   validate the *tests* (Stage 2) so we don't run a shallow suite and call the clean result an audit.
   The 4.5/5 bar came from a real miss: an authN-only suite that rated ~1.3/5 — exactly what the gate
   now blocks.
2. **Structural isolation of the judges.** Each judging reviewer (Stage 2/5/6) is a fresh instance that
   can read only a handoff folder built for it (`lib/handoff.mjs`) and is told, in plain terms, that
   reading outside it voids the verdict. No prior knowledge, no favoritism, no peeking at another
   stage's conclusion.

## Why independence is non-negotiable
If Stage 6 could see Stage 5's reasoning, or either could read the whole repo, their "confirmation" would
just echo the first guess. The value of a second judge is that it is *uncorrelated* with the first. We
spend the extra reviewers precisely to buy that independence — the same reason the source method added
its independent check. Map "reviewer" to whatever you have (a second model pass, a peer, a human); the
one hard requirement is that it did not produce the thing it is judging and cannot see the conclusion it
is meant to reach.
