# Finding Evidence Standards — the per-class proof bar

A status code is not impact. A reflected string is not execution. A DNS callback is not a read. For
each vulnerability class there is a **specific artifact** that moves a finding from `[POSSIBLE]` to
`[CONFIRMED]`. Until that artifact exists on disk, the rating stays `[POSSIBLE]`.

These standards are mechanical on purpose: they are driven by **structured proof signals** (explicit
booleans you set), never by paraphrasing analyst prose. Prose can be worded to dodge a check in either
direction; a boolean can't. Whether the boolean is *honest* is the job of the independent reviewer
(see [`finding-validation-runtime.md`](finding-validation-runtime.md)) — the mechanical gate only
checks that the right signal is set and the evidence it points to exists.

## The two universal checks

Every finding, regardless of class, must pass both:

1. **Grounding** — every cited evidence path exists on disk and is non-empty. No artifact = ungrounded
   = REJECTED now. "I'll attach it later" is not grounding.
2. **Class proof** — for a recognized class, `[CONFIRMED]` requires the class's positive proof signal
   to be explicitly true; an explicit disqualifier forces REJECTED; otherwise the finding is
   `[POSSIBLE]` (go gather more proof).

## Per-class proof signals

| Class | CWE(s) | Confirm signal — what the artifact must show | Disqualifier → REJECT |
|-------|--------|----------------------------------------------|-----------------------|
| **SSRF** | 918 | `internal_response_read` — an internal/restricted **response body** was read back (not a bare DNS/OOB callback) | — |
| **IDOR / BOLA** | 639, 862, 566, 284, 1220 | `cross_identity_confirmed` — **another principal's** data was accessed using a second identity you control | `self_idor` — it was your own object |
| **CORS** | 942 | `creds_reflected_origin` — ACAO reflected the origin **and** `Access-Control-Allow-Credentials: true`, with a cross-origin authenticated read | — |
| **Open redirect** | 601 | `external_redirect` — the final redirect `Location` host is external/attacker-controlled | `same_origin` — destination stays on-site |
| **XSS** | 79, 80 | `script_executed` — script **actually executed** in the victim context | `encoded_inert` — reflected but encoded/inert |
| **RCE / command injection / deserialization** | 78, 77, 94, 502 | `command_output_captured` — command **output** was captured (blind with no confirming OOB is POSSIBLE, not CONFIRMED) | — |

## Native memory-corruption needs demonstrated reachability

A crash on paper is not exploitability. For native memory-corruption classes (CWE-119/120/121/122/124/
125/126/127/129/131/134/170/190/191/415/416/457/476/562/590/680/763/786/787/788/805/822/823/824/825/843),
`[CONFIRMED]` requires a machine-checkable **reachability artifact**, because the vulnerable line may
never execute on the path you assume:

- **a gcov line-hit** — the vulnerable source line shows a positive execution count (not `#####`, not
  `0`), **or**
- **a function trace** — the vulnerable function appears in a real execution record (a call `fn(...)`,
  a stack frame `#N … fn`, or a trace arrow `-> fn`), not merely mentioned in prose/a comment/a symbol
  dump.

Without one of those, the finding is `[POSSIBLE]`, labelled *native memory-corruption: no demonstrated
reachability*.

## When no automated class check applies

Some real findings don't match a class rule (business-logic flaws, auth/session design errors). These
can still be `[CONFIRMED]` — but **only a reviewer** confirms impact, by reading the grounded evidence.
The mechanical gate passes them as "grounded; no automated class check applies (reviewer must confirm
impact)" — that is a hand-off to the human/independent judge, not an automatic confirmation.

## Hedge language is a smell, never a verdict

Words like *probably, should work, likely exploitable, might, seems to, in theory, I think* are linted
as **advisory warnings** — they flag "you wrote this like a guess" so a reviewer re-checks. They never
by themselves set or lower a tier (prose is paraphrasable). But a `[CONFIRMED]` finding carrying hedge
language should not ship until the hedge is removed by actual proof or the tier is lowered.

## The output tiers

`CONFIRMED | POSSIBLE | INFO | REJECTED` — the first three are the finding tiers; **REJECTED** is the
gate refusing an ungrounded or disqualified claim. A REJECTED result is the system working: a false
positive caught before it shipped.
