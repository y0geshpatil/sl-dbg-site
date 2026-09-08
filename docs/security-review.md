# Reviewing releases

The [source repository](https://github.com/y0geshpatil/sl-dbg) is public under Apache-2.0. Review the code and release process rather than treating this page as a security certification.

## Reviewable artifacts

| Artifact | Where |
|---|---|
| Release archives and SHA-256 manifest | [Releases](https://github.com/y0geshpatil/sl-dbg/releases) |
| Canonical installer and uninstaller | [install.sh](https://github.com/y0geshpatil/sl-dbg/blob/main/scripts/install.sh) and [uninstall.sh](https://github.com/y0geshpatil/sl-dbg/blob/main/scripts/uninstall.sh) |
| Legacy website forwarding wrappers | [install.sh](../install.sh) and [uninstall.sh](../uninstall.sh) |
| MCP tool surface | [MCP reference](mcp.md) |
| Threat model and limitations | [Security](security.md) |
| Proposed configuration-file design (not implemented) | [Configuration](configuration.md) |
| Architecture and design notes | [Design](design.md) |

## Verify the downloaded archive

Use the checksum manifest from the **same release** as the downloaded archive. Compare the archive's SHA-256 before extracting or installing; see [manual installation](getting-started.md#manual-download). A missing checksum or mismatch is a failure, not a reason to skip verification.

These checksums are not signatures. They verify consistency with the release manifest, not an independent chain of trust.

## Local builds

The release settings live in the core repository's `.goreleaser.yaml` and release workflow. Build from a reviewed tag using its documented toolchain and flags.

An arbitrary `go build` is **not guaranteed byte-identical** to a release build: toolchain, flags, build metadata, and archive packaging can differ. The published manifest hashes release assets, not a bare executable extracted from an archive.

## Reporting vulnerabilities

Follow the current private disclosure instructions in the repository's [SECURITY.md](https://github.com/y0geshpatil/sl-dbg/blob/main/SECURITY.md). Do not post exploit details, secrets, or sensitive debugger logs in a public issue. This website does not establish a separate reporting address or response-time guarantee.
