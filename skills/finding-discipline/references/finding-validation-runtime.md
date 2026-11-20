# Finding Validation Runtime — the gate that returns PASS / KILL / DOWNGRADE

This is the **re-rating mechanism**: the independent check every finding passes before it is called
real, and the same check that *lowers or kills* a finding when its proof doesn't hold up. A rating is
never final until it survives this gate, and a finding that was `[CONFIRMED]` last week is downgraded
the moment a re-test or a second judge invalidates it.

Run it in two layers:

1. **Mechanical gate** — a deterministic pass (the `validate_findings.py` tooling shipped with this
   skill, or an equivalent) checks grounding and the per-class proof signal. It can only ever output
   `CONFIRMED | POSSIBLE | INFO | REJECTED`. It cannot judge *honesty*.
2. **Independent reviewer** — a role that is **not** whoever produced the finding, sees **only** the
   evidence (never the pre-written conclusion), and answers the seven questions below. Its verdict
   space is **PASS / KILL / DOWNGRADE**. Map "reviewer" to a second model pass, a peer, or a human —
   the only hard requirement is independence.

The governing instinct: **confirming a non-finding is the worst outcome.** When the evidence is short,
step *down*, never up. Killing a false positive is a success.

## The seven questions

For each candidate finding, the reviewer answers these in order. Any **No** on Q1–Q4 is a KILL or a
DOWNGRADE, not a "well, probably".

1. **Grounded?** — Does every cited evidence artifact exist on disk, non-empty, and actually contain
   what the finding says it does? A paraphrase the bytes don't support → **KILL**.
2. **Faithful citation?** — Does the cited log step / source line say what the finding claims, not a
   mis-summary of it? If the step doesn't contain it → **KILL**.
3. **Right mechanism?** — Does the evidence prove *this* class, with no benign alternative that fits
   the same bytes equally well? You must explicitly rule out the usual alternatives:
   - endpoint public **by design** (does the same path return 401/403 without a token? if not, it's
     not an authz bug);
   - the tester used a **privileged** token (which principal actually made the request?);
   - the object was **created by the tester** (then reading it is not cross-tenant);
   - a **5xx / error body** mistaken for a data leak;
   - **expected** business behaviour (the role is *allowed* to do this).
   If a different cause explains it → **KILL**, or re-categorise with reasoning.
4. **Complete proof?** — Are **all legs** of this class present? (BOLA: victim object id + its owner +
   attacker principal/token + attacker request + victim data in the response. Mass-assignment: the
   over-posted field **and** a read-back showing it persisted. SSRF: proof the server made the egress,
   not a 200 on submit. Injection: payload **and** a response proving interpretation, not a reflected
   string.) Missing a leg → **DOWNGRADE** to `[POSSIBLE]`; name the exact missing step.
5. **Severity honest?** — Is the assigned severity the **demonstrated** impact (data sensitivity ×
   access gained × ease), not the category's worst case? If it's inflated → **DOWNGRADE** the
   severity. Over-rating is a defect even when the bug is real.
6. **Independent?** — Was this judged without knowledge of what the producer "wanted" the answer to
   be? If the reviewer finds themselves matching a pre-written conclusion, that conclusion is set aside
   and the evidence is re-read cold.
7. **Free of hedge language?** — Does the finding read as proven, or as a guess (*probably, should
   work, likely exploitable, in theory*)? Hedge language on a `[CONFIRMED]` finding is a smell — the
   hedge is removed by real proof, or the tier comes down. Hedges never by themselves set a tier, but
   they never survive on a confirmed one either.

## The verdicts

- **PASS** — all seven hold. The finding ships at the demonstrated severity. (Mechanical tier
  `CONFIRMED`, reviewer PASS.)
- **DOWNGRADE** — real mechanism but a missing leg (Q4) or inflated severity (Q5). Lower the tier
  (`[CONFIRMED]` → `[POSSIBLE]`) or lower the CVSS, record the exact missing step, and capture it as a
  follow-up to chase on the next pass. The finding is not deleted — it is re-rated, on the record.
- **KILL** — fails faithfulness (Q1/Q2) or right-mechanism (Q3), or a benign explanation fits. Record
  the **alternative explanation** that killed it. A KILL is a false positive caught; log the reason so
  it isn't re-raised.

## Re-rating after a fix (the REDO trigger)

The same seven questions re-run after a remediation window:

- **Re-test can't reproduce the claimed impact** → the finding is **DOWNGRADED** (`[CONFIRMED]` →
  `[POSSIBLE]`/`[INFO]`) or marked **REMEDIATED**, dated, with the re-test evidence.
- **Re-test still reproduces** → it stays `[CONFIRMED]`, re-dated, with the new evidence.
- A `[POSSIBLE]` whose missing leg is now captured → **PROMOTED** to `[CONFIRMED]` with the new
  artifact.

See `skills/reporting-and-severity/` for the full re-assessment workflow this plugs into.

## Why two layers, not one

The mechanical gate cannot be sweet-talked (it reads bytes and booleans), but it cannot tell whether a
boolean is *honest* — someone could set `cross_identity_confirmed: true` for a self-IDOR. The
independent reviewer cannot read every byte as reliably as a script, but it *can* judge honesty and
alternative explanations. Each covers the other's blind spot. Neither alone is the gate; both are.
