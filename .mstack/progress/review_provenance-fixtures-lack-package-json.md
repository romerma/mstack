# Review - provenance-fixtures-lack-package-json

**Verdict:** APPROVED

Solo reviewer, round 1. Judged at head `4dc667dd` on branch
`fix/provenance-fixtures-lack-package-json`. Substantive commit `471b163e`; the code diff is
28 lines across `tests/gate.test.ts` and `tests/provenance.test.ts` and nothing else.
`git diff main...HEAD --name-only -- src/ bin/ .claude-plugin/` returns empty, so the
"src/ untouched" claim is confirmed rather than assumed (rung 4).

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| Fixture standing in for a checkout must carry package.json, so node 22.6 stops warning | `tests/provenance.test.ts:70`, `:99`, `:157`, `:361` (CI numbers 206/208/211/217) | I reverted only the test file to `main`'s bytes in an isolated copy of the tree and re-ran on `~/.nvm/versions/node/v22.6.0/bin/node`: the same four go red with `MODULE_TYPELESS_PACKAGE_JSON`. Restored: 276/276. Rung 5 on the failing binary. |
| The gate-side checkout fixture is faithful too | `tests/gate.test.ts:1197` `checkoutMarkers()`, exercised by `:1216`, `:1231`, `:1285`, `:1306` | These four never went red (they build stub `bin/mstack`/`src/cli.ts` and never execute a module), so this half is faithfulness, not a bug fix. It is covered in the sense that reverting `gate.test.ts:1206` leaves the suite green - stated openly below rather than sold as coverage. |
| Real deployments really do carry package.json (the premise the whole fix rests on) | not a test; observed in the running system | `~/.claude/plugins/cache/mstack/mstack/0.1.0/package.json` exists with `"type": "module"`, as does `~/.claude/plugins/marketplaces/mstack/package.json:5`, and `git ls-files package.json` shows it tracked. Rung 5. The fix is therefore making the fixture faithful, not masking a shipping defect - which was the one way this change could have been wrong. |

## Acceptance, quoted

**"The four failing tests are shown red under real node 22.6.0 before the fix and green after, on that binary"** - met, and re-proved independently. I did not trust the pasted transcript: I `rsync`ed the tree (minus `.git`, `node_modules`) to a scratch copy, ran the post-fix suite there under `v22.6.0` (276/276), then wrote `git show main:tests/provenance.test.ts` over the copy's test file and re-ran the exact CI incantation. The failures are `not ok 206 / 208 / 211 / 217`, the exact four from CI run 32526687400, with `actual` = the `MODULE_TYPELESS_PACKAGE_JSON` warning. Restoring the post-fix file returns `ok 206 / 208 / 211 / 217` and 276/276, exit 0. Full output below. The working tree was never modified to do this - no `git checkout`, no `git reset`.

**"Every test fixture that stands in for an mstack checkout carries package.json, found by sweeping all fixture builders rather than patching the four sites"** - met. `isMstackCheckout` (`src/paths.ts:110-127`) is true only when `bin/mstack` and `src/cli.ts` both exist *and* `.claude-plugin/plugin.json` is a regular file parsing to `name === "mstack"`. I swept `tests/` independently for `cpSync`, `copyFileSync`, and writes of those three paths. Exactly two builders produce an accepted fixture, and both now copy the real file:

| Builder | `isMstackCheckout`? | State after the diff |
|---|---|---|
| `tests/provenance.test.ts:56` `scratchCheckout()` | yes | copies it, `:61` |
| `tests/gate.test.ts:1197` `checkoutMarkers(sb)` default manifest | yes | copies it, `:1206` |
| `tests/provenance.test.ts:216` wrapper repo (`:224`) | no - no mstack manifest | untouched, correct |
| `tests/provenance.test.ts:291` fifo manifest (`:302`) | no - `statSync().isFile()` false | untouched, correct |
| `tests/gate.test.ts:1262` one-marker-alone loop (`:1266`) | no - one marker | untouched, correct |
| `tests/gate.test.ts:1285` / `:1306` `checkoutMarkers(sb, null)` + bad manifests | no - manifest missing/wrong/unparseable/dir | inherit the copy via the builder |
| `tests/lint.test.ts:14` `copy()` | no - `:16` copies `skills, agents, hooks, .claude-plugin, src`, never `bin/`, so the first guard at `src/paths.ts:111` refuses it | untouched, correct |

The negative direction holds, which is what item 17 round 2 bought: the not-a-checkout variants that *did* gain a `package.json` (`gate.test.ts:1285`, `:1306`) are refused on the manifest, which `isMstackCheckout` reads and `package.json` cannot influence; the assertions there (`no provenance line without the mstack manifest`, `must not fire the check`) still assert the same thing and still pass. If anything the fixture is now a harder negative, since it looks *more* like mstack and is still refused. No assertion anywhere was deleted, loosened or renamed: `git diff main...HEAD -- tests/` is additions plus one comment reflow, zero removed `assert`.

**"npm test green on both runtimes locally, and CI green on main after push, which is the surface the defect lives on"** - local half met, CI half correctly pending. `npm test` exit 0: bun `276 pass / 0 fail`, then node v26.7.0 `pass 276 / fail 0`. Plus `npm run typecheck` exit 0 and `./bin/mstack lint-plugin .` PASSED 0/0. The report states the CI half honestly - `impl_provenance-fixtures-lack-package-json.md:141` reads "**the CI-on-main half is pending**" and its ladder section says "CI on main itself: not yet run, pending push - stated, not claimed", and it records `test-verified` rather than `live-verified` for exactly that reason. That is the honest call.

## Verification I ran

`./bin/mstack gate --full` (tail):

```
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && ./bin/mstack lint-plugin .

PASSED - 0 failures, 1 warning
```

The one warning is `1 uncommitted change(s)`, which is the store's own `current.md`/`state.json`
mid-session, expected at `reviewing`.

`npm test` (the item's verification field, first clause):

```
bun test v1.3.11 (af24e281)
 276 pass
 0 fail
Ran 276 tests across 15 files. [32.78s]
...
ℹ tests 276
ℹ pass 276
ℹ fail 0
NPM_TEST_EXIT=0
```

`npm run typecheck` -> exit 0, no diagnostics. `./bin/mstack lint-plugin .` -> `PASSED - 0 failures, 0 warnings`.

Red-first proof, my own, in an isolated copy of the tree with only the test file swapped to
`main`'s bytes:

```
$ env PATH=$HOME/.nvm/versions/node/v22.6.0/bin:/usr/bin:/bin \
  $HOME/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning \
  --experimental-strip-types --test 'tests/*.test.ts'
EXIT=1
not ok 206 - inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
not ok 208 - every other subcommand run by a foreign copy says so on stderr without changing its result
not ok 211 - a git worktree of the repository is not foreign, at the same commit or any other
not ok 217 - uncommitted src edits are invisible to the committed-tree comparison, as decided
# tests 276
# pass 272
# fail 4
```

with the failure body confirming the cause:

```
  error: 'the agreeing case has nothing to say on stderr'
  expected: ''
  actual: |-
    (node:62832) [MODULE_TYPELESS_PACKAGE_JSON] Warning: file:///private/var/folders/.../T/mstack-prov-cifDhv/src/cli.ts parsed as an ES module because module syntax was detected; to avoid the performance penalty of syntax detection, add "type": "module" to /package.json
```

Same binary, same PATH, post-fix file restored:

```
EXIT=0
ok 206 - inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
ok 208 - every other subcommand run by a foreign copy says so on stderr without changing its result
ok 211 - a git worktree of the repository is not foreign, at the same commit or any other
ok 217 - uncommitted src edits are invisible to the committed-tree comparison, as decided
# tests 276
# pass 276
# fail 0
# duration_ms 15441.693458
```

The two touched files alone, on 22.6.0: `# tests 74 / # pass 74 / # fail 0`, which is where
`current.md`'s "74/74" comes from - checked rather than assumed.

## The copy source

`cpSync(join(ROOT, "package.json"), ...)` / `copyFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), ...)` drags in nothing behavioural. `rg "package\.json" src/ bin/ hooks/` returns zero hits: no code path reads `scripts`, `version`, `name` or `devDependencies` from it, and `version` reads `.claude-plugin/plugin.json` instead (`tests/provenance.test.ts:139`). The only field that matters is `"type": "module"`, which is the point. The path expression is correct from `tests/` on both runtimes - `provenance.test.ts:21` has used the identical `dirname(fileURLToPath(import.meta.url))` since before this diff, and `gate.test.ts`'s new use is green under bun 1.3.11, node 26.7.0 and node 22.6.0.

## Non-blocking notes, not conditions of approval

1. `tests/gate.test.ts:1206` computes `dirname(fileURLToPath(import.meta.url))` inline on every one of the ~7 `checkoutMarkers()` calls, where `tests/provenance.test.ts:21`, `tests/lint.test.ts:12` and `tests/cli.test.ts:12` all hoist a module-level `ROOT`/`PLUGIN` const. Cosmetic drift, worth a hoist next time this file is opened.
2. The sweep is enforced by a comment (`gate.test.ts:1202-1205`, `provenance.test.ts:46-51`), not by a check. A future fixture that copies `src/` *and* executes it would recreate the class silently on 22.6 only. Out of scope for an urgent CI fix; a candidate backlog item.
3. Inventory for the class asked about - assertions of empty stderr on a spawned CLI: `provenance.test.ts:76,111,133,174,235,393`, `cli.test.ts:513,543`, `launcher.test.ts:50,62,69,80`. Only fixtures that execute a *copied* `src/` are exposed, because node resolves the nearest `package.json` from the entry module, not the cwd - which is why `provenance.test.ts:133` and `:235` (real `bin/mstack`, cwd in a package.json-less scratch repo) stayed green even pre-fix in my red run, tests 4 and 8. After this diff exactly one fixture executes copied source, and it carries the file.
4. Copying the *real* package.json rather than a `{"type":"module"}` stub means the fixture inherits `devDependencies` and `scripts` that are not installed there. Inert on bun 1.3.11, node 22.6.0 and node 26.7.0 (all green), and the tradeoff is a recorded decision (`.mstack/decisions.tsv`, 2026-08-22T15:03:19.789Z) whose reason - the fixture tracks the real file as it evolves - is the stronger argument for a fixture whose whole job is faithfulness. Recorded here as a known tradeoff, not a defect.

## Where the claims stopped on the ladder

- The defect, the four test numbers, and red-then-green on v22.6.0: **rung 5** for this review - I ran the failing binary myself on a pre-fix tree and on the post-fix tree.
- "Every real checkout shape carries package.json": **rung 5** - observed in the installed plugin cache and the marketplace clone on this machine, not taken from the report.
- The sweep's completeness: **rung 3-4** - `isMstackCheckout`'s three conditions walked against every fixture builder in `tests/`, and the negative direction confirmed by a green suite. A future builder is not prevented by anything but a comment.
- Both runtimes, typecheck, lint, `gate --full`: **rung 4**, output pasted above from runs at `4dc667dd`.
- **CI green on main: rung 0. Not run, cannot be run before the push.** Acceptance bullet 3 is half-open by construction, the report says so, and this approval carries the same caveat: if the push turns CI red, this verdict was wrong and the item is not closeable on it.
