# Review - rm-guard-command-boundary

**Verdict:** CHANGES_REQUESTED

Item 12, branch `fix/rm-guard-command-boundary`, head `b99857b2d0f91f820f99e995b8d4f69e0024055b`.
Reviewed by a pass that did not write the code.

The gate is green, both runtimes are green, and criteria 1-3 hold on their own terms. The
change is blocked on one thing: it introduces a false *allow* on commands the old code denied,
across all five segmented guards, and the module comment affirmatively claims that this class
of error cannot happen. That is criterion 4 failing in the exact direction criterion 4 exists
to prevent.

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 - only the segment containing the `rm` is judged | `a store name in a later command does not deny the rm in an earlier one`, `tests/hooks.test.ts:326`; `shellSegments cuts where the shell would and nowhere else`, `:342` | 12/12 `CROSS_SEGMENT_ALLOW` rows allowed by the shipped binary; the **old** binary denies 11 of the 12, so the rows really are falsifying. Mutation `shellSegments -> [command]` turns both tests red |
| A2 - the four reproduced false positives are covered | `CROSS_SEGMENT_ALLOW` rows 1-4, `tests/hooks.test.ts:271-283` | Each of the four is denied by `main`'s binary and allowed by the branch's. Rows: `--evidence` flag value, `;` + `echo`, pipe + `grep`, commit message |
| A3 - the named true positives keep denying | `segmenting the command does not let a real deletion of the store through`, `:334`, rows `:303-:307`; pre-existing `DENY` table `:207` asserted at `:253` | 21/21 `DENY` and 13/13 `CROSS_SEGMENT_DENY` still deny through the shipped binary. A 440-spelling differential fuzz over non-substitution forms found **0** regressions and 3 closed bypasses |
| A3 - true positives *not* named by the criterion | **NO TEST** | `tests/hooks.test.ts` contains zero occurrences of `$(`. 30/30 substitution-with-separator spellings regressed from DENY to allow, undetected by the suite. Finding 1 |
| A4 - the limits are stated in the module comment | Prose, `src/hooks.ts:207-220` | The seven forms the comment names really are allowed - verified through both binaries. But `src/hooks.ts:296-297` states a *false* limit in the unsafe direction. Finding 2 |

## Acceptance, quoted

**"The guard evaluates only the shell segment containing the rm, so a store name in a later && ; or | segment does not deny it"** - **MET**, rung 5. `preToolUse` at `src/hooks.ts:354-355` calls `shellSegments` and matches each piece. Driven through the shipped `bin/mstack hook pre-tool-use` as a real process with real JSON on stdin, all 12 `CROSS_SEGMENT_ALLOW` rows (`tests/hooks.test.ts:271-295`) are allowed; `main`'s binary denies 11 of them.

**"The four reproduced false positives are covered by tests that fail against the current pattern"** - **MET**, rung 5. Rows 1-4 at `tests/hooks.test.ts:271-283`. Each was run through `main`'s shipped binary and each is denied there, so each row would fail against the pre-change pattern. Mutating `shellSegments` to return `[command]` turns `tests/hooks.test.ts:326` red on 11 of 12 rows. Row 6 (`rm -rf /tmp/x &` then a newline then `echo .mstack`) is the exception: `main` already allowed it, because the old `[^\n]*` could not cross a newline anyway. It documents rather than falsifies - minor 1.

**"The true positives keep denying: bare store name, nested path, and the glob spellings the current comment names"** - **MET as literally written**, rung 5, and **broken as a class**. The three enumerated spellings plus `.mstac?` and `.msta*` all still deny through the shipped binary (`tests/hooks.test.ts:303-307`), and 21/21 pre-existing `DENY` rows still deny. A 440-row differential fuzz over destructive spellings wrapped twenty different ways found zero regressions. But a true positive the criterion does not enumerate now passes: `rm -rf $(...)/.mstack` where the substitution holds a separator. Finding 1.

**"Where the guard cannot see a deletion at all (an interpreter one-liner, fd -X rm), that limit is stated in the module comment rather than implied away"** - **NOT MET**. The list at `src/hooks.ts:207-220` is accurate: I ran all seven named forms through both binaries and all seven are allowed by both. The failure is the sentence at `src/hooks.ts:296-297`:

> Everything it still gets wrong - `$(...)` holding a separator, a heredoc - it gets wrong by leaving a segment too long, which denies rather than allows.

That is inverted. `$(...)` holding a separator leaves segments too **short**:

```
shellSegments("rm -rf $(cd /r && pwd)/.mstack")  ->  ["rm -rf $(cd /r", "pwd)/.mstack"]
```

so it **allows rather than denies**. The one new limit this change creates is the one the
comment says does not exist. The implementer flagged this claim as rung 3 in
`impl_rm-guard-command-boundary.md` ("Walked, not tested ... a reviewer who wants it at rung 4
should say so"). I took it to rung 5 and it is false.

## Verification I ran

```console
$ mstack gate --full
[ok]    17 skills and agents, every cross-reference in 37 file(s) resolves
[ok]    the lifecycle enum appears only in src/lifecycle.ts
PASSED - 0 failures, 0 warnings

$ npm test
> bun test tests/ && node --test 'tests/*.test.ts'
bun test v1.3.11 (af24e281)
 174 pass
 0 fail
i tests 174
i pass 174
i fail 0

$ npm run typecheck             -> bunx --bun tsc --noEmit, exit 0
$ ./bin/mstack lint-plugin .    -> PASSED - 0 failures, 0 warnings

$ node --test 'tests/hooks.test.ts'      # the item's `verification` field
i tests 20
i pass 20
i fail 0

$ mstack ledger check rm-guard-command-boundary
FAIL no verdict at b99857b2; 1 row(s) exist at other SHAs and a new head SHA voids them
```

The one ledger row is `rm-guard-command-boundary  0c0c24d6...  live-verified  ...  implementer`:
the implementer's own row on the implementer's own evidence, recorded two commits before head.
It is not an approval and nothing carries over. I recorded no row of my own - the verdict is
CHANGES_REQUESTED and I am forbidden from touching state.

Every row of every guard table, through the shipped binary as a real process
(`echo '{"tool_name":"Bash","tool_input":{"command":"..."}}' | ./bin/mstack hook pre-tool-use`):

```console
DENY                 21 rows, want DENY -> all correct
ALLOW                14 rows, want allow -> all correct
CROSS_SEGMENT_ALLOW  12 rows, want allow -> all correct
CROSS_SEGMENT_DENY   13 rows, want DENY -> all correct
```

**Mutation testing.** Eleven independent mutations of the new code in a detached worktree, each
run against `node --test tests/hooks.test.ts`. All eleven killed; no unfalsifiable check found:

```
killed  shellSegments returns [command]  :: a store name in a later command... | shellSegments cuts where...
killed  preToolUse matches whole command :: a store name in a later command does not deny the rm in an earlier one
killed  drop ; separator                 :: a store name in a later command... | shellSegments cuts where...
killed  drop newline separator           :: shellSegments cuts where the shell would and nowhere else
killed  drop pipe separator              :: a store name in a later command... | shellSegments cuts where...
killed  drop & separator                 :: a store name in a later command... | shellSegments cuts where...
killed  drop quote tracking              :: segmenting the command does not let a real deletion... | shellSegments cuts where...
killed  drop backslash escape            :: shellSegments cuts where the shell would and nowhere else
killed  drop >& and >pipe exemption      :: segmenting the command does not let a real deletion... | shellSegments cuts where...
killed  drop &> exemption                :: shellSegments cuts where the shell would and nowhere else
killed  drop trim/empty filter           :: shellSegments cuts where the shell would and nowhere else
```

**Differential fuzz, old revision vs new.** 22 genuinely destructive commands x 20 wrappers
(`cd X &&`, `; echo`, `| tee`, `2>&1`, `&> log`, `>| out`, trailing `&`, `|| true`, newline,
`{ ...; }`, `bash -c "..."`, `bash -c '...'`, `for`, `if`, `# comment`, `nohup`, ...):

```
corpus: 440 destructive spellings
OLD denied, NEW allows (false allows introduced): 0
OLD allowed, NEW denies (bypasses closed): 3
  "git push origin main -f" inside { ; }, for-do-done, and if-then-fi
```

The `&`-of-`2>&1` reasoning at `src/hooks.ts:332-342` holds. I probed `2>&1`, `&>`, `&>>`,
`>|`, `<&3`, `|&`, `cmd & >out cmd2`, `a \&& b` and `a >&& b`; the exemption fires only when the
character is immediately adjacent to the redirection operator, which is exactly where bash also
refuses to see a separator. No hole from that decision.

## Changes required

### 1. `src/hooks.ts:299-330` (BLOCKING) - a separator inside `$(...)` or backticks splits one shell command in half, and every guard then misses it

`shellSegments` does not track command substitution, so a separator inside `$(...)`,
backticks, `<(...)` or `$((...))` cuts a single shell command into two fragments. The verb
lands in one fragment and its argument in the other, and no guard matches either.

Proven at rung 5 against the shipped binary, and proven at rung 5 that the allowed command
really does delete a real store:

```console
$ cat a.sh
cd "$1"
set -x
rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack

$ bash a.sh .../scratchpad/s2/repo
++ git rev-parse --show-toplevel
++ echo .
+ rm -rf ./.mstack
STORE DELETED BY THE ALLOWED COMMAND

$ echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack"}}' | ./bin/mstack hook pre-tool-use
                                       # empty output - ALLOWED

$ ... | <main-worktree>/bin/mstack hook pre-tool-use
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"mstack: that would delete the durable state this workflow runs on"}}
```

It is not confined to the `rm` rule. All five segmented guards lose their true positive the
same way; 30/30 spellings regressed from DENY to allow:

```
REGRESSION  "rm -rf $(cd /r && pwd)/.mstack"
REGRESSION  "git push origin $(cd /r && pwd) --force"
REGRESSION  "git push origin $(cd /r && pwd) -f"
REGRESSION  "git branch $(cd /r && pwd) -D feature"
REGRESSION  "gh pr merge $(cd /r && pwd) --admin"
   ... the same five for  $(cd /r ; pwd),  $(ls /r | head -1),
       $(git rev-parse --show-toplevel 2>/dev/null || echo .),
       backtick `cd /r && pwd`,  and  $(a & wait)
30/30 substitution-with-separator spellings regressed from DENY to allow
```

The expansion is real, not theoretical:

```console
$ set -x; echo git push origin $(echo main; true) --force
++ echo main
++ true
+ echo git push origin main --force
git push origin main --force
```

Two of these are everyday idioms rather than contrivances:
`rm -rf $(git rev-parse --show-toplevel 2>/dev/null || echo .)/.mstack` and `git push origin $(...) --force`.
The force-push one is the worse of the two, because the four sibling guards were segmented as a
side effect of this item (`.mstack/decisions.tsv`, 2026-08-21T07:23:48). This diff therefore
*created* four of the five holes. I agree with that decision row's reasoning about code shape;
it does not survive the widening also opening four false allows the item never asked for.

**What would satisfy me:** `shellSegments` tracks substitution depth and refuses to split while
inside one. Increment on `$(`, `<(`, `>(` and on an opening backtick; decrement on the matching
`)` or closing backtick; count `$((` as depth too. While depth > 0, no character is a
separator. That fails in the direction `src/hooks.ts:296-297` already promises - the segment
stays too long, so a substitution holding a separator denies rather than allows - and costs at
most a recoverable false denial on `rm -rf /tmp/x $(a && b)`. Roughly six lines, no parser, no
dependency, `node:` builtins untouched.

A smaller alternative: when the command contains `$(`, a backtick or `<(`, evaluate the guards
against the whole command string *as well as* the segments. That provably cannot regress
anything `main` caught, at the cost of keeping the old false positives on the subset of lines
that contain a substitution.

Either way it needs rows in `CROSS_SEGMENT_DENY` (`tests/hooks.test.ts:302-321`). The file has
zero occurrences of `$(` today, which is exactly why the suite is green on a live false allow.
At minimum: `rm -rf $(cd /r && pwd)/.mstack`, the backtick spelling of the same, and one sibling row
such as `git push origin $(echo main; true) --force`.

### 2. `src/hooks.ts:296-297` (BLOCKING, and it is acceptance criterion 4) - the stated limit is false in the unsafe direction

> Everything it still gets wrong - `$(...)` holding a separator, a heredoc - it gets wrong by leaving a segment too long, which denies rather than allows.

Both named constructs make segments **shorter**, not longer:

```
shellSegments("rm -rf $(cd /r && pwd)/.mstack")   -> ["rm -rf $(cd /r", "pwd)/.mstack"]
shellSegments("rm -rf `cd /r && pwd`/.mstack")    -> ["rm -rf `cd /r", "pwd`/.mstack"]
shellSegments("cat <<EOF" \n "rm -rf /tmp/x && echo .mstack" \n "EOF")
                                            -> ["cat <<EOF", "rm -rf /tmp/x", "echo .mstack", "EOF"]
```

Criterion 4 asks for limits "stated in the module comment rather than implied away". This
sentence implies away the only limit the change introduces, and it is the sentence a future
reader will trust when deciding whether a new rule is safe to add to the array. The list at
`src/hooks.ts:207-220` is good work and I verified every entry in it at rung 5; this one
sentence undoes it.

**What would satisfy me:** if finding 1 is fixed by depth tracking, the sentence becomes true
and needs only `<(` and `$((` added to the honest list. If finding 1 is fixed another way, the
sentence must name which constructs shorten a segment and say that a shortened segment allows.
Do not delete the sentence - the criterion asks for the limit to be stated, not omitted.

### 3. `docs/wiki/Gates-and-Hooks.md:25` and `:42-48` (non-blocking, but it ships with this change) - the page still describes the pre-change guard

- `:25` cites "The guard list, from `src/hooks.ts:205-243`". That range was exactly the `GUARDS`
  array at `main`; after this diff `GUARDS` is `src/hooks.ts:230-271` and 205-243 lands in the
  middle of the module doc comment.
- `:42` says "The guards themselves are regexes over the command string, not a shell parser",
  and `:47-48` justifies the false-positive cost with the `echo "do not git push --force"` example.
  Both sentences were rewritten in the source (`src/hooks.ts:190-205`) and neither was updated
  here. As shipped, the page tells a reader that `git push origin main && echo '... --force'` is
  denied. It is not. `CONTRIBUTING.md:43-44` is the rule this crosses.

## Minor

1. `tests/hooks.test.ts:284` - the row `rm -rf /tmp/x &` + newline + `echo .mstack` ("the store named
   on the next line") is the one `CROSS_SEGMENT_ALLOW` row `main` also allows, because the old
   `[^\n]*` could not cross a newline. It cannot fail against the pre-change pattern, so it
   documents rather than covers. Harmless, but do not count it toward criterion 2.
2. `src/hooks.ts:333-343` - `isSeparator` re-indexes the raw `command` string, so it cannot see
   that a preceding `>` was itself backslash-escaped: `cmd a\>|grep x` is read as a `>|`
   redirect and not split. The error leaves the segment too long, so it denies rather than
   allows. Noted only because it is the one place the scanner's two views of the string
   disagree.
3. `src/hooks.ts:349-353` - "Five of the six patterns above carry the same `[^\n]*` shape" is
   arithmetically right but reads as if the sixth is one of the five; the next sentence then
   names `git reset --hard` as the exception. One clause would remove the double-take.
4. `shellSegments` is exported solely so `tests/hooks.test.ts:342` can assert on it. Reasonable
   here - the cut points are the contract - but it is new public surface on the hooks module
   and worth a line saying why.

## Where my claims stopped on the evidence ladder

| Claim | Rung |
|---|---|
| Gate, both runtimes, typecheck and lint green at `b99857b2` | **5** - run here, output pasted above |
| Criteria 1, 2 and 3 hold on their stated terms | **5** - all 60 table rows driven through the shipped binary as a real process |
| The new tests are falsifiable | **4** - 11 mutations, all killed, each by a named test |
| Finding 1 is a real false allow that `main` caught | **5** - shipped binary on both revisions, a real store directory really deleted by the allowed command, and `set -x` showing the force-push expansion |
| Finding 1 covers all five segmented guards, 30/30 spellings | **5** - both shipped binaries |
| No non-substitution regression exists | **4** - 440-spelling differential fuzz in-process against both revisions. A large sample, not a proof of absence, and I say so |
| Finding 2, the comment's claim is inverted | **5** - `shellSegments` output pasted for both named constructs |
| Finding 3, the wiki page is stale | **2** - read the lines and diffed the ranges; I did not re-run the page's examples |
| The `2>&1` / `&>` / `>|` exemption opens no hole | **4** - nine adjacent spellings probed in-process, no regression found. Not exhaustive |
