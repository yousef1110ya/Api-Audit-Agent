# pipeline/ — the shared secure-testing engine

One validated, logged, multi-agent pipeline that **every** engagement runs its security audits through.
Built so findings are *trustworthy*: nothing is a finding until it was tested in writing, the tests were
independently judged good enough, the run was logged in full, and the result was independently confirmed
twice.

## Start here
1. **`../OPERATING-CONTRACT.md`** — the operating contract (the rules; read first).
2. **`PIPELINE.md`** — the seven-stage state machine (what runs, in what order, with which gates).
3. **`SUBAGENT-CHARTER.md`** — the law every independent reviewer obeys (no prior knowledge, no
   favoritism, read-only handoff).

## What's here
| Path | What |
|------|------|
| `PIPELINE.md` | the canonical stage sequence + gates |
| `SUBAGENT-CHARTER.md` | shared rules binding all independent reviewers |
| `SWEEP-PROTOCOL.md` | covering a large surface completely without silent gaps (coverage ledger) |
| `agents/` | one role card per reviewer: test-validator, log-analyst, finding-adjudicator (+ test-author for the main agent) |
| `rubrics/` | `SECURITY-FOCUS-RUBRIC.md` (1–5, gate 4.5) and `FINDING-ADJUDICATION-RUBRIC.md` |
| `schemas/` | JSON schemas the reviewers must return (`rating`, `log-finding`, `adjudication`) |
| `templates/` | `TEST-TEMPLATE.mjs`, evidence template |
| `lib/harness.mjs` | target-agnostic request/response logger (Stage 4) — reference implementation |
| `lib/handoff.mjs` | builds the isolated input folder for a reviewer (Stage 2/5/6) |
| `lib/verify-coverage.mjs` | checks the coverage ledger for untested modules |

> The reference implementation in `lib/` is Node.js (`.mjs`) and was written for one specific harness.
> Treat it as an executable **specification** of the behaviour each stage needs (per-target config, a
> fail-closed authorization gate, full req/resp logging, isolated handoffs) — port it to your own
> stack rather than assuming it drops in unchanged.

## How a target plugs in
Drop a per-target config file (here `pipeline.app.json`) next to the target's test suite so the harness
knows where its env, runs, and scope live:
```json
{ "app": "example-app", "envFile": "env/dev.env",
  "runsDir": "runs", "requireMarker": "<AUTHORIZED_MARKER>" }
```
- `requireMarker` is the environment variable that must be present for **live traffic** to be allowed
  (the §0 fail-closed gate). Absent ⇒ planning-only mode: build and validate tests, send nothing.

Then author tests with the harness (`new Run({ app: 'example-app', module: 'auth' })`) and drive the
stages per `PIPELINE.md`. Each target keeps its own scope, environment, and knowledge base — the
pipeline consumes those as Stage-1 inputs; it does not replace them.

## Running a reviewer stage (orchestrator cheat-sheet)
```js
import { buildHandoff } from './lib/handoff.mjs';
const h = buildHandoff({
  runDir, stage: '02-test-validation', role: 'test-validator',
  charterPath: 'pipeline/SUBAGENT-CHARTER.md',
  roleCardPath: 'pipeline/agents/02-test-validator.md',
  inputs: [{ as: 'tests/auth.test.mjs', from: '<abs path>' }],
  task: 'Rate the security-focus of these tests per the rubric and return rating.schema.json.',
});
// → launch the independent reviewer (second model pass / peer / human) pointed ONLY at h.dir;
//   require JSON matching the schema named in the role card. Reading outside h.dir voids the verdict.
```

## The method, in one line
*Discover → validate in isolation (keep the evidence) → prove → independently check the finding is what
it claims → human review.* See the top-level `README.md` and `OPERATING-CONTRACT.md` for the rationale.
