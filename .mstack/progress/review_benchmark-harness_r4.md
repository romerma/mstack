# Review - benchmark-harness (item 38, round 4)

**Verdict:** APPROVED

Scope: decision row `review-r4` (`.mstack/decisions.tsv:94`), three changes answering round 3's Changes required 1 and its note 1. I checked only those.

- **Change 1, the fake records argv and `check.mjs` asserts per arm: met, and the test catches the revert.** I mutated a temp copy that pins `REPO` to the checkout. Both reverts go red on all three arms at `check.mjs:60`. The unmutated copy is green.
- **Change 2, `perm` from the init event's `permissionMode` with a `?` fallback: met, and the test catches the revert.** Copying the flag instead goes red at `check.mjs:136` (x3) and `:142`.
- **Change 3, default `BENCH_HOME` `/private/tmp/mstack-bench-home`: met, and asserted.** See `lib.mjs:13` and `check.mjs:31`. The dry run's cwd is under it, and `runs/` is empty afterwards.

**Evidence ladder:**
- All three changes reached rung 4 against the fake `claude` (`testing/fake-claude.sh`) and through a dry run. The real `claude` ran with `--version` only.
- The field name `permissionMode`, top-level on the init event, is rung 4 from recorded real streams. Three spike streams from claude 2.1.316, the version on PATH today, all carry it with the value `default`.
- That a real `--permission-mode auto` run writes the value `auto` there is **unobserved** (rung 2). Only the fake does that, by echoing its own argv. The coordinator's live probe has to settle it.

## Requirement to test
| R (scope) | Test | Evidence |
|---|---|---|
| 1a fake writes its argv | `testing/fake-claude.sh:4`; `FAKE_ARGV_FILE` passed through at `check.mjs:14` | read back at `check.mjs:58,134` |
| 1b default: `--permission-mode auto`, no `--allowedTools`, each of the 3 arms | `check.mjs:58-60` (in the arm loop at `:44`) | m1 and m2: `:60` FAIL for plain, mstack-before and mstack-after |
| 1c `--perm allowlist`: `--allowedTools`, no `--permission-mode`/`auto`, each of the 3 arms | `check.mjs:131-135` | green on the real tree; checked by reading (rung 2-3), not mutated (outside the brief's list) |
| 2a `perm` from init `permissionMode` | `run.mjs:200`; `check.mjs:61,76,136` | m3: `:136` FAIL x3. With auto, flag and init agree, so the allowlist row (`default`) is the part that tells them apart |
| 2b `?` fallback without an init event | `check.mjs:138-142` (no-init fake) | m3: `:142` FAIL |
| 3 default `BENCH_HOME` | `lib.mjs:13`; `check.mjs:31` (literal equality, plus not under `/Users/romerma`, `homedir()`, `claude-501` or `scratchpad`) | dry run: cwd `/private/tmp/mstack-bench-home/runs/plain-T1-r1-…`; `benchHome()` still refuses anything under the home (`lib.mjs:20-21`) |

## Acceptance, quoted
**"every arm runs with --permission-mode auto and no allowlist, so one classifier applies to all arms alike"**
- Met by `run.mjs:119`. Round 3's gap is closed: reverting to round 2's `--allowedTools` (m1) or dropping `--permission-mode auto` (m2) now fails `check.mjs:60` for every arm, and fails `:61,:76` because `perm` reads `default`.
- I read the plain dry-run argv in full. Its tail is `… --max-budget-usd 8 --permission-mode auto`, and it has no `--allowedTools`.
- Rung 4 against the fake. Whether the real CLI applies `auto` unattended under `env -i` is still unobserved, and is the coordinator's probe.

**Scope 1: "The fake records argv. `check.mjs` asserts per arm that the default passes `--permission-mode auto` and no `--allowedTools`, and the reverse for `--perm allowlist`."**
- Met. See `fake-claude.sh:4`, `check.mjs:58-60` for the default and `check.mjs:131-135` for the reverse, each over all three arms.

**Scope 2: "`perm` comes from the stream's init event `permissionMode`, with a `?`-suffixed fallback."**
- Met. `run.mjs:200` is `init?.permissionMode ?? (o.perm === "allowlist" ? "allowlist?" : "auto?")`.
- The fake derives the mode from its own argv (`fake-claude.sh:6-7`, emitted at `:10`), so a row that copies the flag can no longer pass.

**Scope 3: "The default `BENCH_HOME` is `/private/tmp/mstack-bench-home`, outside the session scratchpad and `/Users/romerma`, and `check.mjs` asserts it."**
- Met. See `lib.mjs:13` and `check.mjs:31`.
- The old scratchpad `bench-home` is gone: `fd -d 5 '^bench-home$' /private/tmp/claude-501` prints nothing.
- `versions/` at the new home holds `before` and `after-a4e6c784…`, and `fd -H '^\.mstack$'` on it prints nothing.

## Verification I ran
```
$ ./bin/mstack version                  -> mstack 0.2.1 at /Users/romerma/Code/mstack
$ ./bin/mstack gate                     -> PASSED - 0 failures, 2 warnings (on main; uncommitted changes)
$ bun sandbox/bench/verify.mjs          -> pristine visible suite 18/18 OK; for each of T1-T6 the reference patch
                                           passes all hidden tests, visible 18/18 after patch, trace all mapped;
                                           "all checks passed", exit 0   (per-task hidden counts omitted on purpose)
$ bun sandbox/bench/check.mjs           -> 75 ok, 0 FAIL, "all harness checks passed", exit 0 (14.6 s)
    ok   default BENCH_HOME is outside the home and every claude scratchpad: /private/tmp/mstack-bench-home
    ok   {plain,mstack-before,mstack-after}: default argv has --permission-mode auto and no --allowedTools
    ok   {plain,mstack-before,mstack-after}: perm column comes from the init event's permissionMode (auto)
    ok   {plain,mstack-before,mstack-after}: --perm allowlist passes --allowedTools and no --permission-mode auto
    ok   {plain,mstack-before,mstack-after}: allowlist run reports the init event's permissionMode (default)
    ok   no init event: perm falls back to the flag value suffixed ?

mutations: copy of sandbox/bench at sandbox/bench/.rv4-<name>/ (inside sandbox/bench as required),
lib.mjs REPO pinned to /Users/romerma/Code/mstack, one mutation each, check.mjs run from the copy, copy deleted after
  base                (no mutation)                                     -> exit 0, 75 ok, 0 FAIL
  m1 run.mjs:119 -> `"--allowedTools", ALLOW.join(" "),` (round 2)       -> exit 1, 7 FAIL:
                         :60 x3 (each arm's default argv), :61 x3 (perm=default), :76
  m2 run.mjs:119 auto branch -> []                                       -> exit 1, 7 FAIL: same lines as m1
  m3 run.mjs:200 -> `perm: o.perm,`                                      -> exit 1, 4 FAIL:
                         :136 x3 (allowlist rows read "allowlist", not "default"), :142 (no-init reads "auto", not "auto?")
  none of the four crashed; every arm ran; no new /private/tmp/bench-check-* root left; .rv4-* deleted

$ bun sandbox/bench/run.mjs --arm plain --task T1 --rep 1 --dry-run     (BENCH_HOME/OUT/CLAUDE unset)
  cwd:  /private/tmp/mstack-bench-home/runs/plain-T1-r1-20261101T195713Z
  claude 2.1.316 (Claude Code) at /Users/romerma/.local/bin/claude      (--version only)
  env -i <that env> sh -c 'command -v mstack || echo no-mstack' -> no-mstack
  command: env -i <that env> /Users/romerma/.local/bin/claude -p '<T1 issue + SUFFIX>' --model opus
           --output-format stream-json --verbose --setting-sources project --strict-mcp-config
           --max-budget-usd 8 --permission-mode auto
  dry run: claude was not invoked, no results row written; exit 0
  afterwards: /private/tmp/mstack-bench-home/{runs/ (empty), versions/before, versions/after-a4e6c784…}

$ rg '"subtype":"init"' sandbox/bench/streams/*.jsonl | jq '{permissionMode,claude_code_version}'
  -> all 3 spike streams: {"permissionMode":"default","claude_code_version":"2.1.316"}
$ fd -H -t f '^(test_T[1-6]\.py|T[1-6]\.patch)$' /private/tmp   -> (no output)
$ ./bin/mstack ledger check benchmark-harness  -> PASS test-verified at a4e6c784 by implementer (HEAD a4e6c784)
```

**Skipped on purpose:**
- `bun test tests/` and `./bin/mstack gate --full`. The store's `verify` is `npm test && npm run typecheck && bin/mstack lint-plugin .`. This item touches only the gitignored `sandbox/bench`, and `tests/` has a known unrelated ~600 s hang tracked in item 21. The brief excludes both.
- The real `claude` was not given a prompt.

## Non-blocking notes (outside this round's scope)
1. **The implementer's revert proof did not exercise the mstack arms.**
   - `impl_benchmark-harness_r4.md` ran its copy at `sandbox/bench/.scratch-r4`, where `REPO = resolve(BENCH,"..","..")` (`lib.mjs:9`) lands in `sandbox/`.
   - `sandbox/` is a nested git repo with HEAD `7e12c037`. Both mstack arms therefore died at `git archive`/`mstack setup`, whatever the mutation.
   - Its "mstack-before/after: run succeeded and wrote a row" FAILs are that artefact, not a cascade from the mutation.
   - The leftovers confirm it: `versions/after-7e12c037…` and three unpatched mstack run copies.
   - My runs with `REPO` pinned show each arm caught on its own at `check.mjs:60`.
2. **Two crashed check roots sit next to the new default home.**
   - They are `/private/tmp/bench-check-FPY4FE` and `/private/tmp/bench-check-g13EeL`, left by that proof. `/private/tmp` is `../../..` of every run.
   - I inspected them. There are no hidden-test or patch files, the run copies are clean templates, and `scoring/` is empty. They are not answer-bearing.
   - Delete them before the batch, along with the Oct 31 `/private/tmp/{x,x2,x_probe,run.mjs.bak}`.
   - The mechanism: `check.mjs:133-134` ignores `run()`'s status, so when a run fails `readFileSync(af)` throws ENOENT and `rmSync(root)` at `:159` never runs. A try/finally around the body, or an `existsSync` guard, would fail clean.
3. **`/private/tmp/claude-501` sits at `../../../claude-501` of every run.** It is mode 700, owned by the same user.
   - Today nothing under `/private/tmp` matches a hidden-test or patch filename.
   - A later pass that copies answers into its scratchpad would put them four levels below that point: deeper than round 3's sibling layout, but still reachable.
   - Keeping mutation copies inside `sandbox/bench`, as this round did, avoids it.
4. **`fake-claude.sh:4` writes one argument per line, but the prompt spans many lines.**
   - So argv lines are not argv entries 1:1.
   - The checks at `check.mjs:60,135` hold unless a prompt line is exactly `auto`, `--permission-mode` or `--allowedTools`.
   - NUL separation (`printf '%s\0'`) would make the record exact.
5. **`check.mjs:144,147` has dead code: `const p = null; … void p;`.** Also, `const bad` at `:145` shadows the module counter from `:8`. It works, because `ok` closes over the outer one, but it misleads.
6. **Stale docs.** `DESIGN.md:16` says the mode "is recorded in the `perm` column" but does not say it is read from the init event, and nowhere names the `/private/tmp/mstack-bench-home` default. Round 3's note 7 also still stands.
7. **The ledger SHA cannot tell revisions apart.** As in rounds 1-3, `ledger check` reads PASS from the implementer's self-recorded row at `a4e6c784`, the same SHA as both reviewer rejections. Because `sandbox/` is gitignored, the SHA cannot tell harness revisions apart.
