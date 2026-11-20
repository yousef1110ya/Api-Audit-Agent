# SECURITY-FOCUS-RUBRIC — how much do these tests exercise real risk? (Stage 2 gate)

Used by the **test-validator** (Stage 2) to score test files, and referenced by the **log-analyst** (Stage 5)
for "what secure looks like". Scale is **1–5**. The pipeline gate is **≥ 4.5 / 5** (the 90% bar).

## Per-module score anchors

| Score | Meaning |
|------:|---------|
| **5** | Tests exercise **all applicable** high-severity categories for the module with a proper **create → attempt-illegal → assert-rejected** shape, and every assertion encodes the *secure* outcome (would fail if the server were insecure). Negative AND positive controls present. |
| **4** | The module's **primary** risks are genuinely tested with correct secure-outcome assertions; one secondary category thin or a control missing a read-back. |
| **3** | Some real authorization/injection/logic testing, but gaps: a key category absent, or assertions that only partly pin "secure". |
| **2** | Mostly authN presence checks (token/no-token) plus a sanity read; the module's real authz/injection/logic surface is barely touched. |
| **1** | AuthN-baseline only, or deep categories present only as `PENDING` stubs; assertions can't fail on an insecure server. |

## Which categories are "applicable"
Judge against what the module *does* (from the test file's own intents/endpoints — you are not given the app
KB). Typical mapping:
- **Any object with an owner/tenant** → BOLA/IDOR + mass-assignment are applicable.
- **Create/update with fields like role, tenant/namespace, price, status** → mass-assignment applicable.
- **Role/permission/group endpoints** → privilege-escalation applicable.
- **Query/criteria/odata/search** → injection applicable.
- **Any URL/host/webhook/import field** → SSRF applicable.
- **State machines (orders, permits, snags, approvals)** → business-logic applicable.
- **auth/login/token/refresh/mfa** → auth-session (forgery, rotation, enumeration) applicable.
- **An AI/agent feature** → LLM prompt-injection / excessive-agency / billing-authz applicable.
A category that is genuinely N/A for a module does not count against it — but say so explicitly.

## Scoring the assertion (the common failure)
An assertion earns credit only if a **secure** server would make it **pass** and an **insecure** one would make
it **fail**. Examples:
- ✅ `expect(status, [403,404], 'cross-tenant read denied')` on B reading A's object — credited.
- ❌ `expect(status, [200], 'reads object')` on the owner reading its own object — proves nothing about authz.
- ❌ asserting only `status < 500` — proves the server didn't crash, not that it's secure.

## Aggregation → `overall`
`overall` = the **mean of module scores**, but **capped at 2.9** if ANY module with high-severity surface
(auth, a tenant-owned object, a role/permission endpoint, an SSRF-capable field, or an AI feature) scores ≤ 2.
Rationale: the gap is worst exactly where risk is highest; a few strong modules must not average away a
blind spot on a critical one. `gate_met = overall >= 4.5`.

## Worked example (why 4.5 is strict)
Ten modules averaging 4.6 but with `auth` at 2 (no token-forgery test) → capped to 2.9, **gate not met**:
rewrite `auth` first. This is deliberate — it is the exact failure the gate exists to catch: an
authN-only baseline suite (which has rated as low as ~1.3/5 in practice) must never ship as "an audit".
