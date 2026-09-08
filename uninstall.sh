#!/usr/bin/env bash
# Legacy shim — the canonical uninstaller now lives in the source repo.
# Update your bookmarks to:
#   curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/uninstall.sh | bash
# This shim just forwards to it, preserving all arguments.
set -euo pipefail
script="$(mktemp)"
trap 'rm -f "$script"' EXIT
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/uninstall.sh -o "$script"
bash "$script" "$@"
