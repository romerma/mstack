# Implementation report - intake-followups, round 2 (item 73)

**Verdict:** IMPLEMENTED (self-assessed, rung 4 for the note and the lint rule, rung 3 for the End line and the router phrase). A reviewer that did not write it decides closure.

No mstack plugin was loaded in this session; I played `agents/implementer.md` with `skills/test-first/SKILL.md`. Every CLI call is `./bin/mstack`. Scratch root, called `$I`:
`/private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/impl73r2/` (`streams/` every stream, `projects/` every sandbox, `bin/drive.mjs` the review's wrapper with its scratch path changed, `prompts/`, `red.txt`, `npm.txt`, `npm2.txt`, `clone/` the CM14 mutant, `headplug/` a `git archive 671ba11`). No claude process of mine is left running.

Commits (each `lint-plugin` and `gate` green when made; full suite on the last):

```
3bd4859 docs: align the fork wording in the readme and the seam step in the feature playbook
2fcf9f2 fix(lint): check origin headers in every skill and agent file
0bccb55 fix(router): move a pending item named without intake the way intake ends
836d97f fix(router): carry both halves of the answer rule in the parked fork note
```

## Findings

| Finding | Reproduced | Changed |
|---|---|---|
| B-1 | yes, once here at `671ba11`, and in the review's 3 of 3 | `intake.md:36-42` |
| N-2 | yes, on the real CLI | `intake.md:57-59` |
| N-1 | not re-run at head (review S, n=1, is the repro); the fix is verified | `SKILL.md:23-24` |
| N-4 | by reading | `intake.md:28` |
| N-5 | by reading | `README.md:220-231` |
| N-7 (CM14) | yes, and wider than named: `agents/` was never scanned | `src/lint.ts`, `tests/lint.test.ts` |
| N-11 | by reading, and CLI in the review | `feature.md:18-19` |

### B-1

Repro at the head text (`$I/headplug`, plugin `671ba11`), the review's 3-fork-class request: H2 parked four forks (`streams/H2.jsonl`), then a fresh session `/mstack max-stay-length: yes to 1, a 30-night maximum. I still need to think about the other questions.` wrote a plain row (no `--resolves`) and did **not** re-state the field; `state.json` afterwards still held all four forks, 0 `intake.md` reads, and the note it rewrote says "record ALL four forks in ONE row". That is the review's failure. (My other head run, H1 on the cleaning-fee request, parked one fork only, so "yes to 1" was a full answer and `--resolves` was right; not comparable, I killed it mid-spec.)

Change, `skills/router/references/intake.md:36-42` (the old trailing paragraph, 3 lines plus a blank, was folded in; the file is still 77 lines):

> First write into `current.md`'s Next step the slug, its open forks and both commands below, so a fresh session can act on the note alone. A partial answer: a plain `mstack decide --phase intake --decision "<answers so far>" --why .. --evidence "<their words>" --result "<chosen>"` row with no `--resolves`, then `mstack state set <slug> --decision-required "<only the open forks>"`. The answer to every fork left: the same row with `--resolves <slug>`, its `--decision` listing each answer (`"1) <answer> 2) ..."`). The round is the final message of the turn: stop there.

### N-2

The router's spec path has four triggers; End named two. Real CLI (`$I/cli`):

```
$ state set direct --status in_progress        -> 1 direct (in_progress)        [exit 0]
$ state set spec --status specifying           -> 2 spec (specifying)           [exit 0]
$ state set multi --status in_progress, then --status specifying
mstack: in_progress -> specifying is not a legal transition
        pass --force if you mean to skip a phase, and say why in decisions.tsv   [exit 2]
$ state set fork --status in_progress          -> mstack: fork has an unanswered decision: "1) Q? Recommended: yes."  [exit 2]
$ state set fork --status specifying           -> 4 fork (specifying)           [exit 0]
```

Final wording, `intake.md:57-59`:

> Then choose the path by the triggers in the router's "The two paths" (an answered fork is one): `mstack state set <slug> --status specifying` on the spec path, else `--status in_progress`, which cannot go back to `specifying`. A parked item stays `pending` until answered.

"An answered fork" because my first draft said "a fork is one", which contradicted the last sentence (a parked item stays `pending`). Lifecycle (`src/lifecycle.ts:85-91`) untouched.

### N-1

`skills/router/SKILL.md:23-24`, in the skip list:

> a request that names an existing item (a `pending` one that work starts on moves as intake's End says: `in_progress` or `specifying`),

### N-4, N-5, N-11

- `intake.md:28`: "if it names lost data or **meets** the fork test above, this is a fork, not a row."
- `README.md:220-231`: "prose naming a product fork, a question whose answers change what the product's user can do or get" and "Intake parks the forks it finds with `state add --decision-required`. One that turns up later, usually while `specifying`, is attached with `mstack state set <ref> --decision-required "<the question>"`. Past `specifying` the CLI refuses in both directions ...". Both stale statements gone; paragraphs rewrapped to the file's width.
- `feature.md:18-19`: "`mstack state set <slug> --seam "..." --seam "..."`, every seam in that one call, because `--seam` replaces the list." Also rewrapped the following lines.

### N-7, CM14 (test first)

Test: `tests/lint.test.ts` "an origin header outside the required list that names a missing licence is caught": appends `<!-- Origin: x/y @ abc (MIT, licenses/no-such-LICENSE.txt) -->` to `skills/review/SKILL.md` and to `agents/reviewer.md`, expects a failure naming the licence.

Red, before any `src/lint.ts` change (`$I/red.txt`):

```
AssertionError: header in agents/reviewer.md: expected a failure, got a pass
(fail) an origin header outside the required list that names a missing licence is caught [37.75ms]
 26 pass
 1 fail
```

The skill file case was already green (that half is a guard, not a repro; the mutant below is what makes it coverage). The agent case was a real gap: `lintOrigins` only read `skills/`. Fix: scan `agents/` too (`src/lint.ts`, `lintOrigins`, `files` set). Green: `27 pass 0 fail` for `tests/lint.test.ts`.

CM14 as the review describes it (only `ORIGIN_REQUIRED` files scanned, `const files = new Set<string>()`), applied in a scratch clone (`$I/clone`) with the new test:

```
AssertionError: header in skills/review/SKILL.md: expected a failure, got a pass
(fail) an origin header outside the required list that names a missing licence is caught [18.91ms]
 26 pass
 1 fail
```

Killed. CM6, CM7, CM13 left.

## Live runs (plugin loaded, wrapper as Probe A; `claude-opus-5-5`, `perm=auto`, `plugins=[mstack inline]`)

Runs P1 to P2-rest ran on `836d97f`-equivalent text; I then rewrapped the End paragraph (`intake.md:57-59`, wording of "an answered fork is one") and ran a second full chain F1 on the final text.

### Park

| Run | Prompt | Parked | Status |
|---|---|---|---|
| P1 | `add a $25 cleaning fee to every stay. quote and book should both include it in the total they print.` | 2 forks | pending |
| P2 | `add a maximum stay length so nobody can book a room for too long.` | 3 forks | pending |
| F1 | same as P2, final text | 3 forks | pending |

Notes written to `current.md` (Next step):

```
P1  Item `cleaning-fee` has two open forks awaiting the user:
    1) Discount applies to room subtotal only; fee added after at full price? (recommended: yes)
    2) Existing stored bookings keep their old totals? (recommended: yes)
    Full answer: `mstack decide --phase intake --decision "1) <answer> 2) <answer>" --why "user answered forks" --evidence "<their words>" --result "<chosen>" --resolves cleaning-fee`
    Partial answer: same row without `--resolves`, then `mstack state set cleaning-fee --decision-required "<only the open forks>"`.
    Then resume at router step 4 (feature playbook, spec path since the item had a fork).
P2  On a partial answer:
    `mstack decide --phase intake --decision "<answers so far>" --why .. --evidence "<their words>" --result "<chosen>"`
    then `mstack state set max-stay-length --decision-required "<only the open forks>"`.
    On the full answer: the same decide row with `--resolves max-stay-length` and `--decision "1) .. 2) .. 3) .."`.
    Then resume router step 4 ...: `mstack state set max-stay-length --status specifying`.
F1  Partial answer: mstack decide --phase intake --decision "<answers so far>" ... then mstack state set max-stay-length --decision-required "<open forks only>"
    Full answer: mstack decide --phase intake --decision "1) .. 2) .. 3) .." ... --resolves max-stay-length
    Then: mstack state set max-stay-length --status specifying, branch off main, resume router step 4.
```

Each note carries both halves as commands, which is what the session acted on.

### Partial answers, fresh sessions (no `--resume`)

| Run | Project | Answer text | Plain row | Field re-stated (open forks only) | `--resolves` | `intake.md` reads | Refusal on real CLI |
|---|---|---|---|---|---|---|---|
| P1-partial | P1, 2 forks | `cleaning-fee: yes to 1. I will come back to 2 later.` | yes: `1) yes: discount applies to room subtotal only ...` | yes: only fork 2 | no (the string only appears in the note text it rewrote) | 0 | `mstack: cleaning-fee has an unanswered decision: "2) Should bookings already saved in the JSON file keep their old totals ..."` exit 2, lists fork 2 only |
| P1b-partial | copy of P1 | `cleaning-fee: 2 no, existing bookings should get the fee added too. I have not decided 1 yet.` | yes: `2) No: existing stored bookings get the cleaning fee added too ...` | yes: only fork 1 | no | 0 | `... unanswered decision: "1) Discount applies to room subtotal only; fee added after at full price? (recommended: yes)"` exit 2, lists fork 1 only |
| P2-partial | P2, 3 forks | `max-stay-length: yes to 1, a 30-night maximum. I still need to think about the other questions.` | yes: `1) yes: maximum is 30 nights ... Forks 2 and 3 still open.` | yes: forks 2 and 3 only | no | 0 | `... unanswered decision: "2) Should 'quote' also refuse ... 3) Should bookings already stored ..."` exit 2, lists 2 and 3 only |
| F1-partial (final text) | F1, 3 forks | same as P2-partial | yes: `1) maximum stay is 30 nights, inclusive ...` | yes: `2) ... 3) ...` only | no | 0 | `... unanswered decision: "2) does a quote also refuse stays over 30 nights? (rec: yes) 3) one limit for all room types? (rec: yes)"` exit 2 |

n=3 on the first text (2 parked projects, one differently worded copy), 3/3; plus F1 on the final text, 1/1. No attempt failed, so the note wording was not changed after the runs; nothing to rerun. I checked "`--resolves` used" against the executed commands (the regex `mstack decide[^\n]*--resolves` also matches the note text a session writes to `current.md`, which I excluded by reading each).

Pre-fix comparison, n=1 here (H2-partial at `671ba11`, above) and 0 of 3 in the review: plain row yes, field not re-stated.

### The rest, fresh session

| Run | Prompt | Result |
|---|---|---|
| P2-rest | `max-stay-length: yes to 2 and yes to 3.` | one row with `--resolves max-stay-length`, `--decision "1) 30 nights (already answered) 2) yes: quote also refuses over-max stays 3) yes: stored over-max bookings left untouched"`, `recorded, and max-stay-length no longer has an open fork`, then `state set --status specifying` in the same command; spec-author launch; killed 20 s after |
| F1-rest (final text) | same | one `--resolves` row, `--decision "2) quote also refuses stays over 30 nights; 3) one limit for all room types"` (fork 1 lives in its own earlier plain row), gate green, `specifying` |

### N-1 and N-2, live

N1: item `list-total` seeded by hand as `pending` (`state add`, no seams, no intake; `/mstack continue with list-total`). The session did not guess a status: `git checkout -b feat/list-total && mstack state set list-total --status in_progress --seam "..." --seam "..."` returned `1 list-total (in_progress) / status: "pending" -> "in_progress" / seams: 0 seam(s) replaced with 2` (both seams in one call, as `feature.md` now says), then `mstack:implementer` was launched; killed 20 s after. No `'active' is not a status` in the stream. n=1, and it is a comparison against the review's S, not a controlled pair. The End line's two outcomes on the real CLI: above, under N-2.

## Test tails

```
npm test (both halves) on 3bd4859, no live run going:
 bun:  Ran 553 tests across 26 files. [89.88s]  (553 pass, 0 fail in $I/npm2.txt)
 node: ℹ tests 553 / ℹ pass 553 / ℹ fail 0     (the "[fail] items marked done ..." lines are expected output of fixtures)
bun run typecheck: exit 0
./bin/mstack lint-plugin .: PASSED - 0 failures, 0 warnings
./bin/mstack gate: PASSED - 0 failures, 1 warning
```

## Decisions (recorded with `decide --phase implement`)

1. `src/lint.ts` scans `agents/` as well as `skills/` (the review's CM14 text says "skill or agent file"; agent headers were never read).
2. End says "an answered fork is one" so a parked item still stays `pending` until answered (my first draft contradicted itself).
3. No `intake.md` line grew: the old rule paragraph was folded into the Park paragraph (77 lines).

## Found, not fixed

- The first rest row (P2-rest) restates fork 1 as "(already answered)", the second (F1-rest) lists only 2 and 3; both resolve the field. The rule says `--decision` lists the answers; a session that omits an earlier answer is not refused. Not a regression, left.
- Intake.md was reworded after the P-series runs (only the End paragraph, which no partial-answer run reads); F1 on the final text covers the chain again.
- N-3, N-6, N-8, N-9, N-10 left to the coordinator as asked.
