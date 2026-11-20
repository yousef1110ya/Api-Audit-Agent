# Index — Security Testing Method

Load the skill whose description matches what you're about to do. Gate skills (★) must be loaded
*before* the action they govern, not after.

## Getting started

| Doc | Read it when… |
|-----|---------------|
| [README.md](README.md) | first — what this kit is and how an agent works with it end to end. |
| [ONBOARDING.md](ONBOARDING.md) | setting up a machine: prerequisites, installing external tools, verifying, scaffolding an engagement. Run `python onboard.py check` to verify. |

## The operating contract

Read [`OPERATING-CONTRACT.md`](OPERATING-CONTRACT.md) first — the rules every audit runs under
(build-always / run-gated authority, the seven stages, object-safety, record-everything, ask-don't-guess).

## Disciplines (the method spine)

| Skill | Load it when… |
|-------|---------------|
| ★ [finding-discipline](skills/finding-discipline/SKILL.md) | about to record, claim, rate the severity of, or report **any** finding — before marking anything `[CONFIRMED]`. This is the rating system. |
| ★ [scope-discipline](skills/scope-discipline/SKILL.md) | about to send a request to, scan, enumerate, or exploit any host/IP/URL — before the first packet. |
| [reporting-and-severity](skills/reporting-and-severity/SKILL.md) | writing the report, assigning CVSS, or **re-assessing** a finding after a fix or a second opinion (re-rating / REDO). |

### finding-discipline references
- [finding-evidence-standards](skills/finding-discipline/references/finding-evidence-standards.md) — the per-class proof bar (what counts as proof for SSRF, IDOR, RCE, XSS, …).
- [finding-validation-runtime](skills/finding-discipline/references/finding-validation-runtime.md) — the 7-question gate and the **PASS / KILL / DOWNGRADE** re-rating decision.

## Vulnerability-class skills (the playbooks)

| Skill | Load it when… |
|-------|---------------|
| [web-pentest](skills/web-pentest/SKILL.md) | pentesting a web app or API — injection, XSS/CSP, SSRF, desync, SSTI/deserialization, JWT/OAuth/GraphQL/IDOR, logic & race. |
| [recon-osint](skills/recon-osint/SKILL.md) | mapping external attack surface or gathering OSINT — subdomains, takeover, cloud/SaaS recon, breach intel, CVE prioritization. |
| [vulnerability-analysis](skills/vulnerability-analysis/SKILL.md) | auditing source code — taint source-to-sink across injection, memory safety, deserialization/prototype-pollution, secrets/crypto/authz/race, supply chain. |
| [owasp-security](skills/owasp-security/SKILL.md) | reviewing code for vulns or building authn/authz — OWASP Top 10, ASVS, LLM & agentic AI security. |
| [cloud-security](skills/cloud-security/SKILL.md) | attacking AWS/Azure/GCP — IAM/identity privesc, IMDS/metadata SSRF, Entra device-code/PRT, GCP impersonation, IaC/CI-CD federation. |
| [container-k8s-escape](skills/container-k8s-escape/SKILL.md) | breaking out of a container or escalating inside Kubernetes — runtime CVEs, privileged/capability misconfig, RBAC abuse, node pivot. |

## The pipeline (how findings get judged before they ship)

| Doc | What it is |
|-----|-----------|
| [PIPELINE.md](pipeline/PIPELINE.md) | the seven-stage state machine: author → validate → gate → run+log → analyze → adjudicate → report. |
| [METHOD-RATIONALE.md](pipeline/METHOD-RATIONALE.md) | why the pipeline is shaped this way — the two-judge design and why independence is non-negotiable. |
| [SUBAGENT-CHARTER.md](pipeline/SUBAGENT-CHARTER.md) | the rules every independent reviewer runs under (no prior knowledge, no favoritism, read only the handoff). |
| [SWEEP-PROTOCOL.md](pipeline/SWEEP-PROTOCOL.md) | how to cover a large surface completely without silent gaps (coverage ledger). |
| [rubrics/](pipeline/rubrics/) | the 1–5 security-focus rubric (4.5 gate) and the finding-adjudication rubric. |
| [agents/](pipeline/agents/) | role cards for the four independent reviewer roles. |
| [schemas/](pipeline/schemas/) | JSON schemas for each reviewer's structured verdict. |
| [templates/](pipeline/templates/) | the test template and the evidence template. |
| [lib/](pipeline/lib/) | reference implementation — logging harness, handoff isolation, coverage verifier. |
