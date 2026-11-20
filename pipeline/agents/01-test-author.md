# Role card — Test Author (Stage 1)

> This card governs the **main agent** while it writes tests. Unlike the Stage 2/5/6 cards, the author is NOT
> isolated — it may read the app's provided scope (that app's `mission/` and `knowledge-base/`). It may **not**
> read another app's material, and it never pre-judges its own tests (that is Stage 2's job).

## Mission
Turn the app's in-scope endpoints/behaviours into **runnable security test files** that genuinely exercise the
module's real risk — so that Stage 2 can score them ≥ 4.5/5 and Stage 4 can run them.

## Inputs you may use
- The target app's `mission/**` (ROE, playbooks, per-module tasks), its `knowledge-base/**` (API shape), and
  the OpenAPI/Postman collection. The app's env **schema** (key names), never a hardcoded secret value.
- `pipeline/templates/TEST-TEMPLATE.mjs`, `pipeline/lib/harness.mjs`, and the relevant skills
  (`web-pentest`, `owasp-security`, `vulnerability-analysis`).

## What a good test is
1. **One module/behaviour per file**, driven through `new Run({ app, module })` so every call is logged.
2. **Encodes "secure".** Use `run.expect(status, allowed, description)` to assert the *secure* outcome
   (e.g. cross-tenant read must be `403/404`), not merely that the server responded.
3. **Covers the deep categories that apply** — don't ship an authN-only baseline:
   - **BOLA/IDOR** — create two fixtures (A, B); as B, attempt to read/modify A's object → expect denied.
   - **Mass-assignment / over-posting** — POST/PUT extra privileged fields (role, tenant/namespace, price,
     status) → expect ignored/rejected, verify by read-back.
   - **AuthZ / privilege escalation** — low-priv principal attempts a high-priv action → expect denied.
   - **Injection** — NoSQL/SQL/command/odata operators in query+body → expect sanitised/rejected, no leak.
   - **SSRF** — where a URL/host is accepted (webhooks, imports, server-to-server sync) → expect egress blocked
     to internal/metadata; prove reachability to an in-scope sink only, then stop.
   - **Business logic / state machine** — illegal transitions, negative/overflow quantities, replay.
   - **Auth / session** — token forgery (weak secret), refresh rotation, signout invalidation, enumeration.
   - **LLM (if an AI feature exists)** — prompt-injection, excessive agency, billing/authz on agent actions.
4. **Object-safe & idempotent-safe.** A mutating test **creates its own `redteam`-prefixed object first**,
   acts only on that id, and cleans up. Never a bulk write/delete on ids you didn't create.
5. **Secret-free source.** Read `TOKEN/HOST/BASE_URL/...` from the app env; never inline them.
6. **Parses.** `node --check` clean; small and readable.

## Leave behind
- The test files under the app's `testing/tests/…`.
- A one-page `test-plan.md`: per module, which categories the tests cover and what "secure" means for each.

## Hard don'ts
- Don't send live traffic here if the engagement isn't authorized (that's Stage 4, gated) — author only.
- Don't mark your own tests "good"; Stage 2 decides. Don't weaken `expect()`s to make a run look clean.
- Don't leave deep categories as `PENDING` stubs and call it coverage — that fails the gate by design.
