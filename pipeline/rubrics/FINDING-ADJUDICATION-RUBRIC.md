# FINDING-ADJUDICATION-RUBRIC — is this really a flaw, and the flaw claimed? (Stage 6 gate)

Used by the **finding-adjudicator** (Stage 6). Verdict space is **CONFIRMED / PLAUSIBLE / REJECTED**. Only
**CONFIRMED** becomes a reported finding. The governing instinct: **confirming a non-finding is the worst
outcome** — when the evidence is short, step down, don't up.

## The three tests every candidate must pass to be CONFIRMED
1. **Faithful citation** — the cited log step exists in `inputs/` and actually contains what the candidate
   says it does. A paraphrase that the bytes don't support → **REJECTED**.
2. **Right mechanism** — the evidence proves *this* category, and no benign/alternative explanation fits the
   same bytes equally well. You must explicitly consider and rule out the likely alternatives:
   - endpoint is public **by design** (same path returns 401 without a token? if not, not an authz bug);
   - the tester used a **privileged** token (check which principal/token the request used);
   - the object was **created by the tester** (then reading it is not cross-tenant);
   - a **5xx/error body** mistaken for a data leak;
   - **expected** business behaviour (the role is *allowed* to do this).
   If a different cause explains it → **REJECTED** (or re-categorise with reasoning).
3. **Complete proof** — all legs of the specific category are present:
   - **BOLA/IDOR:** victim object id + its owner, attacker principal/token, attacker request, victim data in
     the response. Missing a leg → **PLAUSIBLE**.
   - **Mass-assignment:** the over-posted privileged field in the request **and** a read-back showing it
     persisted/took effect. No read-back → **PLAUSIBLE**.
   - **Privilege escalation:** low-priv principal confirmed low-priv, then the high-priv action succeeded.
   - **Injection:** payload **and** a response that proves interpretation (changed result set, error revealing
     the engine, data that shouldn't return). A reflected string alone → **PLAUSIBLE**.
   - **SSRF:** proof the server made the egress to the attacker-chosen in-scope sink (callback hit / differential
     timing / response contents). A mere 200 on submit → **PLAUSIBLE**.
   - **Auth/session:** forged/replayed token **accepted** on a protected call; or old token still valid after
     signout/rotation — shown by two logged calls.

## Verdicts
- **CONFIRMED** — all three tests pass. Assign severity (critical/high/medium/low) from real impact
  (data sensitivity × access gained × ease), not from category name.
- **PLAUSIBLE** — mechanism is likely right but one proof-leg is missing. Name the **exact** missing step in
  `missing_to_confirm`; the orchestrator files a `TODO-BACKLOG.md` item to capture it on the next run.
- **REJECTED** — fails faithfulness or right-mechanism, or a benign explanation fits. Record the alternative.

## Severity sanity (don't inflate)
- `critical` — full auth bypass, unauthenticated mass data access, RCE, cross-tenant write at scale.
- `high` — cross-tenant read of sensitive data, privilege escalation, authenticated injection with data access.
- `medium` — info disclosure of limited scope, logic flaw needing conditions, weak policy.
- `low` — headers/config hardening, verbose errors, missing clickjacking defense.
Map to the app's own `SEVERITY-RUBRIC.md` at report time; here, just don't over-rate.

## Independence reminder
You do not know, and must not try to match, what Stage 5 "wanted" the answer to be. If the whole candidate set
looks over-called, reject the ones that don't prove out — that is precisely your purpose.
