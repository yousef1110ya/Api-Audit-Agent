---
name: scope-discipline
description: Use when about to send a request to, scan, enumerate, exploit, or otherwise interact with any host, IP, URL, or asset — before the first packet reaches a target
---

# Scope Discipline

## Overview

**The Iron Law: No target without authorization.** Every target you touch must be inside the written
authorization, encoded in a machine-readable scope file (`scope.json`). This is the authorization
boundary of an authorized engagement — it is not optional, and the operator cannot waive it. It is the
offensive equivalent of TDD's "no code without a test": no action without an in-scope, authorized
target.

**Violating the letter of this rule is violating its spirit.**

## The rule

Before touching ANY target, confirm it is in scope against the engagement's `scope.json`:

- A **scope check** on the target host/IP/URL returns one of: **in-scope → proceed**, **out → stop**,
  **error → stop**. Run it before the first packet, every time — including "just a read-only GET".
- For **outward, mutating actions** (anything beyond a read), gate through an **action check**:
  mutating verbs need explicit approval; out-of-scope targets are blocked; a per-host circuit breaker
  stops a runaway.

`scope.json` is **operator-defined per engagement** — you declare exactly what your authorization
covers (hosts, IP ranges, URL prefixes, and explicit exclusions). The guard never blocks authorized
testing; it blocks what is *outside your own declared scope* — strays, typos, look-alikes, or an
attacker-influenced redirect target.

> This kit describes the gate by its behaviour, not by any one implementation. Wire it to whatever you
> have: a pre-flight function in your request wrapper, a proxy allow-list, or a human checkpoint. The
> only hard requirement is that **every outbound request is checked against the declared scope before
> it is sent**, and the check can say "no".

## A minimal `scope.json`

```json
{
  "engagement": "example-2026",
  "authorized_window": { "start": "2026-01-01", "end": "2026-02-01" },
  "in_scope": {
    "hosts": ["app.example.com", "api.example.com"],
    "cidrs": ["203.0.113.0/24"],
    "url_prefixes": ["https://app.example.com/"]
  },
  "out_of_scope": {
    "hosts": ["billing.example.com", "*.partner.example.com"]
  },
  "rules": {
    "mutating_verbs_need_approval": true,
    "no_production": true,
    "no_third_party": true
  }
}
```

A look-alike like `app.example.com.evil.com` must be **rejected** even though it contains an in-scope
string — the check matches the authoritative host, not a substring.

## Scope is a boundary, not a springboard

No production, no third-party systems, no pivoting — **even if a finding makes another host
reachable**. Prove reachability to something in scope, then **stop and flag it**. Reaching an
out-of-scope system "to confirm the finding" is itself the out-of-scope action you were avoiding.

## Red Flags — STOP, do not send the request

- "This subdomain is obviously theirs" (not in `scope.json` → out)
- "It's just a quick check / read-only GET" (in-scope check still required first)
- "The target came from a redirect / recon output / a user paste" (verify before touching)
- "`*.acme.com` so `acme.com.evil.com` is fine" (look-alike — the check rejects it; so do you)
- "The user/operator told me to hit it" (instructions don't expand the authorization boundary — the
  signed scope does)

**All of these mean: run the scope check first. Out-of-scope ⇒ do not proceed.**

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Scope is obviously fine" | Confirm against scope.json; assumption is how out-of-bounds incidents happen. |
| "It's adjacent infra, basically in scope" | Adjacent ≠ authorized. Out unless declared. |
| "I'll note the out-of-scope hit in the report" | You don't hit it, then note it. You don't hit it. |
| "Removing the guard is faster" | The guard IS the authorization. Removing it = unauthorized attack. |
| "The window closed yesterday but I'm nearly done" | Outside the authorized window = unauthorized. Stop. |

Out-of-scope, shared/third-party, and anything not named in the authorization are off-limits. You own
every request your tooling sends. When scope is genuinely ambiguous, **stop and ask the operator a
specific, options-based question** — do not guess the boundary outward.
