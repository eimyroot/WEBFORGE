# Threat model

Primary threats: untrusted registry code, dependency compromise, license incompatibility, prompt-driven unsafe tool selection, credential leakage, unsafe deployment, false PASS claims.

Controls: explicit trust state, deterministic hard gates, zero automatic external execution, adapter verification contracts, evidence receipts, no UNKNOWN/MISSING/UNVERIFIED as PASS, dependency-light core.
