# impl: provenance-fixtures-lack-package-json (item 25)

Branch `fix/provenance-fixtures-lack-package-json`, fix committed at `471b163e`.

## What changed

The provenance test fixtures stood in for an mstack checkout by copying `bin/`, `src/` and
`.claude-plugin/` into a scratch repo — and nothing else. Every real checkout shape (clone,
worktree, installed plugin cache) also carries `package.json` with `"type": "module"`, so
under node 22.6's `--experimental-strip-types` fallback the fixtures — and only the
fixtures — triggered a `MODULE_TYPELESS_PACKAGE_JSON` warning on stderr, failing the four
tests that assert stderr empty (or assert a specific stderr the warning pollutes). The fix
makes the fixtures faithful: both builders that assemble something `isMstackCheckout`
accepts now copy the repository's real `package.json` (a byte copy of the actual file, not
a stub, so the fixture tracks the file as it evolves). No `src/` change, no warning
suppression — a real typeless tree still warns, as it should. The two builders do not share
a copy list (one byte-copies the real tree, the other writes in-process stubs), so there
was nothing to factor.

## Builder sweep

Every place in `tests/` that assembles a checkout-shaped fixture (searched for `cpSync`,
`copyFileSync`, writes of `bin/mstack`, `src/cli.ts`, `.claude-plugin/plugin.json` across
all 15 test files):

| Builder | Accepted by `isMstackCheckout`? | Action |
|---|---|---|
| `tests/provenance.test.ts` `scratchCheckout()` (was line 50) | yes — the four failures' fixture | **fixed**: `cpSync(join(ROOT, "package.json"), ...)` at tests/provenance.test.ts:61 |
| `tests/provenance.test.ts` wrapper-repo inline (now line 224) | no — deliberately manifest-less, a user's repo | already faithful, untouched |
| `tests/provenance.test.ts` fifo-manifest inline (now line 302) | no — fifo fails `statSync().isFile()` by design | already faithful, untouched |
| `tests/gate.test.ts` `checkoutMarkers()` (line 1198) | yes, with the default manifest | **fixed**: copies the real `package.json` at tests/gate.test.ts:1206 |
| `tests/gate.test.ts` manifest-shapes installs (lines ~1316-1327) | no — wrong-name/unparseable/null/directory manifests by design | built on `checkoutMarkers`, so they inherit the copy; otherwise untouched |
| `tests/lint.test.ts` `copy()` (line 14) | no — copies no `bin/`, so the first guard in `src/paths.ts:111` refuses it; nothing executes it as a module either | already outside the class, untouched |

`tests/cli.test.ts`, `tests/decisions.test.ts`, `tests/launcher.test.ts` reference the
repository's own `bin/mstack` (which runs from the real, package.json-carrying tree) and
build plain scratch repos, never checkout shapes — untouched. The sweep did not turn up any
reason to touch `src/`; the shipped code is correct.

## Files

- `tests/provenance.test.ts` — `scratchCheckout()` copies the real `package.json` (line 61); builder doc comment says why
- `tests/gate.test.ts` — `checkoutMarkers()` copies the real `package.json` (line 1206); imports `copyFileSync`, `dirname`, `fileURLToPath`
- `.mstack/progress/current.md`, `.mstack/decisions.tsv`, `.mstack/state.json` — store bookkeeping
- `.mstack/progress/impl_provenance-fixtures-lack-package-json.md` — this report

## Commands

Red, before the fix, on the real binary `~/.nvm/versions/node/v22.6.0/bin/node` (v22.6.0)
with a bun-free PATH — the exact four CI failures from run 32526687400:

```
$ PATH=~/.nvm/versions/node/v22.6.0/bin:/usr/bin:/bin \
  ~/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning \
  --experimental-strip-types --test tests/provenance.test.ts
not ok 1 - inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
  ---
  location: '/Users/romerma/Code/mstack/tests/provenance.test.ts:63:1'
  error: 'the agreeing case has nothing to say on stderr'
  expected: ''
  actual: |-
    (node:38464) [MODULE_TYPELESS_PACKAGE_JSON] Warning: file:///private/var/folders/r1/cn30880j4jl1k4dg_fpj62mw0000gn/T/mstack-prov-RIvLsa/src/cli.ts parsed as an ES module because module syntax was detected; to avoid the performance penalty of syntax detection, add "type": "module" to /package.json
    (Use `node --trace-warnings ...` to show where the warning was created)
  ...
not ok 3 - every other subcommand run by a foreign copy says so on stderr without changing its result
not ok 6 - a git worktree of the repository is not foreign, at the same commit or any other
not ok 12 - uncommitted src edits are invisible to the committed-tree comparison, as decided
  ---
  error: |-
    a note fired on a same-committed-tree sibling: (node:38935) [MODULE_TYPELESS_PACKAGE_JSON] Warning: ...
# tests 12
# pass 8
# fail 4
```

Green, after the fix, same binary, same PATH, same file:

```
$ PATH=~/.nvm/versions/node/v22.6.0/bin:/usr/bin:/bin \
  ~/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning \
  --experimental-strip-types --test tests/provenance.test.ts
ok 1 - inside a checkout, the checkout's own bin/mstack stays green and says which copy ran
ok 3 - every other subcommand run by a foreign copy says so on stderr without changing its result
ok 6 - a git worktree of the repository is not foreign, at the same commit or any other
ok 12 - uncommitted src edits are invisible to the committed-tree comparison, as decided
# tests 12
# pass 12
# fail 0
(exit 0)
```

The full suite under the exact oldest-node CI incantation, same binary and PATH:

```
$ PATH=~/.nvm/versions/node/v22.6.0/bin:/usr/bin:/bin \
  ~/.nvm/versions/node/v22.6.0/bin/node --disable-warning=ExperimentalWarning \
  --experimental-strip-types --test 'tests/*.test.ts'
# tests 276
# suites 0
# pass 276
# fail 0
# cancelled 0
# skipped 0
# duration_ms 13685.810167
(exit 0)
```

`npm test` on both runtimes (bun 1.x, then the default node 26 via `node --test`):

```
$ npm test
 276 pass
 0 fail
Ran 276 tests across 15 files. [32.59s]
...
ℹ tests 276
ℹ pass 276
ℹ fail 0
(exit 0)
```

The item's verification field, remaining halves:

```
$ npm run typecheck
> mstack@0.1.0 typecheck
> bunx --bun tsc --noEmit

$ ./bin/mstack lint-plugin .
-- single source of truth
[ok]    the lifecycle enum appears only in src/lifecycle.ts

PASSED - 0 failures, 0 warnings
```

## R to test

| Acceptance bullet | Test | Where |
|---|---|---|
| 1. Four failing tests red under real node 22.6.0 before, green after, on that binary | the four themselves, run on `~/.nvm/versions/node/v22.6.0/bin/node`; transcripts above | tests/provenance.test.ts:70, tests/provenance.test.ts:99, tests/provenance.test.ts:157, tests/provenance.test.ts:361 |
| 2. Every checkout stand-in fixture carries package.json, found by sweep | both accepted builders copy the real file; the sweep table above lists all six and why the other four stay | tests/provenance.test.ts:61, tests/gate.test.ts:1206 |
| 3. npm test green on both runtimes locally; CI green on main after push | local half done (transcripts above, both runtimes plus the CI incantation on 22.6.0); **the CI-on-main half is pending** — it can only run after review and push, and this report does not claim it | n/a until push |

## Evidence ladder

- The defect and the fix on node 22.6.0: rung 4 for this report (the exact failing binary,
  red then green, pasted). CI on main itself: not yet run, pending push — stated, not claimed.
- Both-runtimes green, typecheck, lint: rung 4, output pasted from real runs at `471b163e`.
- Verdict recorded as `test-verified`: the fix is proven by tests on the real runtime, but
  the surface the defect lives on (CI on main) has not executed it yet, so not `live-verified`.
