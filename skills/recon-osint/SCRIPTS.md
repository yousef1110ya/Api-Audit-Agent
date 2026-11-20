# Omitted tooling — recon-osint

This skill's **methodology ships here**; its runnable recon/OSINT scripts were intentionally left out of
this shareable kit. The command examples in `SKILL.md` and the `references/` docs that invoke
`scripts/*.py` refer to this omitted custom tooling — they document *what the tool does and how it is
driven*, so an operator can rebuild equivalent tooling under proper authorization. Public tools in the
same examples (subfinder, httpx, katana, dnsx, nuclei, amass, etc.) are standard and not included here.

The finding-validation / evidence tooling that the **method itself** depends on DOES ship, under
`skills/finding-discipline/scripts/`.

| Script (omitted) | What it did |
|------------------|-------------|
| breach_intel.py | Identity harvesting + breach/infostealer credential correlation. |
| cloud_asset_enum.py | Combined cloud + SaaS + source-code asset recon. |
| cve_prioritizer.py | Enrich + rank CVEs by KEV × EPSS × exposure × CVSS. |
| hackerone_public_recon.py | Pull a PUBLIC bug-bounty program's scope/policy as recon input. |
| js_secret_hunter.py | Download JS bundles, extract endpoints, mine for hardcoded secrets. |
| recon_orchestrator.py | End-to-end external recon pipeline for a root domain. |
| subdomain_takeover.py | Dangling-DNS / subdomain-takeover detector. |
| wordlist_ranker.py | Tier a candidate wordlist by real-world frequency. |
