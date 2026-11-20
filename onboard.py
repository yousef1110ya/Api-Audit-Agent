#!/usr/bin/env python3
"""onboard.py - set up a machine to run the Security Testing Method kit.

Pure stdlib, cross-platform (Windows / macOS / Linux). It never installs anything without being asked.

Commands:
  python onboard.py check                 # (default) doctor: prereqs + tool matrix + self-test the rating gate
  python onboard.py selftest              # just prove the rating/validation tooling runs
  python onboard.py tools [--skill NAME]  # print per-OS install commands for the external tools the skills use
  python onboard.py install [--yes]       # create ./.venv and pip-install tooling/requirements.txt (best-effort)
  python onboard.py scaffold <dir>        # create an engagement workspace (scope.json, runs/, evidence/, findings/)

Exit codes:  0 = ok / all green   1 = something required is missing or a step failed
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

KIT_ROOT = Path(__file__).resolve().parent
IS_WIN = os.name == "nt"
OSID = "windows" if IS_WIN else ("macos" if platform.system() == "Darwin" else "linux")

# ---- tiny output helpers (ASCII, so every terminal renders them) -----------
OK, NO, WARN, DOT = "[ OK ]", "[MISS]", "[WARN]", "  -  "


def hdr(t: str) -> None:
    print("\n" + t + "\n" + "=" * len(t))


def line(mark: str, name: str, note: str = "") -> None:
    print(f" {mark}  {name:<22} {note}")


# ---- the external tool catalog (public tools the skills reference) ---------
# Each: key -> (which-binary, one-line purpose, {os: install-command})
TOOLS = {
    "recon-osint": {
        "subfinder": ("subfinder", "passive subdomain enumeration",
                      {"any": "go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"}),
        "httpx": ("httpx", "HTTP probing / fingerprinting",
                  {"any": "go install github.com/projectdiscovery/httpx/cmd/httpx@latest"}),
        "dnsx": ("dnsx", "fast DNS resolution / bruteforce",
                 {"any": "go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest"}),
        "naabu": ("naabu", "fast port scanner",
                  {"any": "go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest"}),
        "katana": ("katana", "crawling / JS endpoint discovery",
                   {"any": "go install github.com/projectdiscovery/katana/cmd/katana@latest"}),
        "nuclei": ("nuclei", "templated vuln/exposure scanning",
                   {"any": "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"}),
        "amass": ("amass", "deep attack-surface mapping",
                  {"any": "go install github.com/owasp-amass/amass/v4/...@master",
                   "macos": "brew install amass"}),
    },
    "web-pentest": {
        "ffuf": ("ffuf", "content/parameter fuzzing",
                 {"any": "go install github.com/ffuf/ffuf/v2@latest", "macos": "brew install ffuf"}),
        "sqlmap": ("sqlmap", "automated SQL injection",
                   {"any": "pipx install sqlmap", "macos": "brew install sqlmap",
                    "linux": "sudo apt-get install -y sqlmap"}),
        "dalfox": ("dalfox", "XSS scanning / parameter analysis",
                   {"any": "go install github.com/hahwul/dalfox/v2@latest", "macos": "brew install dalfox"}),
        "jwt_tool": ("jwt_tool", "JWT analysis / attack",
                     {"any": "pipx install jwt-tool  (or: git clone https://github.com/ticarpi/jwt_tool)"}),
    },
    "vulnerability-analysis": {
        "semgrep": ("semgrep", "multi-language static taint analysis", {"any": "pipx install semgrep"}),
        "codeql": ("codeql", "deep dataflow queries",
                   {"any": "download the CodeQL CLI bundle: https://github.com/github/codeql-cli-binaries/releases"}),
        "joern": ("joern", "code-property-graph taint queries",
                  {"any": "curl -L https://github.com/joernio/joern/releases/latest/download/joern-install.sh | sh"}),
        "pip-audit": ("pip-audit", "Python dependency CVE audit", {"any": "pipx install pip-audit"}),
    },
    "cloud-security": {
        "aws": ("aws", "AWS CLI (identity/IAM/STS)",
                {"any": "pipx install awscli", "macos": "brew install awscli",
                 "windows": "winget install -e --id Amazon.AWSCLI"}),
        "az": ("az", "Azure CLI (Entra/ARM)",
               {"macos": "brew install azure-cli", "linux": "curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash",
                "windows": "winget install -e --id Microsoft.AzureCLI"}),
        "gcloud": ("gcloud", "Google Cloud SDK",
                   {"any": "https://cloud.google.com/sdk/docs/install", "macos": "brew install --cask google-cloud-sdk"}),
        "scout": ("scout", "ScoutSuite multi-cloud posture", {"any": "pipx install scoutsuite"}),
    },
    "container-k8s-escape": {
        "kubectl": ("kubectl", "Kubernetes CLI",
                    {"macos": "brew install kubectl", "linux": "sudo apt-get install -y kubectl",
                     "windows": "winget install -e --id Kubernetes.kubectl"}),
        "kube-hunter": ("kube-hunter", "K8s weakness hunting", {"any": "pipx install kube-hunter"}),
        "trivy": ("trivy", "image / IaC / secret scanning",
                  {"macos": "brew install trivy", "linux": "sudo apt-get install -y trivy",
                   "windows": "winget install -e --id AquaSecurity.Trivy"}),
    },
}


def _install_cmd(osmap: dict) -> str:
    return osmap.get(OSID) or osmap.get("any") or next(iter(osmap.values()))


# ---- prerequisite checks ---------------------------------------------------
def check_python() -> bool:
    v = sys.version_info
    good = (v.major, v.minor) >= (3, 8)
    line(OK if good else NO, "Python",
         f"{v.major}.{v.minor}.{v.micro} ({'ok, >=3.8 required' if good else 'need >= 3.8'})")
    return good


def check_optional(binary: str, label: str, why: str) -> bool:
    present = shutil.which(binary) is not None
    line(OK if present else WARN, label, (why if present else f"optional - {why}"))
    return present


def selftest_rating_gate() -> bool:
    """Prove the rating/validation tooling runs: a real SSRF confirms, a self-IDOR is rejected."""
    validator = KIT_ROOT / "skills" / "finding-discipline" / "scripts" / "validate_findings.py"
    if not validator.is_file():
        line(NO, "rating gate", f"missing: {validator}")
        return False
    with tempfile.TemporaryDirectory() as td:
        ev = Path(td) / "e.txt"
        ev.write_text("169.254.169.254 internal response body: {token: ...}\n", encoding="utf-8")
        findings = [
            {"id": "F1", "title": "SSRF", "cwe": "CWE-918", "severity": "High",
             "evidence": ["e.txt"], "proof": {"internal_response_read": True}},
            {"id": "F2", "title": "Self IDOR", "cwe": "CWE-639", "severity": "High",
             "evidence": ["e.txt"], "proof": {"self_idor": True}},
        ]
        fp = Path(td) / "f.json"
        fp.write_text(json.dumps(findings), encoding="utf-8")
        try:
            out = subprocess.run([sys.executable, str(validator), "--findings", str(fp),
                                  "--evidence", td, "--json"],
                                 capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.SubprocessError) as exc:
            line(NO, "rating gate", f"failed to run: {exc}")
            return False
    try:
        verdicts = {v["id"]: v["tier"] for v in json.loads(out.stdout)}
    except (ValueError, KeyError):
        line(NO, "rating gate", "ran but produced unexpected output")
        return False
    ok = verdicts.get("F1") == "CONFIRMED" and verdicts.get("F2") == "REJECTED"
    line(OK if ok else NO, "rating gate",
         "CONFIRMED a proven SSRF, REJECTED a self-IDOR" if ok else f"unexpected verdicts: {verdicts}")
    return ok


# ---- commands --------------------------------------------------------------
def cmd_check(_args) -> int:
    print("Security Testing Method - onboarding check")
    print(f"kit: {KIT_ROOT}")
    print(f"os:  {platform.platform()}")

    hdr("Required")
    py_ok = check_python()
    gate_ok = selftest_rating_gate()

    hdr("Optional runtimes")
    check_optional("node", "Node.js", "runs the reference logging harness in pipeline/lib")
    has_go = check_optional("go", "Go", "installs the projectdiscovery/ffuf/dalfox tools")
    check_optional("pipx", "pipx", "clean installs of python CLI tools")
    check_optional("git", "git", "cloning tools + version control")

    hdr("External security tools (by skill)")
    present = missing = 0
    for skill, tools in TOOLS.items():
        print(f"\n  {skill}")
        for key, (binary, why, _osmap) in tools.items():
            if shutil.which(binary):
                line(OK, key, why); present += 1
            else:
                line(DOT, key, f"not installed - {why}"); missing += 1

    hdr("Summary")
    print(f"  external tools present: {present}   missing: {missing}")
    print("  run 'python onboard.py tools' for install commands for the missing ones.")
    if missing and not has_go:
        print("  tip: install Go first - most recon/web tools install via 'go install'.")
    print("  run 'python onboard.py scaffold <dir>' to start an engagement workspace.")

    required_ok = py_ok and gate_ok
    print("\n" + ("ALL REQUIRED CHECKS PASSED - the kit runs on this machine."
                  if required_ok else "REQUIRED CHECK FAILED - fix the [MISS] items above."))
    return 0 if required_ok else 1


def cmd_selftest(_args) -> int:
    hdr("Rating-gate self-test")
    return 0 if selftest_rating_gate() else 1


def cmd_tools(args) -> int:
    skills = [args.skill] if args.skill else list(TOOLS)
    for skill in skills:
        if skill not in TOOLS:
            print(f"unknown skill '{skill}'. known: {', '.join(TOOLS)}")
            return 1
        hdr(skill)
        for key, (binary, why, osmap) in TOOLS[skill].items():
            have = "installed" if shutil.which(binary) else "MISSING"
            print(f"  {key}  ({have}) - {why}")
            print(f"      {_install_cmd(osmap)}")
    print("\nNote: Go tools need Go on PATH; pipx gives isolated python CLIs. "
          "The kit's own rating tooling needs none of these.")
    return 0


def cmd_install(args) -> int:
    req = KIT_ROOT / "tooling" / "requirements.txt"
    if not req.is_file():
        print(f"missing {req}")
        return 1
    venv = KIT_ROOT / ".venv"
    if not args.yes:
        print(f"This will create {venv} and pip-install {req} into it.")
        print("Re-run with --yes to proceed. (Go/system tools are not touched - see 'onboard.py tools'.)")
        return 0
    hdr("Creating virtual environment")
    try:
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    except subprocess.SubprocessError as exc:
        print(f"venv creation failed: {exc}")
        return 1
    py = venv / ("Scripts" if IS_WIN else "bin") / ("python.exe" if IS_WIN else "python")
    hdr("Installing python security tooling (best-effort)")
    subprocess.run([str(py), "-m", "pip", "install", "--upgrade", "pip"], check=False)
    rc = subprocess.run([str(py), "-m", "pip", "install", "-r", str(req)], check=False).returncode
    activate = (venv / "Scripts" / "activate") if IS_WIN else (venv / "bin" / "activate")
    print(f"\nDone (pip exit {rc}). Activate with:  "
          + (f"{activate}" if IS_WIN else f"source {activate}"))
    print("For Go/system tools (nuclei, httpx, sqlmap, kubectl, ...): python onboard.py tools")
    return 0 if rc == 0 else 1


def cmd_scaffold(args) -> int:
    dest = Path(args.dir).resolve()
    if dest.exists() and any(dest.iterdir()):
        print(f"refusing to scaffold into non-empty dir: {dest}")
        return 1
    for sub in ("runs", "evidence", "findings", "tests"):
        (dest / sub).mkdir(parents=True, exist_ok=True)
    scope = {
        "engagement": dest.name,
        "authorized_window": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
        "in_scope": {"hosts": ["app.example.com"], "cidrs": [], "url_prefixes": ["https://app.example.com/"]},
        "out_of_scope": {"hosts": ["*.partner.example.com"]},
        "rules": {"mutating_verbs_need_approval": True, "no_production": True, "no_third_party": True},
    }
    (dest / "scope.json").write_text(json.dumps(scope, indent=2) + "\n", encoding="utf-8")
    app_cfg = {"app": dest.name, "envFile": "env/dev.env", "runsDir": "runs",
               "requireMarker": "AUTHORIZED"}
    (dest / "pipeline.app.json").write_text(json.dumps(app_cfg, indent=2) + "\n", encoding="utf-8")
    (dest / "env").mkdir(exist_ok=True)
    (dest / "env" / "dev.env").write_text(
        "# Fill in ONLY when authorized. Absent marker => planning-only (no live traffic).\n"
        "# AUTHORIZED=1\n# BASE_URL=https://app.example.com\n# TOKEN=\n", encoding="utf-8")
    (dest / "README.md").write_text(
        f"# {dest.name} - engagement workspace\n\n"
        "Scaffolded by the Security Testing Method kit.\n\n"
        "1. Edit `scope.json` with your signed authorization boundary.\n"
        "2. Fill `env/dev.env` ONLY when the engagement is live (set the `AUTHORIZED` marker).\n"
        "3. Author tests under `tests/`, run the pipeline, keep evidence in `evidence/`, "
        "file findings in `findings/`.\n\n"
        "Load the kit's `INDEX.md` and work the loop in `pipeline/PIPELINE.md`.\n", encoding="utf-8")
    print(f"scaffolded engagement workspace at: {dest}")
    for p in ("scope.json", "pipeline.app.json", "env/dev.env", "runs/", "evidence/", "findings/", "tests/"):
        print(f"  + {p}")
    print("\nNext: edit scope.json, then load INDEX.md and begin stage 1 (author tests).")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Onboarding for the Security Testing Method kit.")
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("check", help="doctor: prereqs + tool matrix + self-test (default)")
    sub.add_parser("selftest", help="self-test the rating/validation tooling")
    pt = sub.add_parser("tools", help="print install commands for external tools")
    pt.add_argument("--skill", help="limit to one skill")
    pi = sub.add_parser("install", help="pip-install tooling/requirements.txt into ./.venv")
    pi.add_argument("--yes", action="store_true", help="actually do it")
    ps = sub.add_parser("scaffold", help="create an engagement workspace")
    ps.add_argument("dir", help="target directory")
    args = p.parse_args(argv)

    return {
        None: cmd_check, "check": cmd_check, "selftest": cmd_selftest,
        "tools": cmd_tools, "install": cmd_install, "scaffold": cmd_scaffold,
    }[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
