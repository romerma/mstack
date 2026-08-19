# Review - statusline (robustness)

**Verdict:** CHANGES_REQUESTED

## Verification I ran

All commands run against a real sandbox (`git init` + `mstack setup` + one `in_progress` item) built
under a scratch directory, invoking the real `bin/mstack` launcher (both the `bun` path, which this
machine prefers, and the `node --experimental-strip-types` fallback path, forced via a PATH without
`bun`). Full transcripts are long; the load-bearing excerpts are below.

**1. EPIPE on stdout is not caught — writes a stack trace to stderr and exits 1.**
```
$ node epipe-check.mjs "$REPO" bin/mstack statusline   # spawns mstack, destroys the stdout pipe 1ms after start
{
  "exitCode": 1,
  "signal": null,
  "stderrBytes": 270,
  "stderr": "EPIPE: broken pipe, write\n ... code: \"EPIPE\"\n\n  at write (unknown:1:1)\n  at writeFast (internal:fs/streams:345:38)\n  at statusline (/Users/romerma/Code/mstack/src/statusline.ts:193:20)\n\nBun v1.3.11 (macOS arm64)\n"
}
```
Forcing the node fallback path (PATH stripped of `~/.bun`) reproduces the same thing under node:
```
{
  "exitCode": 1, "stderrBytes": 1019,
  "stderr": "node:events:486\n      throw er; // Unhandled 'error' event\n      ^\n\nError: write EPIPE\n    at afterWriteDispatched ..."
}
```
5/5 repeat runs reproduced `exitCode: 1` deterministically. Also reproduced on the `--subagent` path
(50 tasks, stdout destroyed 1ms in): `exitCode: 1`, stack frame `at subagentStatusline
(/Users/romerma/Code/mstack/src/statusline.ts:310:44)`. A plain shell pipeline confirms the same thing
interactively: `printf '{...}' | bin/mstack statusline | :` prints the Bun stack trace to the terminal
5/5 times.

**2. `git()` has no timeout — a slow/hung git hangs the whole process indefinitely.**
Shimmed `git` on PATH with a script that just `sleep 30`s, then ran `bin/mstack statusline` under a
harness that SIGKILLs it after a 5s budget:
```
$ STDIN_STR='{"workspace":{"current_dir":"'"$REPO"'"}}' STDIN_CLOSE=1 \
    node timed-run.mjs 5000 "$REPO" /tmp/slowgit -- bin/mstack statusline
{ "elapsedMs": 5005, "killedForTimeout": true, "exitCode": null, "signal": "SIGKILL",
  "stdoutBytes": 0, "stderrBytes": 0 }
```
Still running (had to be killed) after 5 full seconds, zero bytes ever written.

**3. `readFileSync(0, "utf8")` has no timeout — stdin that never closes hangs the whole process.**
Same harness, this time stdin is an open pipe that receives no data and is never `.end()`ed:
```
$ STDIN_STR='' STDIN_CLOSE=0 node timed-run.mjs 5000 "$REPO" - -- bin/mstack statusline
{ "elapsedMs": 5006, "killedForTimeout": true, "exitCode": null, "signal": "SIGKILL",
  "stdoutBytes": 0, "stderrBytes": 0 }
```

**4. One broken subagent report file blanks the entire subagent panel, not just its own row.**
Control (both tasks healthy: implementer has a real 80-byte report, reviewer has none yet) produces 2
rows as expected:
```
{"id":"a","content":"...impl report written"}
{"id":"b","content":"...no review report yet"}
```
Replacing only `impl_demo-item.md` with a dangling symlink (`ln -s /nonexistent-target-xyz
impl_demo-item.md` — present in `readdirSync`, throws `ENOENT` on `statSync`) and re-running with the
same two tasks:
```
$ printf '{"cwd":"...","tasks":[{"id":"a","type":"mstack:implementer"},{"id":"b","type":"mstack:reviewer"}]}' \
    | bin/mstack statusline --subagent
exit=0 out=[] lines=0
```
Task `b` (reviewer) has nothing wrong with it — proven by the control run above — and still disappears.
Reproduced with task order swapped too.

**5. An unreadable `ledger.tsv` silently blanks the whole line, including parts already computed.**
```
$ chmod 000 .mstack/ledger.tsv
$ printf '{"workspace":{"current_dir":"..."}}' | bin/mstack statusline
exit=0 out=[] outbytes=0 err=[]
```
Direct call to confirm the throw site:
```
Error: EACCES: permission denied, open '/tmp/repo-badledger/.mstack/ledger.tsv'
    at readFileSync (node:fs:440:20)
    at read (file:///.../src/tsv.ts:47:17)
    at readRecords (file:///.../src/tsv.ts:55:28)
    at entries (file:///.../src/ledger.ts:75:10)
    at check (file:///.../src/ledger.ts:108:15)
```

**6. Missing runtime on PATH.**
```
$ env PATH=/usr/bin:/bin printf '{}' | bin/mstack statusline
exit=127 err=[mstack: needs bun, or node 22.6 or newer, and found neither on PATH.]
```

**7. CLI argument robustness.**
```
$ printf '{}' | bin/mstack statusline --bogus            -> exit=2 err=mstack: Unknown option '--bogus'
$ printf '{}' | bin/mstack statusline extra-positional    -> exit=2 err=mstack: Unexpected argument 'extra-positional'...
$ printf '{}' | bin/mstack statusline --subagent=weird    -> exit=2 err=mstack: Option '--subagent' does not take an argument
```

**8. Unicode truncation boundary (cosmetic only, no crash).**
Branch renamed to `x-🚀-branch` (emoji = UTF-16 surrogate pair). `COLUMNS=4` lands the truncation
boundary inside the pair:
```
$ COLUMNS=4 bin/mstack statusline
bytes: 78 2d ef bf bd 1b 5b 30 6d ...     # "x-" + U+FFFD (replacement char), not "x-🚀"
```
No throw, no stderr, exit 0 — Bun/Node silently re-encode the orphaned surrogate as U+FFFD.

**Checked and found correct (stated for completeness, not findings):**
- `NO_COLOR` matrix (`unset`, `''`, `0`, `1`, `false`, `anything`) — only `unset` shows colour; every
  defined value, including empty string, disables it. Fully spec-compliant with https://no-color.org.
- `COLUMNS` matrix (`''`, `0`, `-5`, `abc`, `1e10`, `80`, `'  80'`, `80junk`) — never crashes; `<=0`
  and non-numeric all safely fall back to "no truncation"; the degenerate `COLUMNS=1e10` → `parseInt`
  → `1` case still produces a syntactically valid (near-empty) truncated line.
- Hostile stdin: no redirection, closed fd (`0<&-`), 1KB `/dev/urandom`, empty string, truncated JSON,
  and JSON scalars (`null`, `3`, `true`, `[]`, a bare string) — all exit 0, empty stderr, sensible output.
- 100,000-deep nested JSON array and a 10MB JSON payload — both parse and render in <60ms, exit 0.
- Nonexistent `cwd`, `cwd` inside a `chmod 000` directory, `.mstack` as a plain file, `chmod 000
  state.json` — all hit the documented `no .mstack` / `state.json unreadable` messages, exit 0.
- Git repo with zero commits (`rev-parse --abbrev-ref HEAD` and `rev-parse HEAD` both genuinely fail
  with exit 128 in this state — verified directly), detached HEAD (literal `HEAD` correctly suppressed
  from display), and a corrupted/deleted `.git` — all degrade to omitting branch/verdict, no crash.
- Performance: `bin/mstack statusline` ~50ms via bun (preferred whenever present, true on this
  machine); via node, ~90-100ms cold vs ~60ms with a warm `NODE_COMPILE_CACHE` (cache dir confirmed
  populated and reused) — the cache is real and helps, but is moot on any machine with `bun` on PATH,
  since `bin/mstack` always prefers `bun` and bun doesn't use `NODE_COMPILE_CACHE` at all.

## Findings

1. `src/statusline.ts:193` (and `:310` for the subagent path) - `process.stdout.write(...)` is
   asynchronous on a pipe-backed stdout under both Bun and Node. When the reader goes away before or
   during the write (confirmed 5/5 with a harness that closes the read end 1ms after spawn, and
   interactively via `bin/mstack statusline | :`), the resulting EPIPE surfaces as an unhandled stream
   `error` event *after* the synchronous `try { ... } catch { /* silent */ }` block in `statusline()`
   (lines 185-201) / `subagentStatusline()` (lines 298-314) has already returned control — so the
   catch never sees it. Result: a full stack trace on stderr and **exit code 1**, on the one code path
   whose entire purpose is "never break a session." This is the most direct falsification of the
   file's own header comment ("Any failure at all prints nothing and exits 0"). Fix: install an
   `on("error", () => {})` handler on `process.stdout` (and swallow/ignore EPIPE specifically) before
   writing, in both functions.

2. `src/gate.ts:267-273` (`git()`) - `execFileSync("git", args, { cwd, encoding, stdio })` passes no
   `timeout`. Confirmed a git that hangs (large repo, network filesystem, or any other cause of
   latency — the mechanism is generic, not tied to my `sleep 30` shim) blocks `mstack statusline`
   indefinitely; the process had to be SIGKILLed after a 5s budget with zero output ever produced. Two
   call sites feed this from the status line: `src/statusline.ts:85` and `:117`. The README's claim
   that "a slow status line blocks updates and Claude Code cancels the in-flight script" describes an
   *external* safety net (Claude Code killing the process), not one this code provides itself — and it
   does nothing for a bare `mstack statusline` invocation outside that harness. Fix: pass `timeout` (a
   few hundred ms is generous for local plumbing commands) to `execFileSync` in `git()`, and keep
   returning `null` on the resulting `ETIMEDOUT`, exactly as any other git failure is already handled.

3. `src/statusline.ts:188` and `:301` (`readFileSync(0, "utf8")`) - a synchronous, unbounded blocking
   read. Confirmed: stdin opened but never closed and never fed data hangs the process indefinitely
   (SIGKILLed after 5s, zero output). In production this is bounded only by whatever external
   mechanism invokes `mstack statusline` and closes its stdin promptly; the code itself has no
   fallback. Given finding 2 already establishes there's no general timeout discipline in this file,
   this is the same gap on the input side. Fix: at minimum apply a short internal deadline around the
   read (e.g. read via a fd with a timeout, or fall back to `""` after N ms) so the "never break a
   session" claim doesn't depend entirely on the caller's behavior.

4. `src/statusline.ts:276-277` inside `renderSubagents` - `statSync(file)` is called, unguarded, on
   every path `reportFiles()` returns, but the only exception handling is the single outer
   `try/catch` wrapping the *entire* loop in `subagentStatusline()` (lines 298-314). Proved
   deterministically: a dangling symlink at the expected report path (present in `readdirSync`, ENOENT
   on `statSync`) makes the whole call throw, discarding rows for *every* task, including ones that
   were already known-good (control run showed the same healthy reviewer task renders fine on its
   own). This directly contradicts the comment immediately below it, at line 312: "Deliberately
   silent: a broken row must never take the panel with it" — currently, one broken row *does* take the
   panel with it. The dangling symlink is a deterministic stand-in for a real risk: progress files are
   actively written/replaced by concurrent subagents while this polls, so a genuine
   delete-between-`readdirSync`-and-`statSync` race is plausible, not just theoretical. Exit code and
   stderr stay clean, so this doesn't crash the session, but it silently defeats the one feature this
   code path exists for, at exactly the moment (concurrent writes) it's supposed to help. Fix: wrap
   each task's row-building (or at least the `statSync` call) in its own try/catch so one bad file
   degrades that one row, not the batch.

5. `src/tsv.ts:47` (`read()`) - `readFileSync(file, "utf8")` has no try/catch, unlike every other
   store-file read in this codebase (`parseState` in `src/state.ts:60-63` explicitly catches and
   rethrows as a `UserError`). Confirmed: a `chmod 000` `ledger.tsv` throws `EACCES` through
   `readRecords` (tsv.ts:55) → `entries` (ledger.ts:75) → `check` (ledger.ts:108), caught only by the
   outer `statusline()` try/catch, which discards the *entire* line — including the model name,
   branch, item id/slug/status that had already been successfully computed — printing nothing at all
   instead of the graceful partial message the sibling `state.json unreadable` path gives. Exit 0, no
   stderr, so this stays inside the documented "any failure prints nothing" fallback, but it's a
   strictly worse outcome than necessary and inconsistent with the polish given to the `state.json`
   case right next to it. Fix: wrap the `check(store, item.slug, sha)` call at
   `src/statusline.ts:119` in its own try/catch (mirroring the `parseState` handling directly above
   it) so a bad ledger degrades to an "unverified"-style note instead of erasing the whole line.

6. `bin/mstack:56-57` - when neither `bun` nor a suitable `node` resolves on the subprocess's PATH,
   the launcher does `echo ...>&2; exit 127`. Confirmed directly (`PATH=/usr/bin:/bin`). The
   README's own "Runtime" section acknowledges the status line process's PATH is not guaranteed to
   match the Bash tool's ("whether the status line process inherits it is not"), which is exactly the
   condition that triggers this. None of the hardening inside `statusline()`/`subagentStatusline()`
   applies here because the JS process never starts — this is a real, if narrow, way the statusLine
   command can exit non-zero and write to stderr on every single turn in an affected environment. Not
   a regression to fix blindly (the other `mstack` subcommands legitimately want a loud error here),
   but worth a documented mitigation beyond "point at an absolute path" (which only fixes `mstack` not
   resolving at all, not `bun`/`node` not resolving once it does).

7. `src/cli.ts:111-114` (`cmdStatusline`) - `parseArgs(..., { strict: true })` runs with no local error
   handling; only the generic top-level handler at the bottom of `src/cli.ts` catches a throw from it.
   Confirmed: an unrecognized flag, a stray positional argument, or a boolean flag given a value (e.g.
   `--subagent=weird`) each produce exit code 2 and an `mstack: ...` stderr line. This only triggers on
   a misconfigured invocation (e.g. a typo in the `statusLine.command` setting), not on bad stdin/JSON,
   but it's still a code path where `mstack statusline` violates the exit-0/no-stderr contract this
   review is checking.

8. `src/statusline.ts:161-178` (`truncateVisible`) - truncates by UTF-16 code unit, not Unicode code
   point. Confirmed with a branch named `x-🚀-branch` and `COLUMNS=4`: the boundary lands inside the
   emoji's surrogate pair, and the orphaned surrogate is silently re-encoded as U+FFFD on write
   (`x-<replacement char>` instead of `x-🚀`). No crash, no stderr, exit 0 — purely cosmetic, lowest
   severity of everything above, listed for completeness since branch names are somewhat
   attacker/author-influenced text and this is the one place raw slicing touches them. Fix (optional):
   iterate `[...text]` (code points) instead of code units.
