# Omitted tooling — container-k8s-escape

This skill's **methodology ships here**; its runnable escape/exploit scripts were intentionally left out
of this shareable kit — these are weaponized container-breakout PoCs. The command examples in `SKILL.md`
and the `references/` docs that invoke `scripts/*` refer to this omitted custom tooling — they document
*what the tool does and how it is driven*, so an operator can rebuild equivalent tooling under proper
authorization. Public tooling in the same examples (kubectl, kube-hunter, deepce, etc.) is standard and
not included here.

The finding-validation / evidence tooling that the **method itself** depends on DOES ship, under
`skills/finding-discipline/scripts/`.

| Script (omitted) | What it did |
|------------------|-------------|
| escape_enum.sh | In-container / post-escape enumeration for breakout opportunities. |
| k8s_rbac_audit.py | Audit Kubernetes RBAC for privilege-escalation and escape primitives. |
| kubelet_exec.py | Execute commands in pods via the kubelet API / nodes-proxy path. |
| nvidiascape_build.sh | CVE-2025-23266 ("NVIDIAScape") PoC builder — NVIDIA Container Toolkit escape. |
| release_agent_escape.sh | Privileged-container escape via cgroup-v1 release_agent / core_pattern. |
| runc_cwd_escape.py | CVE-2024-21626 ("Leaky Vessels") working-directory fd-leak escape helper. |
