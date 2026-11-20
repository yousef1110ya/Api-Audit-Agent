# Omitted tooling — cloud-security

This skill's **methodology ships here**; its runnable attack scripts were intentionally left out of this
shareable kit — several are notably weaponized (credential harvesting, device-code phishing). The command
examples in `SKILL.md` and the `references/` docs that invoke `scripts/*.py` refer to this omitted custom
tooling — they document *what the tool does and how it is driven*, so an operator can rebuild equivalent
tooling under proper authorization. Public tooling in the same examples (awscli, az, gcloud, Pacu,
ScoutSuite, etc.) is standard and not included here.

The finding-validation / evidence tooling that the **method itself** depends on DOES ship, under
`skills/finding-discipline/scripts/`.

| Script (omitted) | What it did |
|------------------|-------------|
| aws_privesc_enum.py | Enumerate an AWS principal's effective permissions and score privesc paths. |
| entra_device_code_phish.py | Drive a Microsoft Entra ID OAuth device-code flow to obtain tokens. |
| gcp_impersonation_mapper.py | Build the GCP service-account impersonation graph for a project. |
| imds_harvester.py | Harvest cloud instance-metadata credentials from AWS / Azure / GCP. |
| k8s_can_i_abuse.py | Map the abuse primitives available to the current Kubernetes identity. |
| oidc_trust_auditor.py | Audit AWS IAM role trust policies for federation / cross-account abuse. |
