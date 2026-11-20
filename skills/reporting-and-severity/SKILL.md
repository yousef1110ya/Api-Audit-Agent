---
name: reporting-and-severity
description: Use when writing the report, assigning CVSS/severity, or re-assessing a finding after a fix or a second opinion (re-rating / REDO)
---

# Reporting & Severity — honest ratings and how they get revised

A report is only as trustworthy as the weakest rating in it. This skill covers three things: how a
finding is written, how severity is assigned **honestly**, and how a rating is **revised** when a
re-test or second opinion changes what's proven. It sits downstream of `finding-discipline` (which
decides whether a finding is `[CONFIRMED]` at all).

## 1. Finding structure

Every reported finding carries, at minimum:

- **ID + title** — stable, e.g. `F-003 — Cross-tenant read via unscoped object id`.
- **Status tier** — `[CONFIRMED]` / `[POSSIBLE]` / `[INFO]` (only `[CONFIRMED]` is a real finding;
  `[POSSIBLE]` belongs in an appendix, clearly labelled as not-yet-proven).
- **Severity + CVSS vector** — justified by demonstrated impact (see §2), with the vector shown.
- **Affected asset / endpoint / file:line** — exactly where.
- **Evidence** — the grounded artifact(s): the request/response pair, the source line, the captured
  command output. Each claim in the write-up is traceable to one of them.
- **Reproduction** — the minimal steps to reproduce once. If it can't be reproduced, it isn't
  `[CONFIRMED]`.
- **Impact** — what an attacker gains, stated as demonstrated, not as worst-case speculation.
- **Remediation** — the specific fix, and the design-level root cause where there is one.
- **Confidence** — High / Medium / Low, grounded in what you can quote (see `finding-discipline`).

A short report of `[CONFIRMED]` findings beats a long one padded with `[POSSIBLE]`s. Never inflate the
count.

## 2. Severity — rate the demonstrated impact, not the category name

CVSS must reflect **what was shown**, not the worst thing the category *could* mean. Impact =
*data sensitivity × access gained × ease*. Map, don't inflate:

| Severity | What it takes |
|----------|---------------|
| **Critical** | full auth bypass, unauthenticated mass data access, RCE, cross-tenant write at scale |
| **High** | cross-tenant read of sensitive data, privilege escalation, authenticated injection with data access |
| **Medium** | info disclosure of limited scope, a logic flaw needing conditions, a weak policy |
| **Low** | header/config hardening, verbose errors, missing clickjacking defense |

Severity-honesty checks before you publish a rating:

- Did you demonstrate the impact, or assume it? Assumed impact caps severity until proven.
- Is the access you showed the access you're rating? (A self-read is not cross-tenant.)
- Is the pre-condition realistic in the real deployment, or only in your lab? Unrealistic
  pre-conditions lower the rating.
- Does the CVSS vector match the story? (`PR:N` but you used an admin token is dishonest — fix it.)

Over-rating a real bug is still a defect. If the demonstrated impact is narrower than first claimed,
the severity comes **down**.

## 3. Re-rating — the REDO / re-assessment workflow

A rating is the best-supported claim **at the time it was made**. It is revised on new evidence, and
that revision is part of the method, not an admission of failure.

**When to re-assess:**
- after a remediation window (the owner says "fixed, re-test"),
- when a second independent judge disagrees with the first,
- when new evidence surfaces (a missing proof-leg is captured, or a benign explanation appears).

**How to re-assess — re-run the gate** (`finding-discipline/references/finding-validation-runtime.md`)
against fresh evidence and update the rating on the record:

| Re-test result | New status | What you record |
|----------------|-----------|-----------------|
| Claimed impact **no longer reproduces** | `REMEDIATED` (or downgrade `[CONFIRMED]`→`[POSSIBLE]`/`[INFO]`) | the re-test evidence + date; the fix that closed it |
| Claimed impact **still reproduces** | stays `[CONFIRMED]`, **re-dated** | the new evidence proving it's still open |
| A `[POSSIBLE]`'s **missing leg is now captured** | **promote** to `[CONFIRMED]` | the new artifact that met the proof bar |
| A **benign explanation** now fits the bytes | **KILL** (false positive) | the alternative explanation that killed it |

**Rules for a re-assessment:**
- Never silently delete a finding. A killed or remediated finding stays in the record with its
  reason and date — the history is part of the evidence.
- Re-test with the **same rigor** as the first pass: the per-class proof bar still applies. "They said
  they fixed it" is not proof it's fixed; re-run the test.
- A re-assessment report states, per finding: *prior status → new status*, the date, and the evidence
  that drove the change. Produce a dated re-assessment document (e.g.
  `REDO-ASSESSMENT-<date>.md`) rather than editing the original in place, so both are auditable.

## 4. Write-up discipline

- **No hedge language on a `[CONFIRMED]` finding.** *Probably / should work / likely exploitable* means
  the proof isn't there — get it or lower the tier.
- **Every claim quotes its evidence.** If you can't point at the artifact line that backs a sentence,
  cut the sentence.
- **Separate impact from speculation.** "An attacker could then…" chains beyond what you proved belong
  in a clearly-labelled *potential impact* note, not in the demonstrated-impact section.
- **Remediation is specific.** "Validate input" is not remediation. Name the sink, the control, and the
  design change.

See `skills/owasp-security/reference/owasp-report.md` for secure-pattern remediation language per
OWASP class, and `skills/finding-discipline/` for the rating system this reporting sits on top of.
