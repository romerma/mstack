# Review - review-budget (item 43), round 4

**Verdict:** APPROVED

Reviewed at `8967dc8`, diff `a3701e4..8967dc8`. Round 3's one blocking finding is fixed: the
spec-size section now sits in its own subsection after the fork narrative, so "The question in
that block" follows the `export-json` block again. The move is exact. The new closing sentence is
true, and the new provenance sentence is true. Gate, lint and links are green. No blocking findings.
Scratch: `/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/review43r4/`
(`$S`). Script `$S/run.sh` (`set -euo pipefail`, checked `cd`) copies round 3's `block.sh`,
`after.sh` and `mnode.sh` into `$S` with their directory rewritten, so round 3's evidence files
are left as they are. Output: `$S/run_out.txt`.

## Check 1: only the page changed, and the move is exact

```
$ git diff --stat a3701e4..8967dc8 -- . ':!.mstack'
 docs/wiki/The-CLI.md | 69 +++++++++++++++++++++++++++-------------------------
 1 file changed, 36 insertions(+), 33 deletions(-)
```

Both versions saved with `git show <sha>:docs/wiki/The-CLI.md` to `$S/old.md` and `$S/new.md`.

- Moved text: old `:364-393` (paragraph and console block) against new `:397-426`. `cmp` finds no
  difference: 30 lines each, both sha1 `ca6a2f181aee2d8f83ac8e5988a48d3a9400b947`.
- The rest of the page: old without `:364-396` against new without `:395-430` (the heading, the
  moved text, the closing sentence and the blank lines around them). `cmp` finds no difference.

So the only text that changed is the closing sentence: old `:394-395` became new `:427-429`, and
the new heading `:395` was added.

## Check 2: read as a new reader, `:341` to `:431`

- **Back-reference.** `:364` "The question in that block is the one `examples/notes-cli` ships"
  comes right after the `export-json` block (`:348-362`). That block holds the question, and its
  item is `3 export-json`, as `:15-17` promise. Round 3's finding 1 is closed.
- **Fork narrative.** It runs in order: the attach block (`:348-362`), the sentence about it
  (`:364-365`), "guarded in **both** directions" and the `cli-search` block (`:367-388`), then
  "Rewriting the fork prose drops `decision_resolved`" (`:390-393`). Nothing in it refers to
  spec size.
- **The new subsection stands by itself.** `### The size of a spec` (`:395`) sits under
  `## state add / list / show / set / active` (`:159`), after `### Size and base` (`:299`), so
  "A spec has a size too" reads against the item sizes introduced there. "The first three" at
  `:427` refers to the block in the same subsection.
- **The closing sentence is true** (`:427-428`): "Each of the first three is run on the item at
  `specifying`; from `spec_ready` the move to `in_progress` is not asked again." Reproduced at
  `8967dc8` on bun (`./bin/mstack`) and on node (`$S/mnode.sh`, the launcher's node line). The
  page's block `:409-424` is identical to the real run in all four runs. The first three moves
  exit 2 and the forced move exits 0. The fourth move, `spec_ready -> in_progress`, exits 0 with
  or without `--force`:

  ```
  IDENTICAL (bun_plain): page lines 409-424 vs real run
  exit codes (bun_plain): 2 2 2 0 0
  IDENTICAL (bun_force): page lines 409-424 vs real run
  exit codes (bun_force): 2 2 2 0 0
  IDENTICAL (node_plain): page lines 409-424 vs real run
  exit codes (node_plain): 2 2 2 0 0
  IDENTICAL (node_force): page lines 409-424 vs real run
  exit codes (node_force): 2 2 2 0 0
  --- fourth move (bun_plain):
  $ mstack state set greet --status in_progress
  1 greet (in_progress)
    status: "spec_ready" -> "in_progress"
  ```

  The sentence names only the move from `spec_ready`. From `blocked` the limit is asked again
  (`$S/after.sh` on the bun_plain store), and the sentence does not claim otherwise. The
  paragraph at `:399` lists `blocked -> in_progress` among the refused moves, which agrees:

  ```
  $ mstack state set greet --status in_progress   # from blocked
  mstack: .mstack/specs/greet/spec.md declares 13 requirements, and a size m item may have 12
          cut the spec to 12 or fewer, or pass --force with --closed-by "<why this many is right>"
  (exit 2)
  ```

  After the block there is one `spec-size` row with item column `"greet"`, and `closed_by` on
  `greet` is `undefined`, as `:404-406` say.
- **"From a scratch store of its own"** (`:428-429`) is true: the block's item is `1 greet`
  (`:422`), while the page's queue gives id 1 to `greet-flag` (`:15`, and every other id line on
  the page, `rg -n '^[0-9]+ [a-z0-9-]+ \('`: `:172 :226 :234 :263 :330`). This is the clause
  round 3's non-blocking 2 asked for. It agrees with `:10-12` ("from one real run in a scratch
  repository ... the repository's own `./bin/mstack`"): the block is still from a real run of
  this checkout's binary in a scratch repository, and the clause says, next to the block, that it
  is a different one. See non-blocking 1.

## Check 3: nothing points at the moved text by position

- `rg -n "The-CLI.md#" docs README.md CHANGELOG.md skills agents` finds three anchors,
  `#gate` (`Gates-and-Hooks.md:499`), `#fanout-plan--check` (`The-Agents.md:199`) and `#cost`
  (`State-Files.md:265`). None names the fork or spec-size subsections.
  `rg "size-of-a-spec|attaching-a-product-fork"` finds nothing.
- Positional words on the page (`above|below|that block|this block|earlier|previous|following`):
  `:10`, `:62`, `:231`, `:274`, `:286`, `:292` ("Size and base" below, which is `:299`, unmoved),
  `:364` (now correct) and `:464`. None of them refers to the spec-size text.
- `CHANGELOG.md:17-21` describes the behaviour and not the page's layout.

## Check 4: gate, lint, links, ledger

- `./bin/mstack version`: `mstack 0.2.1 at /Users/romerma/Code/mstack`.
- `./bin/mstack gate` before this report: `PASSED - 0 failures, 0 warnings` (exit 0). The
  `review-r4` row is `decisions.tsv:244`, item column `review-budget`. The run after this file
  exists is in the handback.
- `./bin/mstack lint-plugin .`: `PASSED - 0 failures, 0 warnings` (exit 0).
- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: `105 relative links checked, 0 broken`
  (exit 0).
- `./bin/mstack ledger check review-budget` before my row:
  `FAIL no verdict at 8967dc89; 6 row(s) exist at other SHAs and a new head SHA voids them`.
  That is expected, because this review records the head row.

## Acceptance (`./bin/mstack state show 43`)

Round 2 found all five bullets met at `16e21ab`. Since then only `docs/wiki/The-CLI.md` has
changed outside `.mstack` (`git diff --stat 16e21ab..8967dc8` covers round 3's diff and check 1).
Bullet 4, **"specifying to spec_ready is refused when spec.md declares more requirements than its
size allows (m 12, l 30) unless forced with a decision row"**, is the one the moved section
documents. It holds in the four runs above for m 12. I did not re-verify the other four bullets.

## Non-blocking

1. `:10-11` still says "one real run", and its only exception is "where a command is shown
   refusing for a documented reason". The spec-size block now says at `:428` that it comes from
   another store. A reader learns that at the block, not at the top. This is the residue of round
   3's non-blocking 2, which is being filed. It is noted here so the filing can decide whether the
   top sentence should list a second kind of exception. It is not a new finding.

## Not checked

- The full suite and typecheck. Round 2 ran them at `16e21ab`, and no code or test has changed
  since (check 1, round 3 check 1).
- `gate --full`. No verification receipt is in scope for a docs round.
- The `l` (30) limit, and the `pending` routes in `:398-399`.
- The rest of the page outside `:341-431`, apart from the provenance lines `:8-17` and the
  positional words listed in check 3.
