---
name: finding-discipline
description: Use when about to record, claim, rate the severity of, or report any security finding — before marking anything [CONFIRMED] or writing it into the report
---

# Finding Discipline — the rating system

## Overview

**The Iron Law: No `[CONFIRMED]` without proof.** A finding is a claim about real, demonstrated
impact — not a status code, a reflected string, or a hunch. This is the offensive equivalent of
test-driven development: the proof is the test, and the finding does not exist until it passes.

**Violating the letter of this rule is violating its spirit.**

## The three tiers (the rating)

- **`[CONFIRMED]`** — impact demonstrated AND grounded in an evidence artifact that exists on disk.
- **`[POSSIBLE]`** — reachable but the class proof bar is not yet met. Keep digging; do not report as real.
- **`[INFO]`** — true but no security impact at the claimed severity.

A rating is a claim you must be able to defend with an artifact. It is **not permanent** — see
"Ratings can be revised" below.

## The proof bar (per class)

A status code is not impact. See [`references/finding-evidence-standards.md`](references/finding-evidence-standards.md):
SSRF needs the internal response; IDOR needs *another principal's* data; RCE needs command output;
XSS needs script execution; open redirect needs an external destination. Until the class bar is met,
the rating is `[POSSIBLE]`, not `[CONFIRMED]`.

## Required gate before any finding is recorded or reported

1. Assemble the evidence artifact(s) the class requires and point the finding at them on disk.
2. Run the finding through the **independent validation gate** — the 7-question runtime in
   [`references/finding-validation-runtime.md`](references/finding-validation-runtime.md). It returns
   **PASS / KILL / DOWNGRADE**. "Independent" means the reviewer is not whoever produced the finding
   and sees only the evidence, never the pre-written conclusion.
3. Only a `[CONFIRMED]` survivor goes in the report. Severity must match what was demonstrated
   (CVSS honest — see the `reporting-and-severity` skill).

> The original method wired step 2 to a scripted validator plus a dedicated reviewer agent. In this
> portable kit the gate is defined by its *questions and outcomes*, not by any one tool — map it to a
> second model pass, a peer reviewer, or a human. What matters is that the gate is independent and can
> return KILL or DOWNGRADE, not just PASS.

## Read-first, never name-guess

If a function calls another, **read the callee** — do not infer what it does from its name.
`sanitize()`, `is_safe()`, `validate_input()` are exactly where vulnerabilities hide; a name is a
claim by the author, not evidence. The same applies to a config key, a decorator, or a CVE title:
open the thing before you reason about it. An unread dependency in a data-flow claim is a hole.

## Quote-grounded confidence tiers

Every claim in a finding carries a confidence grounded in *what you can quote*, not in how it feels:

- **High** — a **direct quote** from the artifact (the exact source line, the response body, the
  decompiled instruction) supports the claim.
- **Medium** — an **explicitly stated assumption** bridges a gap you could not directly observe.
  State the assumption; do not hide it.
- **Low** — an **inference** you are flagging as unverified. Acceptable to record, never to report as
  fact.

This is orthogonal to the `[CONFIRMED]/[POSSIBLE]/[INFO]` tier (which is about *impact*); confidence
is about *how well-grounded the claim is*. A High-confidence claim of a Low-impact bug is still Low.

## Ratings can be revised — the re-rating rule

A rating is the best-supported claim *at the time it was made*. New evidence changes it, and that is
the system working, not failing:

- A re-test after a fix, or a second independent judge, that cannot reproduce the claimed impact
  **downgrades** the finding (`[CONFIRMED]` → `[POSSIBLE]`/`[INFO]`) or **kills** it. Record the
  reason and the date; do not quietly delete it.
- A `[POSSIBLE]` whose proof bar is later met is **promoted** to `[CONFIRMED]` — with the new artifact.
- Severity is revised the same way: if the demonstrated impact was narrower than first claimed, the
  CVSS comes **down**. Honest down-rating is how the finding list stays trustworthy.

See `skills/reporting-and-severity/` for the re-assessment (REDO) workflow that applies this after a
remediation window.

## Red Flags — STOP, downgrade to `[POSSIBLE]`

- "I'm sure it's exploitable" (but haven't shown impact)
- "The payload reflected, so it's XSS" / "I got a 200, so it works"
- "The DNS callback fired" (SSRF with no internal response)
- "I changed the id and got data" (but it was my own — self-IDOR)
- "It probably works on a real target" (default-deployment unproven)

**All of these mean: it is `[POSSIBLE]`, not `[CONFIRMED]`. Get the evidence.**

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Pattern-matched, clearly vulnerable" | Pattern ≠ exploit. Demonstrate impact or it's POSSIBLE. |
| "I'll attach evidence later" | No artifact on disk = ungrounded = REJECTED now. |
| "Blind RCE counts" | No output / no OOB confirmation = POSSIBLE, not CONFIRMED. |
| "Severity is obviously Critical" | CVSS must reflect demonstrated impact, not the worst case. |
| "The validator is overkill here" | Untested findings are how false positives ship. Run the gate. |
| "The function is called `sanitize`, so it's safe" | A name is the author's claim, not proof. Read the callee. |
| "The solver timed out, so it's not exploitable" | A tool limit is `feasibility:null` (manual), never `false`. |
| "It was CONFIRMED last week, so it still is" | A rating is revisable. Re-test invalidated it ⇒ downgrade it. |

A short list of CONFIRMED findings beats a long list of POSSIBLEs. Killing a false positive is success.
