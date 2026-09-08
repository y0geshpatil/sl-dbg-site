# Install sl-dbg and debug your first program

Start with the CLI and one language adapter. You do not need an AI client to try the debugger. This walkthrough pauses a four-line Python program and inspects `total = 55`, then shows how to connect an MCP client.

These examples use [v0.5.5](https://github.com/y0geshpatil/sl-dbg/releases/tag/v0.5.5), which includes the platform binaries, Java adapter JAR, and their checksums.

## Before you start

- Use **macOS or Linux**, on **amd64/x86_64 or arm64/aarch64**. Windows is not supported. A container may need debugging permissions beyond those needed to run the CLI.
- The installer needs **Bash, curl, tar**, standard Unix tools, and **sha256sum or shasum**. It downloads from GitHub over HTTPS. No GitHub account or Go compiler is needed for the prebuilt CLI.
- Debugging also needs the language runtime and adapter: **Python + debugpy**, **Go + Delve**, or **JDK 11+ + the Java adapter JAR**. The CLI binary does not bundle these runtimes.
- For the Python walkthrough, install a currently maintained Python 3 with **pip and venv** support. Some Linux distributions package `python3-venv` separately.
- Only debug code and processes you trust. A debugger can execute code and inspect sensitive data; its policy controls are not an OS sandbox.

Check [platform notes](platforms.md) and [language adapters](adapters.md) for details. Homebrew distribution is not currently enabled.

## Install the CLI

The canonical installer is in the debugger repository, not a separate website implementation:

```bash
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/install.sh | bash
```

It selects the latest stable release for your OS and architecture, verifies the release SHA-256 checksum, and installs to **`$HOME/.local/bin`**. It creates that directory if needed. It does not use sudo, edit shell startup files, install adapters, register MCP clients, or stop your running daemon.

### Download and review before running

Piping a script to Bash executes remote code. For an inspectable download that also keeps download failures separate from script execution:

```bash
setup_dir="$(mktemp -d)"
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/install.sh \
  -o "$setup_dir/install.sh"
```

Read the downloaded file in your editor. After reviewing it:

```bash
bash "$setup_dir/install.sh"
```

Do not continue if the download fails. The script on `main` can change independently of a binary release. To pin the script as well, download it from a reviewed immutable core commit instead of `main`.

### Make sl-dbg discoverable

In Bash or zsh:

```bash
export PATH="$HOME/.local/bin:$PATH"
command -v sl-dbg
sl-dbg version
```

The first command changes only the current shell. Add the same export line once to `~/.zshrc` for zsh, or `~/.bashrc` for interactive Bash. For a Bash login shell, ensure your `~/.bash_profile` sources `~/.bashrc`, or put the export in the startup file that shell actually reads. Open a fresh terminal and repeat `command -v sl-dbg`.

For fish, use `fish_add_path "$HOME/.local/bin"`; the remaining walkthrough uses Bash/zsh syntax.

`command -v sl-dbg` should name the new binary, and `sl-dbg version` should report the installed version. The installer does not make changes to an already-open desktop app's environment.

**Upgrading from an older system-wide install?** Check `type -a sl-dbg`. A copy in `/usr/local/bin`, a shell alias, or a cached command path can hide the new one. Prepend the new directory to PATH and reopen the shell (or run `hash -r` in Bash / `rehash` in zsh). Do not delete an old installation until you know who manages it.

### Choose a version or directory

Use a tag from [Releases](https://github.com/y0geshpatil/sl-dbg/releases). For example:

```bash
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/install.sh \
  | bash -s -- v0.5.5
```

That pins the **binary**, not the installer script or adapters. It is an example of an existing tag, not a promise that it is the newest release.

To choose a destination, pass the environment variable to **Bash, not curl**:

```bash
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/install.sh \
  | INSTALL_DIR="$HOME/bin" bash
export PATH="$HOME/bin:$PATH"
```

Use an absolute directory you own. A permission error is a reason to choose a user-owned directory, not to run the whole installer as root. Remember this directory for upgrades and uninstall.

### Manual download

Download the archive for your platform and its matching `sl-dbg_<version>_checksums.txt` from the same release. `uname -s` and `uname -m` identify your OS/architecture. `Darwin` maps to `darwin`; `x86_64` maps to `amd64`; `aarch64` maps to `arm64`.

For example, **v0.5.5 on Apple silicon macOS only**, download [the archive](https://github.com/y0geshpatil/sl-dbg/releases/download/v0.5.5/sl-dbg_0.5.5_darwin_arm64.tar.gz) and [checksum manifest](https://github.com/y0geshpatil/sl-dbg/releases/download/v0.5.5/sl-dbg_0.5.5_checksums.txt) into an otherwise empty directory:

```bash
shasum -a 256 sl-dbg_0.5.5_darwin_arm64.tar.gz
grep '  sl-dbg_0.5.5_darwin_arm64.tar.gz$' sl-dbg_0.5.5_checksums.txt
```

Compare the two hashes exactly. On Linux, use `sha256sum` instead of `shasum -a 256`. **Do not extract or install if they differ, the checksum entry is missing, or either command fails.** After a match:

```bash
tar -xzf sl-dbg_0.5.5_darwin_arm64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 0755 sl-dbg "$HOME/.local/bin/sl-dbg"
export PATH="$HOME/.local/bin:$PATH"
sl-dbg version
```

Do not use that archive on Intel macOS or Linux. Checksums detect a changed download; they are not signatures and do not independently establish who produced it.

## First debug session

Use a fresh scratch directory so the example does not overwrite project files. A virtual environment keeps debugpy out of your system Python and works with externally managed Python installations:

```bash
demo_dir="$(mktemp -d)"
cd "$demo_dir"
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install debugpy
printf '%s\n' 'prices = [10, 20, 30]' 'discount = 5' \
  'total = sum(prices) - discount' 'print(total)' > sl-dbg-demo.py
```

The file now contains:

```python
prices = [10, 20, 30]
discount = 5
total = sum(prices) - discount
print(total)
```

Keep the environment active. Check `python3 -c "import debugpy; print(debugpy.__version__)"` and `sl-dbg adapters`.

**If you already have a daemon running:** it may have inherited a different Python/PATH. Check `sl-dbg sessions`, finish those sessions, close MCP clients, and only then run `sl-dbg daemon stop`. Stopping the daemon affects **all** of its sessions. The next debugger command starts it again with the active shell's environment.

Run these commands one at a time, checking each result:

```bash
sl-dbg start --lang python --program ./sl-dbg-demo.py --stop-on-entry
sl-dbg break sl-dbg-demo.py:4
sl-dbg continue
sl-dbg locals
```

`start` should pause at entry. `continue` should then pause at line 4, before `print(total)`. In the locals, look for **`prices = [10, 20, 30]`, `discount = 5`, and `total = 55`**. This is the useful debugging loop: pause at a known location, then inspect actual program state.

Commands target the default session, normally the newest one. If you have multiple sessions, use the returned ID with `--session <id>`. Add `--json` when scripting; terminal output may be formatted for humans.

Finish the tutorial session:

```bash
sl-dbg stop
```

After you are done using this Python environment, run `deactivate`. The scratch directory remains until you remove it or the OS cleans temporary files; it contains only this tutorial and its virtual environment. No `eval` is needed for this example.

## Install other adapters

```bash
sl-dbg install-adapter python
sl-dbg install-adapter go
sl-dbg install-adapter java
sl-dbg adapters
```

Choose only the language you need; these are alternatives, not a required sequence. `install-adapter all` attempts every language and can fail when any prerequisite is missing.

For Python, the explicit virtual-environment setup above is also an adapter installation method. If an older `install-adapter python` fails with a `--user` or externally-managed-environment error, use the venv approach rather than sudo pip or `--break-system-packages`.

For Go, ensure the selected Go toolchain can build the current Delve release. `go install` writes to `GOBIN` if set, otherwise the first `GOPATH` entry's `bin` directory (commonly `~/go/bin`). Put that directory on PATH **before** starting the daemon or your MCP client.

### Java release installation

With v0.5.5 installed and **JDK 11+** on PATH:

```bash
java -version
sl-dbg install-adapter java
sl-dbg adapters
```

The installer downloads [sl-dbg-java-adapter.jar](https://github.com/y0geshpatil/sl-dbg/releases/download/v0.5.5/sl-dbg-java-adapter.jar) and [sl-dbg-java-adapter.jar.sha256](https://github.com/y0geshpatil/sl-dbg/releases/download/v0.5.5/sl-dbg-java-adapter.jar.sha256) from the **same v0.5.5 tag**. It checks the SHA-256 before replacing the cached JAR. Release installation needs no Maven or source checkout; do not bypass a missing or mismatched checksum.

Already have a Java adapter cached? Run `sl-dbg install-adapter java --force` after upgrading the CLI to refresh it from that version's release. A valid cached JAR is otherwise retained; it is not automatically version-matched. Remove an old `SL_DBG_JAVA_DEBUG_JAR` override if you intend to use the downloaded adapter instead. Finish active sessions before restarting the daemon with the changed adapter.

**Breakpoint display limitation:** Java breakpoints initially waiting for a class to load can still display `pending` after asynchronous binding. This is distinct from the line-resume and immediate function-verification bugs fixed in v0.5.5. Check actual stops and locations rather than treating a pending display as proof that the breakpoint cannot hit.

### Older v0.5.4 installations

The historical v0.5.4 release has no Java adapter JAR and predates the corrected VS Code/Copilot registration. New users do not need its source-build workaround: install v0.5.5, refresh any cached Java adapter, and preview updated client registration. A pinned v0.5.4 binary does not gain these fixes from an updated installer script.

## Connect an AI agent

Use v0.5.5 for the registration commands below. If upgrading from v0.5.4, preview the corrected client configuration before replacing an existing entry.

First complete a CLI session so you know the runtime and adapter work. Then preview registration for **one** client:

The program allowlist matches the **target program's path**, not the adapter interpreter. The default interpreter allowlist does not authorize an arbitrary Python script. For this example, run from the directory containing `sl-dbg-demo.py` (use `cd "$demo_dir"` in the walkthrough shell) and explicitly authorize only that file:

```bash
sl-dbg mcp install claude --allow-program "$PWD/sl-dbg-demo.py" --dry-run
```

Replace `claude` with `cursor`, `vscode`, `codex`, or `copilot`. `claude` means **Claude Desktop**, not Claude Code. For VS Code, run from the intended project root; its configuration is workspace-scoped. To print configuration without writing anything:

```bash
sl-dbg mcp install --print --allow-program "$PWD/sl-dbg-demo.py"
```

Once the preview is correct, register the chosen client:

```bash
sl-dbg mcp install claude --allow-program "$PWD/sl-dbg-demo.py"
```

Registration uses the executable's absolute path and `mcp --safe`, preserves unrelated servers, and backs up an existing configuration before writing. An existing sl-dbg entry requires an explicit `--force` to replace it; inspect the preview before using that flag. Avoid `all` until you understand which clients it will modify.

Restart the client or reload its MCP configuration, then confirm it shows sl-dbg tools. Registration success alone does not prove the client can launch the server or find the language adapter.

### VS Code and Copilot configuration

In v0.5.5, registration writes **`.vscode/mcp.json` with `servers`** for VS Code and **`~/.copilot/mcp-config.json` with `mcpServers`** for GitHub Copilot CLI. These are different schemas.

The registration command handles these formats. For manual configuration or migration, back up the existing file and merge only the sl-dbg entry; do not replace other servers or settings. Replace every absolute-path placeholder below with your real path from `command -v sl-dbg` and your project root.

VS Code, in the project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "sl-dbg": {
      "type": "stdio",
      "command": "/absolute/path/to/sl-dbg",
      "args": ["mcp", "--safe", "--allow-source-root", "/absolute/path/to/project",
               "--allow-program", "/absolute/path/to/project/sl-dbg-demo.py"]
    }
  }
}
```

GitHub Copilot CLI, in `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "sl-dbg": {
      "type": "local",
      "command": "/absolute/path/to/sl-dbg",
      "args": ["mcp", "--safe", "--allow-source-root", "/absolute/path/to/project",
               "--allow-program", "/absolute/path/to/project/sl-dbg-demo.py"],
      "tools": ["*"]
    }
  }
}
```

### Runtime PATH and source access

A desktop client may not inherit your terminal's activated venv or PATH. Ensure its MCP process can find the correct Python/Java/Delve. Use the client's supported environment configuration, with absolute paths, rather than assuming `~` or `$HOME` expands inside JSON.

Safe mode defaults source access to the MCP process's working directory. For a client launched outside your project, add an explicit `--allow-source-root` to the **registered server arguments**, keeping the absolute binary path printed by `--print`. For example:

```json
["mcp", "--safe", "--allow-source-root", "/absolute/path/to/project",
 "--allow-program", "/absolute/path/to/project/sl-dbg-demo.py"]
```

Replace the placeholders with your project and target file; the exact surrounding configuration differs between clients. Use exact target paths, or carefully reviewed and quoted target-path globs, for `--allow-program`. An interpreter-only entry such as `python3` does not authorize `/path/to/sl-dbg-demo.py`. Safe mode disables evaluation by default; do not enable it just to make a tutorial work. `--read-only` is for inspecting an existing session and hides mutating tools, including starting a new one.

The daemon retains its environment and policy across CLI and MCP invocations. After changing runtime paths or policy, finish active sessions, close clients, and intentionally restart the daemon before retrying. See the [MCP reference](mcp.md) and [security model](security.md) for the controls and their limits.

## Troubleshooting

| Symptom | Next action |
|---|---|
| `sl-dbg: command not found` | Run `"$HOME/.local/bin/sl-dbg" version` (or your chosen install path), then fix PATH. Reopen the terminal. |
| The version did not change | Use `type -a sl-dbg` to find older copies or aliases. Check the absolute installed binary, refresh shell command lookup, and restart the daemon only after finishing sessions. |
| Permission denied during install | Choose an absolute, user-owned `INSTALL_DIR` and pass it to Bash. Do not prefix the whole installer with sudo. |
| HTTP 403 / API rate limit | A pinned release avoids the `latest` API lookup. Check GitHub's status and your network/proxy before retrying. |
| HTTP 404 / no release / missing asset | Check that the exact tag and OS/architecture asset exist on Releases. Older v0.5.4 has no Java JAR; upgrade the CLI to v0.5.5 instead of bypassing verification. |
| Checksum download fails or hashes mismatch | Stop. Re-download the archive and checksum from the same release; do not bypass verification. |
| `externally-managed-environment`, pip `--user` failure, or debugpy missing | Use the venv walkthrough. Check which `python3` imports debugpy, and whether the daemon was started with that environment. |
| `python3 -m venv` fails | Install your distribution's venv/ensurepip support, then recreate the virtual environment. Do not install into system Python with sudo. |
| Adapter installed but not found | Compare the adapter's location with the daemon/MCP process PATH, not only your terminal's PATH. Restart intentionally after finishing sessions. |
| The program exits before inspection | Use `--stop-on-entry`; set the breakpoint on the supplied file's line 4 before continuing. Inspect locals only while paused. |
| `SESSION_NOT_FOUND` | Run `sl-dbg sessions`; use the correct `--session` ID, or start again if the daemon restarted. |
| MCP client shows no tools | Restart/reload the client; inspect its MCP stderr/logs, binary path, registration schema, and runtime PATH. Use `--print` from your installed version for its configuration. |
| `SOURCE_PATH_DENIED` / `PROGRAM_NOT_ALLOWED` / `EVAL_DISABLED` | Review the intended source roots, program allowlist, and evaluation policy. Narrowly authorize what is needed; do not disable all safeguards. |

When reporting a problem, include OS/architecture, `sl-dbg version`, the failing command and error, and whether you used a venv or custom install path. Review logs before sharing them: debugger output can contain source, values, paths, and secrets. Use private disclosure for security vulnerabilities.

## Updates and uninstall

### Update without losing track of an old daemon

Finish active debug sessions and close MCP clients before upgrading. Run `sl-dbg daemon stop` only when it is safe to end **all** sessions on that daemon. Rerun the installer with the **same `INSTALL_DIR`** and, optionally, a selected version. Check `command -v sl-dbg` and `sl-dbg version`, then restart clients.

The installer replaces the CLI, not adapters or client configuration. If the binary moved, preview and refresh each MCP registration because it records an absolute path. Keep an existing working adapter until you have reviewed the new release's adapter requirements.

Java's cache is not automatically version-matched to the CLI. After upgrading to v0.5.5, use `sl-dbg install-adapter java --force` to refresh it from the matching release. Remove an old source-build override if you want the cached release adapter to be used.

### Uninstall

Before removing the binary, finish sessions, close MCP clients, and stop the daemon intentionally. Preview MCP cleanup:

```bash
sl-dbg mcp uninstall all --dry-run
```

Workspace-scoped entries must be removed from each workspace where you registered them, before deleting the binary:

```bash
sl-dbg mcp uninstall vscode --dry-run
sl-dbg mcp uninstall vscode
```

If you manually registered VS Code or Copilot to work around v0.5.4, that older CLI does not know the corrected schema/location. Back up the configuration and manually remove only its `sl-dbg` entry from `.vscode/mcp.json` or `~/.copilot/mcp-config.json` before deleting the binary. Preserve other servers and settings.

Then run the canonical uninstaller:

```bash
curl -fsSL https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/uninstall.sh | bash
```

For a custom directory, use `curl ... | INSTALL_DIR="/absolute/install/directory" bash` with the full URL above. The default is `~/.local/bin`; an older `/usr/local/bin` installation is a different path. If that path is administrator-owned, ask its owner to remove it rather than running unreviewed remote code as root.

By default the script removes the binary and detected sl-dbg MCP registrations. If MCP cleanup fails, it retains the binary so you can fix the error and retry. To intentionally remove only the binary, append `-s -- --keep-mcp`; remaining client entries will not work until you reinstall.

Adapters, runtime files, logs, watch data, and configuration backups are **not** automatically deleted. Review their locations in [platform notes](platforms.md) and [adapter documentation](adapters.md). The [configuration-file design](configuration.md) is planned, not a currently loaded settings file. Remove adapter environments only when nothing else uses them, and do not delete daemon runtime files while sessions are active.
