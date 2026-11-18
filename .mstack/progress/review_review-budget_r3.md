# Review - review-budget (item 43), round 3

**Verdict:** CHANGES_REQUESTED

Reviewed at `a3701e4`, diff `16e21ab..a3701e4`. Round 2's blocking finding is fixed: the console
block reproduces character for character, in the order shown, on bun and on node, and the sentence
added under it is true. One blocking finding remains. It is not in the round 3 diff. Item 43's
insertion of the spec-size section (commit `ca57acd`) left a back-reference on the same page
pointing at the wrong block, and neither earlier round raised it. The fix is one line.
Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review43r3/`
(`$S` below). Scripts: `$S/block.sh`, `$S/compare.sh`, `$S/all.sh`, `$S/after.sh`; output in
`$S/block_*.txt`, `$S/fourth_*.txt`, `$S/codes_*.txt`.

## Changes required (blocking)

1. **`docs/wiki/The-CLI.md:397-398` now describes the wrong block.** The text reads: "The question in that block is the one
   `examples/notes-cli` ships, character for character, which is what the promise at the top of
   this page is worth: same item, same id, same fork." At `362536f` (item 43's base) this sentence
   came straight after the `export-json` block (`git show 362536f:docs/wiki/The-CLI.md`, lines
   356-359). Commit `ca57acd` put the spec-size paragraph, its block and (in round 3) the sentence
   below it at `:364-395`, between the two. "That block" is now the `greet` block. That block has
   no question. Its item is `1 greet`, and `examples/notes-cli` has no `greet`
   (`rg -c greet examples/notes-cli` finds nothing; the question is in
   `examples/notes-cli/.mstack/state.json:55`, item `export-json`). The page's own scratch queue
   gives id 1 to `greet-flag` (`:14-17`). Read where it stands, the sentence is false about the
   block it follows, in a file this change touched. Fix: either move `:364-395` to the end of the
   `state set` section, after "would let the next fork be born answered." (`:425`), so the fork
   narrative (`:353-425`) is not cut in two; or change "that block" to "the `export-json` block
   above". The move is the better fix, because `:400` ("`spec_ready` and beyond is now guarded in
   **both** directions ... with a fork unanswered") also continues the fork section, not the
   spec-size one.

## Round 2's blocking finding: fixed

Round 2 found `state set greet --status in_progress --force` shown refused after the forced move
to `spec_ready`, a command that exits 0 in that order. Round 3 moves it before the forced move
(`:384-386`) and adds `:394-395`.

## Check 1: the diff touches one file

```
$ git diff --stat 16e21ab..a3701e4 -- . ':!.mstack'
 docs/wiki/The-CLI.md | 11 +++++++----
 1 file changed, 7 insertions(+), 4 deletions(-)
```

## Check 2: the block, reproduced

`$S/block.sh <name> <bun|node> <plain|force>` builds a fresh git repo and runs `setup`. It adds
`greet` as sdd and moves it to `specifying`, writes proposal/design/tasks and a 13-requirement
`spec.md` (round 2's recipe), and commits. It then runs the four commands in the page's order,
printing each line as the page types it (the `--closed-by` argument in quotes). `$S/compare.sh`
diffs page lines 376-391 (`bat -r 376:391`) against that output. Bun is `./bin/mstack` (bun is
first on PATH). Node is `$S/mnode.sh`, which execs
`node --disable-warning=ExperimentalWarning --experimental-strip-types src/cli.ts`, the launcher's
node line.

```
=== bun_plain
IDENTICAL (bun_plain): page lines 376-391 vs real run
exit codes (bun_plain): 2 2 2 0 0
=== bun_force
IDENTICAL (bun_force): page lines 376-391 vs real run
exit codes (bun_force): 2 2 2 0 0
=== node_plain
IDENTICAL (node_plain): page lines 376-391 vs real run
exit codes (node_plain): 2 2 2 0 0
=== node_force
IDENTICAL (node_force): page lines 376-391 vs real run
exit codes (node_force): 2 2 2 0 0
```

The run (`$S/block_bun_plain.txt`; `diff -u` against the page prints nothing):

```console
$ mstack state set greet --status spec_ready
mstack: .mstack/specs/greet/spec.md declares 13 requirements, and a size m item may have 12
        cut the spec to 12 or fewer, or pass --force with --closed-by "<why this many is right>"

$ mstack state set greet --status spec_ready --force
mstack: --force would move greet to spec_ready past the 12 requirement limit, and that has to be on the record
        add --closed-by "<why this many is right>"; it is written to decisions.tsv as a spec-size row

$ mstack state set greet --status in_progress --force
mstack: --force would move greet to in_progress past the 12 requirement limit, and that has to be on the record
        add --closed-by "<why this many is right>"; it is written to decisions.tsv as a spec-size row

$ mstack state set greet --status spec_ready --force --closed-by "the 13 parts ship as one release and cannot be split"
1 greet (spec_ready)
  forced: greet has 13 requirements, over the 12 a size m item may have; the reason is recorded as a spec-size decision row
  status: "specifying" -> "spec_ready"
```

The exit codes are what the page implies: the three `mstack:` refusals exit 2 and the forced move
exits 0. The forced move's own line `status: "specifying" -> "spec_ready"` shows that the three
refusals left the item at `specifying`. After the block there is exactly one `spec-size` row, so
the refusals wrote none.

**The sentence at `:394-395` is true.** Here is the fourth move, run after the block, without and with
`--force` (output from `$S/fourth_*.txt`, exit codes the last entry of `$S/codes_*.txt`; same on node):

```console
$ mstack state set greet --status in_progress
1 greet (in_progress)
  status: "spec_ready" -> "in_progress"
  base: (unset) -> "5fe6bb3729d1e2cee59c33b17037d56e29778b7f"
(exit 0)

$ mstack state set greet --status in_progress --force
1 greet (in_progress)
  status: "spec_ready" -> "in_progress"
  base: (unset) -> "b0fb1a6505ed0bbadf2f4828379907011efad774"
(exit 0)
```

## Check 3: the paragraph above and the CHANGELOG

- `:364-366`: "every other move that lands an sdd item at or past `spec_ready` from before it
  (`specifying -> in_progress` and `pending -> spec_ready` with `--force`, ...)". The block's third
  command is `specifying -> in_progress --force`, refused. `spec_ready -> in_progress` does not
  start before `spec_ready`, so `:394-395` agrees with it.
- `:370-373`: "`--force` alone is refused too ... with both the item moves and the reason is
  written as a `spec-size` decision row (item column set) ... an open item does not get a
  `closed_by`". From `$S/after.sh` on the bun store: `closed_by on greet: undefined`, and the row's
  last column is `"greet"`. The row is
  `spec-size	the 13 parts ship as one release and cannot be split	greet declares 13 requirements, over the 12 a size m item may have; moved to spec_ready with --force	.mstack/specs/greet/spec.md	forced past the limit		greet`.
- `CHANGELOG.md:17-21` says the same: refused "when `spec.md` declares more requirements than the
  size allows ... unless `--force` carries a `--closed-by` reason, which is recorded as a
  `spec-size` row and nowhere else (an open item gets no `closed_by`)". The reordered block does
  not contradict it.

## Check 4: gate, lint, links

- `./bin/mstack gate` before the report: `PASSED - 0 failures, 0 warnings` (exit 0). The
  `review-r3` row is `decisions.tsv:243`, item column `review-budget`. The run after the report is
  written is in the handback, not here, because it has to run after this file exists.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings` (exit 0).
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md` (the command in `CONTRIBUTING.md:22`):
  `105 relative links checked, 0 broken` (exit 0).
- `./bin/mstack ledger check review-budget` before my row:
  `FAIL no verdict at a3701e45; 5 row(s) exist at other SHAs and a new head SHA voids them`.
  That is expected, since this review records the head row.

## Acceptance (`./bin/mstack state show 43`)

Round 2 found all five met at `16e21ab`. Since then only `docs/wiki/The-CLI.md` changed outside
`.mstack` (check 1), so no code or test changed. Bullet 4, "specifying to spec_ready is refused
when spec.md declares more requirements than its size allows (m 12, l 30) unless forced with a
decision row", is the one the page documents, and it holds in the run above for m 12. I did not
re-verify the other four bullets.

## Non-blocking

1. **A pointer for round 2's non-blocking 5 (not re-raised).** `:394-395` says the limit "has been
   answered" once the item is at `spec_ready`. That is true for the move it names. From `blocked`
   the limit is asked again (`$S/after.sh`: `blocked -> in_progress` exits 2 with "cut the spec to
   12 or fewer, or pass --force ..."). Whoever files NB5 should name this sentence too, so it is
   reworded or kept in step when that behaviour changes.
2. **`:10-11` says every block is "from one real run in a scratch repository".** The spec-size
   block is from a different store: its id 1 is `greet`, where the page's queue has `greet-flag`
   (`:15`). A clause saying the block runs in its own store would make that honest. If finding 1 is
   fixed by moving the section, the clause can go with it.

## Not checked

- The full suite and typecheck. Round 2 ran them at `16e21ab`, and no code or test changed.
- `gate --full`. No verification receipt is in scope for a docs round.
- The `l` (30) limit, the `pending` and `blocked` routes in `:365-366` beyond the one `blocked`
  probe above, and the rest of the page outside `:353-425`.
- Mutation testing. Round 2's X3/X4 results stand as reported.
