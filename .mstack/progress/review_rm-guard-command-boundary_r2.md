# Review - rm-guard-command-boundary (round 2)

**Verdict:** APPROVED

Item 12, branch `fix/rm-guard-command-boundary`, head `27eaed7f7d6ccbe96b6e4f0d816f7db9a215ab9e`.
Round-1 report: `.mstack/progress/review_rm-guard-command-boundary.md`. Reviewed by a pass that
did not write the code, in either round.

All three round-1 findings close at the line. I re-derived every number rather than taking one:
my own 736-spelling differential across three revisions, my own 50-case attack on the new depth
tracking, my own mutation run with driver controls, and every claim on the wiki page re-run
through the shipped binary. **Zero false allows introduced against `main`.** The residue below
is three minor notes, none of which is a false allow and none of which this change caused.

## Did the findings close

| Round-1 finding | Closed | Evidence |
|---|---|---|
| 1 - a separator inside `$(...)` or backticks split one command, all five guards missed it | **yes** | 30/30 of my original regressed spellings back to DENY through the shipped binary; the idiom that really deleted a store is denied again; `SUBSTITUTION_DENY` (11 rows, `tests/hooks.test.ts:341-353`) is main=DENY, round-1=allow, round-2=DENY on every row |
| 2 - the module comment claimed a false limit in the unsafe direction | **yes** | `src/hooks.ts:285-330` rewritten, not deleted. Every claim it now makes tested individually below; all hold |
| 3 - the wiki described the pre-segmentation guard | **yes** | `docs/wiki/Gates-and-Hooks.md:25` now cites `src/hooks.ts:230-271`, which lands exactly on `export const GUARDS` and its closing `];`. 16 behavioural claims re-run through the shipped binary, 0 wrong |

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 - only the segment containing the `rm` is judged | `a store name in a later command...`, `tests/hooks.test.ts:361`; `shellSegments cuts where the shell would...`, `:385` | 14/14 `CROSS_SEGMENT_ALLOW` rows allowed through the shipped binary. Two rows are new and pin the depth-tracking over-denial risk directly: `rm -rf $(mktemp -d) && echo .mstack` and its backtick spelling |
| A2 - the four reproduced false positives | `CROSS_SEGMENT_ALLOW` rows 1-4, `:271-283` | Unchanged and still falsifying against `main`'s binary. The row that only documents is now labelled as such at `:286-288`, which was my minor 1 |
| A3 - the named true positives keep denying | `:334` and `:302-321` | 21/21 `DENY`, 13/13 `CROSS_SEGMENT_DENY` through the shipped binary |
| A3 - true positives **not** named by the criterion | `a separator inside a substitution does not end the command that contains it`, `tests/hooks.test.ts:377`; `shellSegments keeps a whole substitution inside one segment`, `:415` | This is the table that did not exist in round 1. 11 rows, every one main=DENY / round-1=allow / round-2=DENY |
| A4 - the limits are stated in the module comment | Prose, `src/hooks.ts:207-220` and `:285-330` | Every claim tested below. The inverted sentence is gone and the incident that disproves it is named at `:296-300` |

## Acceptance, quoted

**"The guard evaluates only the shell segment containing the rm, so a store name in a later && ; or | segment does not deny it"** - **MET**, rung 5. 14/14 `CROSS_SEGMENT_ALLOW` rows allowed through `bin/mstack hook pre-tool-use` as a real process. Of 28 harmless commands I wrote independently of the suite, round-2 denies exactly one - a trailing `#` comment, which `main` and round-1 also deny (minor 1).

**"The four reproduced false positives are covered by tests that fail against the current pattern"** - **MET**, rung 5, unchanged from round 1 and still verified against `main`'s shipped binary.

**"The true positives keep denying: bare store name, nested path, and the glob spellings the current comment names"** - **MET**, rung 5, and now met as a *class* rather than only for the enumerated spellings. 736 destructive spellings (32 destructive bases x 23 wrappers) run through both revisions in process:

```
corpus of destructive spellings: 736
MAIN denied, ROUND-2 allows (false allows introduced): 0
MAIN denied, ROUND-1 allowed (what round 2 had to fix): 210
MAIN allowed, ROUND-2 denies (bypasses closed): 3
bare destructive forms ROUND-2 misses: []
```

**"Where the guard cannot see a deletion at all (an interpreter one-liner, fd -X rm), that limit is stated in the module comment rather than implied away"** - **MET**. The list at `src/hooks.ts:207-220` is unchanged and I re-verified all seven forms are allowed. The `shellSegments` comment now leads with the one-directional rule at `:287-294`, names the incident that proves the asymmetry at `:296-300`, and lists what it does not model with the direction each one fails in at `:316-330`. I tested every one of those claims rather than reading them - table below.

## Verification I ran

```console
$ mstack gate --full
PASSED - 0 failures, 0 warnings

$ npm test
> bun test tests/ && node --test 'tests/*.test.ts'
bun test v1.3.11 (af24e281)
 176 pass
 0 fail
i tests 176
i pass 176
i fail 0

$ npm run typecheck              -> bunx --bun tsc --noEmit, exit 0
$ ./bin/mstack lint-plugin .     -> PASSED - 0 failures, 0 warnings
$ node --test 'tests/hooks.test.ts'   # the item's `verification` field
i tests 22 / i pass 22 / i fail 0

$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
56 relative links checked, 0 broken

$ mstack ledger check rm-guard-command-boundary
FAIL no verdict at 27eaed7f; 2 row(s) exist at other SHAs and a new head SHA voids them
```

Both ledger rows are `live-verified` by `implementer`, at `0c0c24d6` and `739870c4`. Neither is
at head and neither is an approval. I recorded nothing: I am forbidden from touching state, so
the approving row is the orchestrator's to write at `27eaed7f`.

**Every table through the shipped binary**, driven as a real process with real JSON on stdin:

```console
DENY                 21 rows, want DENY  -> all correct through the shipped binary
ALLOW                14 rows, want allow -> all correct through the shipped binary
CROSS_SEGMENT_ALLOW  14 rows, want allow -> all correct through the shipped binary
CROSS_SEGMENT_DENY   13 rows, want DENY  -> all correct through the shipped binary
SUBSTITUTION_DENY    11 rows, want DENY  -> all correct through the shipped binary

SUBSTITUTION_DENY, judged by the three revisions (shipped binaries):
  main=DENY  r1=allow r2=DENY   the idiom that really deleted a store
  main=DENY  r1=allow r2=DENY   && inside a substitution
  main=DENY  r1=allow r2=DENY   the backtick spelling of the same
  main=DENY  r1=allow r2=DENY   a sibling guard, ; inside a substitution
  main=DENY  r1=allow r2=DENY   ; inside a substitution
  main=DENY  r1=allow r2=DENY   a pipe inside a substitution
  main=DENY  r1=allow r2=DENY   a backgrounding & inside a substitution
  main=DENY  r1=allow r2=DENY   a subshell nested inside the substitution
  main=DENY  r1=allow r2=DENY   the branch guard loses its flag the same way
  main=DENY  r1=allow r2=DENY   and so does the gh guard
  main=DENY  r1=allow r2=DENY   an opener with no closer holds the whole line, which denies
```

**My round-1 attack, re-run through the three shipped binaries:**

```console
my original 30 regressed spellings, through the shipped binaries:
  main DENY -> round-1 allow -> round-2 DENY : 30/30
  still allowed by round-2                   : 0/30

$ echo '{...rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack...}' | ./bin/mstack hook pre-tool-use
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"mstack: that would delete the durable state this workflow runs on"}}
$ ... | <round-1>/bin/mstack hook pre-tool-use
                                        (empty - allowed)
```

## Attacking the new depth tracking

This is new code that had never been reviewed, so I treated it the way I treated the round-1
segmentation. 50 adversarial cases across backtick toggling, unbalanced parens, destructive
verbs inside substitutions, newline swallowing, and process substitution. Five came back as
`main` denied / round-2 allows, and I ran all five through real bash before believing any of
them. **None is a real deletion or a real force push:**

```console
$ bash c1.sh    # rm -rf 'a`b' && echo .mstack
+ rm -rf 'a`b'
+ echo .mstack
   -> STORE SURVIVED          # deletes a file literally named a`b; main was over-denying

$ bash c2.sh    # rm -rf $(case x in a) echo .;; esac && pwd)/.mstack
c2.sh: line 3: syntax error near unexpected token `;;'
   -> STORE SURVIVED          # bash closes the substitution at that `)` too - the scanner agrees with bash

$ bash c3.sh    # rm -rf $(awk -F) "{print}" /dev/null && pwd)/.mstack
c3.sh: line 3: syntax error near unexpected token `)'
   -> STORE SURVIVED          # same
```

The other two were `rm -rf $((1+2))x && echo .mstack` (deletes a file named `3x`) and a heredoc body
line, both of which `main` denied and neither of which touches a store. So the answer to "does
an unclosed construct swallow the rest of the line in a way that loses a true positive" is no,
in every spelling I could build:

| Attack | Result |
|---|---|
| nested backticks with the inner pair escaped | DENY - the escape branch eats them before the toggle sees them |
| escaped backtick, literal | DENY |
| backtick inside `'...'` and inside `"..."` | not toggled; the quote branch runs first. Harmless-command relaxation, not a hole |
| odd backtick, rest of line swallowed | DENY - the long direction |
| backtick opened inside `$( )`, unbalanced when the `)` arrives | DENY - `backtick` is still true, so the `&&` after it is still not a separator |
| unclosed `$(`, including across a newline | DENY |
| `)` with no opener at depth 0 | no underflow; falls through to `isSeparator`, which is false for `)` |
| unbalanced `)` inside `$( )` | closes the depth - **and so does bash**, verified above |
| `case` with a `(pat)` pattern, function definition, nested `$( )`, `$((...))`, deep nesting | DENY, all balanced by the `depth > 0` clause |
| `(` or `)` inside quotes inside `$( )` | DENY - quote branch consumes them, depth unaffected |
| destructive verb inside `$( )` or backticks | DENY - the pattern matches anywhere in the segment |
| anchor-sensitive `-f` against `;`, `\|`, `&` at top level | DENY on all three; `main` allowed them. Three bypasses closed |

The `depth > 0` clause at `src/hooks.ts:363` is load-bearing and I could not have guessed it:
without it, the first `)` of `$( (a) && b )` drops the depth to zero and the `&&` splits a
command that has not ended. The comment says exactly that at `:359-361`, and
`tests/hooks.test.ts:349` and `:411` both pin it.

## The comment's claims, each one tested

Finding 2 asked for limits that are true, so I ran them rather than reading them.

| Claim at | Verdict |
|---|---|
| `:318-320` a heredoc body fails long, "nothing is hidden, because each body line is already whole" | **true**. `cat <<EOF` + `rm -rf .mstack` + `EOF` segments to `["cat <<EOF","rm -rf .mstack","EOF"]` and denies |
| `:321-326` `[[ a && b ]]`, `((i && j))` and `case` patterns with `\|` are cut internally, but nothing the guards look for straddles the cut | **true** for all three. `[[ -d .mstack ]] && rm -rf .mstack`, `((i && j)) && rm -rf .mstack` and `case $x in a\|b) rm -rf .mstack;; esac` all still DENY. The only straddle I could construct is a `case` *pattern* literally spelled `rm -rf`, which is not a command |
| `:327-329` the escaped-`>` case fails long | **true**. `rm -rf /tmp/x a\>\|grep .mstack` stays one segment and denies |
| `:313-314` an opener with no closer is the long direction | **true** for `$(` and for a backtick, including across a newline |
| `:386-389` a bare `(` is a subshell and cutting there is right | **true**. `(cd /r && rm -rf .mstack)` segments to `["(cd /r","rm -rf .mstack)"]` and denies |
| `:296-300` the incident: `rm -rf $(cd /r && pwd)/.mstack` was denied un-segmented and allowed by the first segmented scanner, across every rule | **true**, and it is my own round-1 finding stated accurately, including the count of 30 |

## The mutation runs are real

The implementer reported against itself that its first round-2 driver restored with
`git checkout` and so tested unmodified code. I did not check its runs; I ran my own, with two
controls whose whole job is to detect exactly that failure - a no-op edit that **must survive**,
and a total break that **must be killed**. If the driver were not applying edits, the second
control would report SURVIVED and the whole run would be void.

```
SURVIVED  CONTROL no-op (must SURVIVE)                 :: (none)
killed    CONTROL break everything (must be killed)    :: 6 tests
killed    depth never increments                       :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    depth ignores nested paren (drop depth>0)    :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    depth never decrements                       :: a store name in a later command... | shellSegments keeps a whole substitution...
killed    depth not consulted at the separator         :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    backtick never toggles                       :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    backtick not consulted at the separator      :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    opensSubstitution drops $                    :: a separator inside a substitution... | shellSegments keeps a whole substitution...
killed    opensSubstitution drops <                    :: shellSegments keeps a whole substitution inside one segment
killed    opensSubstitution drops >                    :: shellSegments keeps a whole substitution inside one segment
killed    opensSubstitution always true (bare ( counts) :: shellSegments keeps a whole substitution inside one segment
killed    shellSegments returns [command]              :: 3 tests
killed    preToolUse matches whole command             :: a store name in a later command does not deny the rm in an earlier one

restored file identical to committed: true
```

Every branch of the new code is covered, in both directions: `depth never decrements` is killed
by the **allow** test, which is the over-denial risk the two new `$(mktemp -d) && echo` rows
exist for. Round 2 added no test that cannot fail, and weakened none - `git diff` on
`tests/hooks.test.ts` is additions only, plus the three-line comment I asked for on the
documenting row. The process error is recorded against the implementer's own name in
`.mstack/decisions.tsv` at 2026-08-21T08:44:13Z, which is the right place for it.

## The sibling-guard scope question - my answer

**The widening was right.** I said in round 1 it was mine to answer; here is the answer with
the evidence I did not have then.

- It is one call site (`src/hooks.ts:417`), not five. A per-guard `segmented` flag would be
  strictly more code and would make the seventh rule someone adds default to the broken
  behaviour.
- It is a net *security* gain, not only an ergonomics one. Over my 736-spelling corpus the
  widening closes three real bypasses `main` shipped with - `git push origin main -f` followed
  immediately by `;`, `|` or `&`, where `-f(?=\s|$)` failed against the un-segmented line and
  matches against a segment that ends at the separator. A `rm`-only fix delivers none of those.
- It removed four sibling false positives of exactly the kind the item was filed about.
- The risk it carried is now discharged: the four sibling holes round 1 opened are closed, and
  each has a row in `SUBSTITUTION_DENY` so the closure cannot silently regress.
- It is recorded as a decision (`.mstack/decisions.tsv`, 2026-08-21T07:23:48Z) rather than
  slipped in, which is the process this repository asks for.

One bookkeeping consequence for whoever closes the item: the item's title, description and all
four acceptance criteria in `.mstack/state.json` still say `rm`. The shipped behaviour is
wider. That is a note for the closing summary, not a defect in the code, and it is the same
point `reflect_divergent.md` raised in its postscript.

## Minor - none blocking, none introduced by this change

1. `rm -rf /tmp/x  # keep .mstack` is denied. A `#` comment is not a separator, so the store name in
   the comment is in the same segment as the `rm`. `main` and round-1 deny it too, so nothing
   regressed, and it fails **long**, which is the stated safe direction. But `#` is not in the
   "what it does not model" list at `src/hooks.ts:316-330` and it belongs there - it is the
   most likely remaining false positive a real author will hit, which is the harm the item was
   filed about.
2. `src/hooks.ts:287-288` says a construct it cannot model "must leave a segment too **long**,
   never too short", and `:290-291` says too long over-denies. Round 2 is the first revision in
   which a segment can contain a newline, and the guard patterns are `[^\n]*`, so there is now
   one case where too long does **not** over-deny: `rm -rf $(` newline `cd /r` newline `pwd`
   newline `)/.mstack` is a single long segment and is **allowed**, because no `[^\n]*` can reach
   from the verb to the argument. `main` allows it too, so it is not a regression and not a
   blocker - but the headline rule now has an exception and does not say so. One clause.
3. A destructive command *inside* a substitution escapes when its flag sits against a
   separator: `x=$(git push origin main -f;true)` is allowed by `main` and by round-2 alike. The
   guards judge a substitution as text, never as commands of its own. Pre-existing, and closing
   it means recursing into substitutions, which is a bigger change than this item. Worth an
   item if anyone cares; not worth holding this one.

## Where my claims stopped on the evidence ladder

| Claim | Rung |
|---|---|
| Gate, both runtimes, typecheck, lint, doc links green at `27eaed7f` | **5** - run here, pasted above |
| All four acceptance criteria hold | **5** - all 73 table rows driven through the shipped binary as a real process |
| Finding 1 closed; 30/30 of my round-1 regressions back to DENY | **5** - three shipped binaries, plus the store-deleting idiom denied again |
| Zero false allows introduced against `main` | **4** - 736-spelling differential in process. A large sample, not a proof of absence, and I say so |
| The five apparent regressions are not real | **5** - real bash, `set -x`, store survived in every one; two are bash syntax errors |
| Finding 2 closed; every claim in the comment is true | **5** - each claim executed, segments pasted |
| Finding 3 closed; the wiki matches the code | **5** for the 16 behavioural claims and the two line-number citations, which I resolved against the file |
| The round-2 tests are falsifiable and none was weakened | **4** - 12 mutations plus 2 driver controls, all behaving correctly; `git diff` on the test file is additions only |
| The widening to the sibling guards was right | **4** - the three closed bypasses and the four closed holes are measured; the judgement about future rules is mine, not a measurement |
| Minor 3 is pre-existing rather than introduced | **4** - both revisions allow it, checked in process |
