# sl-dbg MCP server reference

Auto-generated from a live `sl-dbg mcp` introspection on **2026-06-27** (server `sl-dbg` v`0.0.0-dev`).

> This file is the canonical contract between sl-dbg and any MCP-aware agent. Every entry below is what the agent receives from `tools/list` / `resources/list` / `prompts/list`, verbatim from the binary.

## At a glance

- **Tools:** 36  
- **Resources:** 3  
- **Prompts:** 3  
- **Transport:** stdio (JSON-RPC 2.0)
- **Protocol version:** `2024-11-05`

## Wire it up

```bash
# One command per agent — safe read-merge-write with .bak backup
sl-dbg mcp install claude   # or: cursor | vscode | codex | copilot | all
```

## Resources

Read-only views into live daemon state. An agent fetches them with
`resources/read` instead of paying for a tool call.

| URI | Name | Description | MIME |
|---|---|---|---|
| `sl-dbg://sessions` | sessions | Live debug sessions managed by the daemon (JSON list). | `application/json` |
| `sl-dbg://events` | events | Recent DAP events from the current session (JSON list). | `application/json` |
| `sl-dbg://adapters` | adapters | Installed-status of language adapters (JSON list). | `application/json` |

## Prompts

Prebuilt prompt templates the user can pick from the agent UI.

### `diagnose_loop_bug`

Pause the suspected loop, inspect loop vars across iterations, and report what diverges.

- `file` *(required)* — Source file containing the loop
- `line` *(required)* — 1-based line number of a stoppable instruction inside the loop

### `trace_call_path`

Set a function breakpoint, run, then walk the stack from the hit frame outward.

- `function` *(required)* — Function/method name (and ClassName.method for Java)

### `watch_then_continue`

Add a watch expression and continue until it evaluates to a target value.

- `expr` *(required)* — Expression to watch
- `until` — Optional value to wait for

## Tools

Every tool returns a JSON object. Errors come back as a top-level `{ "ok": false, "err": { "code": "...", "msg": "..." } }` envelope.

### Lifecycle

#### `debug_start`

Launch a program under the debugger. lang one of python|go|java.

| Name | Type | Required | Description |
|---|---|---|---|
| `args` | `array&lt;string&gt;` |  | program args |
| `classpath` | `string` |  | Java classpath (when lang=java) |
| `lang` | `enum(python\|go\|java)` | ✅ | language adapter to use |
| `mainClass` | `string` |  | Java main class (when lang=java) |
| `program` | `string` | ✅ | absolute path to program or entrypoint |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `sourceRoots` | `array&lt;string&gt;` |  | source roots for path resolution |
| `stopOnEntry` | `boolean` |  | pause at program entry |

#### `debug_attach`

Attach to a running process over DAP/JDWP.

| Name | Type | Required | Description |
|---|---|---|---|
| `host` | `string` | ✅ | hostname |
| `lang` | `enum(python\|go\|java)` | ✅ | language adapter to use |
| `pid` | `integer` |  | alternative to host:port (where supported) |
| `port` | `integer` | ✅ | DAP/JDWP port |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `sourceRoots` | `array&lt;string&gt;` |  | source roots |

#### `debug_restart`

Restart the debug session (if adapter supports it).

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_stop`

Terminate the session.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_sessions`

List active debug sessions.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

### Breakpoints

#### `debug_break`

Set a line breakpoint. location is 'file:line'.

| Name | Type | Required | Description |
|---|---|---|---|
| `condition` | `string` |  | optional condition expression |
| `hit` | `integer` |  | break only on Nth hit |
| `location` | `string` | ✅ | file:line |
| `logMsg` | `string` |  | logpoint message; if set, BP prints without stopping |
| `once` | `boolean` |  | remove after first hit |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_break_fn`

Function/method entry breakpoint.

| Name | Type | Required | Description |
|---|---|---|---|
| `condition` | `string` |  | optional condition |
| `function` | `string` | ✅ | fully-qualified function name |
| `hit` | `integer` |  | hit count |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_break_ex`

Enable exception breakpoints. filters: uncaught | raised | adapter-specific.

| Name | Type | Required | Description |
|---|---|---|---|
| `filters` | `array&lt;string&gt;` | ✅ | filter names |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_breaks`

List all breakpoints (line, function, and exception).

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_unbreak`

Remove one or more breakpoints by id; or all of them.

| Name | Type | Required | Description |
|---|---|---|---|
| `all` | `boolean` |  | remove every breakpoint in the session |
| `ids` | `array&lt;integer&gt;` |  | breakpoint ids to remove |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

### Execution control

#### `debug_continue`

Resume execution. Blocks until next pause / exit.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `timeoutSec` | `number` |  | max seconds to wait |

#### `debug_step`

Step into the next call.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_next`

Step over (next line, same frame).

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_finish`

Step out of the current function.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_pause`

Suspend the running target.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_until`

Continue execution until a given line in the current source file.

| Name | Type | Required | Description |
|---|---|---|---|
| `line` | `integer` | ✅ | target line in current file |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

### Inspection

#### `debug_stack`

Return the current call stack.

| Name | Type | Required | Description |
|---|---|---|---|
| `limit` | `integer` |  | max frames to return (default: 20) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `thread` | `integer` |  | thread id (default: current) |

#### `debug_threads`

List all threads in the target process.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_locals`

Return local variables at the current frame.

| Name | Type | Required | Description |
|---|---|---|---|
| `frame` | `integer` |  | frame index (0 = top) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_globals`

Return module/global variables.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_fields`

Expand a variables-reference.

| Name | Type | Required | Description |
|---|---|---|---|
| `ref` | `integer` | ✅ | variables reference |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_source`

Show source code around the current pause location, or at any file:line. Zero-arg form (`{}`) defaults to the current paused frame. DO NOT use to read arbitrary files outside the program — the daemon may block paths outside SL_DBG_ALLOW_SOURCE_ROOT with SOURCE_PATH_DENIED.

| Name | Type | Required | Description |
|---|---|---|---|
| `around` | `integer` |  | lines of context on each side; 0 = whole file (default 8) |
| `file` | `string` |  | absolute path; defaults to current pause location |
| `line` | `integer` |  | center line; defaults to current pause line |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_output`

Drain captured target stdout/stderr.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `since` | `string` |  | RFC3339 timestamp; only newer entries |
| `tail` | `integer` |  | last N entries |

#### `debug_events`

Return the captured DAP event log.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `since` | `string` |  | RFC3339 timestamp |
| `tail` | `integer` |  | last N events |

#### `debug_snapshot`

Full state dump: stack + locals + globals.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_state`

Return current session state (paused/running/exited).

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_print`

Recursively expand a value (collections, nested objects) to a given depth.

| Name | Type | Required | Description |
|---|---|---|---|
| `depth` | `integer` |  | recursion depth (default 3) |
| `expression` | `string` |  | expression to evaluate (or use ref) |
| `frame` | `integer` |  | frame index |
| `maxItems` | `integer` |  | max items per container (default 50) |
| `ref` | `integer` |  | variables-reference from a prior locals/eval/fields call |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_explain_pause`

Return an English summary of the current pause: where we are, top frames, key locals, and active watch values. Designed to fit in a small LLM context window.

| Name | Type | Required | Description |
|---|---|---|---|
| `maxFrames` | `integer` |  | cap on stack frames to include (default 5) |
| `maxVars` | `integer` |  | cap on local variables to include (default 12) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

#### `debug_snapshot_compact`

Like debug_snapshot but trims variable lists and skips deep object references. Use this when context budget matters.

| Name | Type | Required | Description |
|---|---|---|---|
| `maxFrames` | `integer` |  | cap on stack frames (default 8) |
| `maxVars` | `integer` |  | cap on variables per scope (default 20) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

### Evaluation & state

#### `debug_set`

Mutate a local variable in the current (or specified) frame.

| Name | Type | Required | Description |
|---|---|---|---|
| `frame` | `integer` |  | frame index (0 = top) |
| `name` | `string` | ✅ | variable name as shown in debug_locals |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `value` | `string` | ✅ | new value, expressed in the target language's syntax (e.g. '42', '"hi"', 'true') |

#### `debug_eval`

Evaluate an expression in the current frame. Use for ad-hoc inspection (`x + 1`, `obj.method()`) and quick what-if probes; sl-dbg auto-qualifies bare static-field names in Java. DO NOT use for repeated inspection of the same expression — use `debug_watch add` instead. Daemon may block expressions matching SL_DBG_DENY_EVAL_PATTERNS (default: Java side-effect classes like FileOutputStream).

| Name | Type | Required | Description |
|---|---|---|---|
| `expression` | `string` | ✅ | expression to evaluate; e.g. `x + 1`, `obj.method()` |
| `frame` | `integer` |  | frame index (0 = top of stack; default 0) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `timeoutSec` | `number` |  | max seconds for evaluation (default 5) |

#### `debug_watch`

Manage watch expressions. action: list | add | remove.

| Name | Type | Required | Description |
|---|---|---|---|
| `action` | `string` |  | list \| add \| remove |
| `all` | `boolean` |  | remove all (for remove) |
| `expression` | `string` |  | expression (for add) |
| `id` | `integer` |  | watch id (for remove) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

### Composite recipes

#### `debug_run_until_break`

Set a line breakpoint and resume execution in one call. Returns the resulting pause state.

| Name | Type | Required | Description |
|---|---|---|---|
| `condition` | `string` |  | optional condition expression |
| `location` | `string` | ✅ | file:line |
| `once` | `boolean` |  | auto-remove the breakpoint after it fires (default true) |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `timeoutSec` | `number` |  | max seconds to wait for the pause |

#### `debug_inspect_at`

Stop at a location, snapshot locals + evaluate a list of expressions, then optionally remove the breakpoint and continue. Bundles 4-6 normal calls into one.

| Name | Type | Required | Description |
|---|---|---|---|
| `condition` | `string` |  | optional condition expression |
| `continue` | `boolean` |  | resume after capturing (default false) |
| `expressions` | `array&lt;string&gt;` |  | expressions to evaluate at the pause |
| `location` | `string` | ✅ | file:line |
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `timeoutSec` | `number` |  | max seconds to wait for the pause |

### Infra

#### `debug_listen`

Block until the next stop/exit/terminate event.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |
| `timeoutSec` | `number` |  |  |

#### `debug_adapters`

List installed language adapters.

| Name | Type | Required | Description |
|---|---|---|---|
| `session` | `string` |  | optional session id; defaults to the daemon's current default (newest started) |

---

## Security knobs the agent does NOT see

The daemon enforces these *before* a tool call ever reaches the adapter — independent of what the LLM decides to call:

| Env var | Effect |
|---|---|
| `SL_DBG_DENY_EVAL_PATTERNS` | Comma-separated substrings; `debug_eval` expressions matching any are rejected with `EVAL_DENIED`. Defaults to known Java side-effect classes (`FileOutputStream`, `Runtime`, etc.). |
| `SL_DBG_ALLOW_SOURCE_ROOT`  | Colon-separated dir list; `debug_source` paths outside any of them return `SOURCE_PATH_DENIED`. |
| `--read-only`               | Hides every state-mutating tool from `tools/list`. The agent literally cannot see them. |
| `--allow-cwd <dir>`         | `debug_start`/`debug_attach` reject programs whose cwd or path falls outside the listed roots (`POLICY_DENIED`). |
| `--deny-program <substr>`   | Case-insensitive substring deny-list applied to the program path. |

See [SECURITY.md](SECURITY.md) for the full threat model and the policy decision flow.
