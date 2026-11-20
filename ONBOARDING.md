# Onboarding — get this kit running

This guide takes a fresh machine to "the kit runs and I can start an engagement." It works on
**Windows, macOS, and Linux**. The fastest path is the one bootstrapper script; the rest of this file
explains what it checks and how to install the external tools the skills reference.

> **The single most important fact:** the kit's *own* tooling — the rating/validation engine in
> `skills/finding-discipline/scripts/` — is **pure Python standard library**. If you have Python 3.8+,
> the core method already runs. Everything else on this page is about the *external* security tools that
> let you carry out the full methodology (recon, scanning, code audit, cloud, k8s).

---

## 0. TL;DR

```bash
# 1. verify the machine (prereqs + external-tool matrix + self-test the rating gate)
python onboard.py check

# 2. see how to install whatever came up missing
python onboard.py tools

# 3. (optional) install the pip-based security tools into a local .venv
python onboard.py install --yes

# 4. start an engagement workspace (creates scope.json, runs/, evidence/, findings/, tests/)
python onboard.py scaffold ./my-engagement
```

On Windows use `python`; on macOS/Linux you may need `python3`.

---

## 1. Prerequisites

| Need | Required? | Why | Get it |
|------|-----------|-----|--------|
| **Python 3.8+** | **Yes** | runs the rating/validation tooling — the heart of the method | python.org, or your package manager |
| **Node.js 18+** | Optional | runs the *reference* logging harness in `pipeline/lib` (you can port it to any stack instead) | nodejs.org |
| **Go 1.21+** | Recommended | most recon/web tools (projectdiscovery suite, ffuf, dalfox) install via `go install` | go.dev/dl |
| **pipx** | Recommended | clean, isolated installs of Python CLI tools (semgrep, sqlmap, scoutsuite, …) | `python -m pip install --user pipx` |
| **git** | Recommended | cloning tools; version-controlling your engagement | git-scm.com |

Run `python onboard.py check` — it reports exactly which of these you have, self-tests the rating gate,
and prints a per-skill matrix of which external tools are installed vs missing. A green
**"ALL REQUIRED CHECKS PASSED"** means the kit runs.

---

## 2. What `onboard.py` does

A pure-stdlib bootstrapper — no dependencies, safe to read before you run it. Commands:

- **`check`** (default) — the doctor. Verifies Python/Node/Go/pipx/git, scans your `PATH` for the
  external security tools grouped by skill, and **self-tests the rating gate** (it runs
  `validate_findings.py` on a built-in fixture and confirms a proven SSRF is `CONFIRMED` while a
  self-IDOR is `REJECTED`). Exit 0 = the kit works here.
- **`selftest`** — just the rating-gate self-test.
- **`tools [--skill NAME]`** — prints the correct install command **for your OS** for each external
  tool, and whether you already have it. Limit to one skill with `--skill web-pentest`.
- **`install [--yes]`** — creates `./.venv` and pip-installs `tooling/requirements.txt` (the
  pip-installable security tools) into it. Without `--yes` it only tells you what it would do. Go/system
  tools are never touched here — use `tools` for those.
- **`scaffold <dir>`** — creates a ready-to-use engagement workspace (see §4).

---

## 3. Installing the external security tools

The skills reference standard, public tools. You only need the ones for the work you're doing — install
on demand. `python onboard.py tools` prints these tailored to your OS; here's the shape:

**Go-based (recon + some web)** — install Go, then:
```bash
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install github.com/ffuf/ffuf/v2@latest
go install github.com/hahwul/dalfox/v2@latest
```
Make sure your Go bin dir is on `PATH` (`~/go/bin`, or `%USERPROFILE%\go\bin` on Windows).

**Python-based (code audit + cloud)** — via pipx (isolated) or the kit's venv:
```bash
pipx install semgrep pip-audit scoutsuite checkov bandit awscli
# or, into the kit's local venv, all at once:
python onboard.py install --yes
```

**Cloud / k8s CLIs** — use your platform package manager:
- Windows: `winget install -e --id Amazon.AWSCLI` · `winget install -e --id Microsoft.AzureCLI` · `winget install -e --id Kubernetes.kubectl`
- macOS: `brew install awscli azure-cli kubectl trivy`
- Linux: `apt-get install` / vendor scripts (see `onboard.py tools`)

**Heavier engines** — CodeQL (download the CLI bundle from GitHub) and Joern (`joern-install.sh`) are
larger; install them only when you're doing deep source audits.

> The command examples inside the skill docs sometimes invoke custom scripts (e.g.
> `python scripts/ssrf_toolkit.py …`). Those custom scripts are **not bundled** (this kit ships
> methodology, not weaponized tooling — see each skill's `SCRIPTS.md`). The commands document the
> intended behaviour so you can drive an equivalent tool or rebuild one under authorization.

---

## 4. Starting an engagement

```bash
python onboard.py scaffold ./my-engagement
```

creates:

```
my-engagement/
├─ scope.json          ← YOUR authorization boundary — edit this FIRST (hosts, window, exclusions)
├─ pipeline.app.json   ← per-target config: where env/runs live + the authorization marker
├─ env/dev.env         ← secrets/markers — fill ONLY when the engagement is live (no marker ⇒ planning-only)
├─ runs/               ← full request/response logs land here (the evidence base)
├─ evidence/           ← grounded artifacts findings point at
├─ findings/           ← confirmed findings + re-assessment (REDO) docs
├─ tests/              ← your runnable test modules (pipeline Stage 1)
└─ README.md
```

Then:

1. **Edit `scope.json`** to match your signed authorization — hosts, CIDRs, URL prefixes, exclusions,
   and the window. Nothing gets touched outside it (`skills/scope-discipline/`).
2. **Leave `env/dev.env` empty until the engagement is live.** With no authorization marker the harness
   stays in **planning-only** mode — you can build and validate tests, but it sends no traffic
   (fail-closed, `OPERATING-CONTRACT.md` §0).
3. **Load `INDEX.md`** and work the loop in `pipeline/PIPELINE.md`: author tests → validate to the 4.5
   gate → execute + log → analyze → adjudicate → report.

---

## 5. Verifying it all works

```bash
python onboard.py check          # should end with "ALL REQUIRED CHECKS PASSED"
python onboard.py selftest       # the rating gate: CONFIRMED a proven SSRF, REJECTED a self-IDOR
```

You can also run the rating tooling directly on your own findings:

```bash
python skills/finding-discipline/scripts/validate_findings.py \
    --findings your_findings.json --evidence ./evidence
```

If those pass, the method runs on your machine. Install external tools as the work demands them.

---

## 6. Troubleshooting

- **`python: command not found`** → try `python3`, or install Python 3.8+.
- **Go tools installed but "not installed" in `check`** → your Go bin dir isn't on `PATH`; add
  `~/go/bin` (or `%USERPROFILE%\go\bin`).
- **`pip install` fails for a tool on Windows** → prefer `pipx`, or install that tool via `winget`/the
  vendor binary instead; the kit doesn't depend on any single one.
- **The harness in `pipeline/lib` won't run** → it's a Node *reference* implementation; it's optional.
  Treat it as a spec and port the behaviour (per-target config, fail-closed auth gate, full req/resp
  logging, isolated handoffs) to whatever stack you actually test from.
- **Nothing to install for the core method** → correct. Python alone runs the rating/validation engine;
  external tools only extend reach.
