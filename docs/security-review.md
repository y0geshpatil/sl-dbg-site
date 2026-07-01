# Security review

`sl-dbg` is fully open source under Apache-2.0. There is no
private-source / NDA gate anymore — audit, fork, patch, or fuzz at will.

## What you have

| Artifact | Where |
|---|---|
| **Source repository** | [github.com/y0geshpatil/sl-dbg](https://github.com/y0geshpatil/sl-dbg) |
| **Release binaries** | [github.com/y0geshpatil/sl-dbg/releases](https://github.com/y0geshpatil/sl-dbg/releases) |
| **Per-release SHA-256 checksums** | `sl-dbg_<version>_checksums.txt` on each release |
| **Install scripts** | [install.sh](../install.sh) · [uninstall.sh](../uninstall.sh) |
| **MCP tool surface** | [mcp.md](mcp.md) — auto-generated from a live binary |
| **Threat model** | [security.md](security.md) — what the daemon trusts, what it doesn't, every policy check |
| **Configuration & env vars** | [configuration.md](configuration.md) |
| **Architecture** | [design.md](design.md) |

## Reporting vulnerabilities

**Do not open a public issue for security bugs.** Instead:

1. Follow the private disclosure process documented in
   [SECURITY.md](https://github.com/y0geshpatil/sl-dbg/blob/main/SECURITY.md)
   at the repository root, or
2. Email **security@sl-dbg.dev** with a proof-of-concept and the exact
   `sl-dbg version` output.

We will acknowledge within 72 hours and coordinate a fix + release
before any public disclosure.

## Reproducible builds

The release binary is byte-identical to what you'd get from `go build`
on the tagged source, with `-s -w` ldflags to strip symbols. To verify:

```bash
git clone --branch v<version> https://github.com/y0geshpatil/sl-dbg
cd sl-dbg
go build -ldflags="-s -w" -o sl-dbg ./cmd/sl-dbg
shasum -a 256 sl-dbg   # compare against the checksums file
```

## Contributing security-relevant patches

Small hardening PRs are welcome — see
[CONTRIBUTING.md](https://github.com/y0geshpatil/sl-dbg/blob/main/CONTRIBUTING.md).
For anything that touches the MCP surface, the source jail, or eval
gating, please open an issue first so we can coordinate the tests and
the release note.
