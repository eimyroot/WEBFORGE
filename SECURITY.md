# Security Policy

## Reporting

Do not disclose vulnerabilities through public issues. Report them privately to the repository owner with the affected component, reproduction steps, expected impact, and a minimal proof where appropriate. Do not include third-party secrets or sensitive production data.

## Security expectations

- secrets and browser credentials must not be committed;
- untrusted briefs, generated code, URLs, and browser content must be validated at trust boundaries;
- browser automation must avoid unintended external writes;
- generated output must not silently gain authority over source inputs;
- dependencies and browser tooling should be updated deliberately and reviewed for impact;
- security-sensitive changes should include tests where practical.

The latest default-branch state is the maintained development version unless a release says otherwise.
