# Finding evidence — <F-ID> <short title>

> Filled in at Stage 7 from the pipeline artifacts. Every row must point at a real artifact; no claim without
> a cited step/script (the OPERATING-CONTRACT, #9). This complements the app's own FINDING-TEMPLATE.md.

| field | value |
|-------|-------|
| **Target** | <target name> |
| **Module / endpoint** | `GET /api/v1/…` |
| **Category** | BOLA / mass-assignment / injection / SSRF / auth-session / business-logic / LLM |
| **Severity** | critical / high / medium / low (from adjudicator, mapped to app rubric) |
| **Status** | CONFIRMED |
| **Pipeline run** | `runs/<run-id>/` |
| **Test file** | `testing/tests/<module>.test.mjs` (reproduces it) |

## What secure should do
<one line — the control that should have fired and the expected status/behaviour>

## Evidence chain (from the logs — do not paraphrase away the proof)
1. **Setup** — step N: `<request>` → `<response>` (e.g. created A-owned object `<id>` under tenant A).
2. **Attack** — step M: `<request as attacker principal>` → `<status + body excerpt proving the flaw>`.
3. **Proof** — the response body contains `<the data/field that proves it>` which the principal must not get.

## Adjudication
- Stage 5 (log-analyst): `<yes>` — `runs/<id>/stage5-analysis.json#C?`
- Stage 6 (adjudicator): `CONFIRMED` — `runs/<id>/stage6-adjudication.json#C?`
- Alternative explanations ruled out: `<e.g. not public-by-design: step 2 shows 401 without a token>`

## Reproduce
```
node <App>/testing/tests/<module>.test.mjs    # with the app env authorized
# then read runs/<new-id>/steps.jsonl steps N..M
```

## Remediation (suggested)
<one or two lines; link the app REMEDIATION-GUIDE.md>
