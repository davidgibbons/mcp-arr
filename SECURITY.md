# Security Policy

## Reporting a Vulnerability

Please report security issues privately, rather than opening a public issue.

Use GitHub's private vulnerability reporting:
[**Report a vulnerability**](https://github.com/davidgibbons/mcp-arr/security/advisories/new)
(also reachable from the repository's **Security** tab). Reports there are
visible only to the maintainers of this repository.

Include where you can:

- A description of the issue and its potential impact
- Steps to reproduce
- Affected version(s)
- Any suggested mitigation

You can expect an acknowledgement within 7 days, and we'll agree a coordinated
disclosure timeline with you before any public write-up.

This project is a fork of
[aplaceforallmystuff/mcp-arr](https://github.com/aplaceforallmystuff/mcp-arr).
If a report turns out to affect code shared with upstream, we'll coordinate
disclosure with that maintainer too — you only need to report it once, here.

## Supported Versions

This fork is distributed as a **container image only**; there is no npm package
for it. Security fixes land on the latest published image:

```
ghcr.io/davidgibbons/mcp-arr:latest
```

Only the most recent release is actively supported. Older tags are immutable
snapshots and do not receive backports.

## Deployment expectations

Some behaviour that might look like a vulnerability is a documented
configuration choice, so it helps to know what's intended:

- **The HTTP endpoint has no authentication unless you configure it.** It is
  meant to sit on a trusted network or behind an authenticating proxy. See the
  README for the available options; a default install being reachable without
  credentials is a deployment decision, not a bug report.
- **The server holds *arr API keys** and, in read-write mode, exposes tools that
  add media, trigger downloads, delete queue items and approve requests. Anyone
  who can reach the endpoint can use them. `MCP_ARR_ACCESS=read-only` narrows
  that surface.

A way to bypass a control that *is* configured — reaching a mutating tool while
read-only is set, say — is very much in scope.

## Scope

In scope:

- Bugs in this MCP server's code that lead to credential exposure, unauthorized
  access, privilege escalation, or remote code execution
- Bypasses of the access mode or any configured authentication
- Leakage of API keys into responses, logs, or error messages
- Vulnerabilities introduced by direct dependencies that affect this server's
  runtime

Out of scope:

- Vulnerabilities in the *arr applications this server wraps — please report
  those to the relevant upstream project
- The unauthenticated default HTTP endpoint, as described above
- Theoretical issues without a practical exploit path
