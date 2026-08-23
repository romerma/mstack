# Review - mstack-front-door (item 28)

**Verdict:** CHANGES_REQUESTED

Reviewed at HEAD `5ea911045c38b9ee7da097372ae2091434ad23fc` on branch `fix/mstack-front-door`.
In scope: `d38e0ef` (repro) and `4eefde6` (fix). `c08f696` and `5ea9110` belong to item 29 and
were read only for the state-file transitions they make to item 28.

I did not write this code. I ran everything below myself.

---

## Summary

The rename is clean, the two new lint rules are real and genuinely red without the fix, and the
doc repointing is complete. Three things block a close:

1. **Acceptance 3 is not met and has no test.** `lint-plugin` stays green when README.md or a
   wiki page names `/mstack:nosuchthing`. Those are exactly the docs the item exists because of.
2. **The one `src/lint.ts` change the CHANGELOG advertises as a fixed blind spot is untested.**
   Revert `src/lint.ts:329` and the suite is still 289/289.
3. **The shipped prose asserts a mechanism the harness contradicts.** Claude Code 2.1.241
   registers the front-matter `name` as a command *alias*, so `/mstack` resolved to the router
   before the rename. `CHANGELOG.md:9` ("`/mstack` answered nothing") and
   `docs/wiki/Skills-and-Playbooks.md:14-16` ("a directory called anything else would leave
   `/mstack` unanswered no matter what its frontmatter claimed") are, on my reading, wrong in the
   opposite direction from the doc the commit message convicts.

None of this makes the rename a bad change. Directory/front-matter agreement is worth having on
its own. The problem is that the change is written up as fixing an outage that I cannot find
evidence of, and the acceptance bullet that would have caught doc drift is not implemented.

---

## Requirement to test

| R | Test | Evidence |
|---|---|---|
| A1 skill inventory lists `mstack` | `tests/lint.test.ts:217` "the front door the docs name is a command the plugin actually ships"; `tests/lint.test.ts:231` "removing the front door skill is caught" | Both red at `d38e0ef`, green at HEAD. Run pasted below. Rung 4 |
| A2 directory and front matter agree | `tests/lint.test.ts:203` "a skill whose front-matter name disagrees with its directory is caught"; enforced by `src/lint.ts:228-235` | Red at `d38e0ef` with the right diagnostic. Rung 4 |
| A3 lint red on a doc naming an unprovided `/mstack:<x>` | **none** | No test in either commit exercises this. Demonstrated not met for README/wiki below. Rung 4 |
| `src/lint.ts:329` directory-keyed cross-references | **none** | Reverting the line alone leaves 289/289 green. Rung 4 |
| A4 doc references repointed | none (structural) | `rg 'skills/router'` output below. Rung 4 |

---

## Acceptance, quoted

### **"the plugin's skill inventory lists a skill named mstack, so /mstack <prose> is a real command"**

**Partially met.**

The on-disk half is met at rung 4. `skills/mstack/SKILL.md` exists carrying `name: mstack`,
`lintFrontDoor` (`src/lint.ts:187-205`) asserts it, and the shipped lint prints:

```
[ok]    front door: /mstack resolves to skills/mstack/SKILL.md
```

`tests/lint.test.ts:217` and `:231` both fail without the fix (pasted below), so this is real
coverage, not a tautology.

The *inventory* half is not currently observable. The installed plugin has not been refreshed,
so the copy Claude Code actually reads is still the old tree:

```
$ claude plugin details mstack
mstack 0.1.0
  Skills (12)  design, implement, orchestrate, reflect, review, router, setup, ship, spec, understand, unslop, verify
```

```
$ fd -H -t d -d 1 . /Users/romerma/.claude/plugins/cache/mstack/mstack/0.1.0/skills
.../skills/router/          <- still router
```

That is a stale cache, not a defect in the tree, but it means the criterion as literally worded
("the plugin's skill inventory lists a skill named mstack") is unverified at rung 4 by anyone,
including me. Operationally it also means every subagent running from that cache is currently
being told to read `${CLAUDE_PLUGIN_ROOT}/skills/mstack/references/evidence-ladder.md` from a
tree that has `skills/router/` — the repointed agent files land broken until the plugin is
reinstalled. My own system prompt cites the cached `skills/router/references/evidence-ladder.md`
path, which is that situation live.

The clause "so `/mstack <prose>` is a real command" is discussed under finding 3.

### **"the router's directory name and its frontmatter name agree, so no naming rule can resolve it to anything but mstack"**

**First clause met. Second clause is an overclaim.**

They agree: `skills/mstack/SKILL.md` line 2 is `name: mstack`, and `src/lint.ts:228-235` fails
any disagreement. `tests/lint.test.ts:203` proves the rule bites — it mutates
`skills/verify/SKILL.md` to `name: prove` and demands the failure.

"No naming rule can resolve it to anything but mstack" does not hold as written. There is a
third rule the item's two-candidate framing did not consider, and under it the registered
command name is `mstack:mstack` in the new layout, not `mstack`. `/mstack` reaches the skill
through the alias path, not through the directory. See finding 3 — the conclusion survives, the
stated reasoning does not.

### **"lint-plugin turns red when a doc names a /mstack:<x> command that no skill directory provides"**

**Not met.** This is blocking finding 1.

I planted `/mstack:nosuchthing` in four places on a scratch copy of HEAD and ran the shipped
lint after each:

```
### CASE 1: /mstack:nosuchthing planted in README.md
PASSED - 0 failures, 0 warnings
### CASE 2: /mstack:nosuchthing planted in docs/wiki/The-CLI.md
PASSED - 0 failures, 0 warnings
### CASE 3: /mstack:nosuchthing planted in skills/mstack/SKILL.md
[fail]  mstack:nosuchthing is referenced in skills/mstack/SKILL.md but no such skill or agent exists
FAILED - 1 failure, 0 warnings
### CASE 4: /mstack:router (the now-dead command) planted in docs/wiki/Skills-and-Playbooks.md
PASSED - 0 failures, 0 warnings
```

The reason is structural, at two lines:

- `src/lint.ts:490` — `SKIP_DIRS` contains `"docs"`, so `collectAll` can never reach
  `docs/wiki/`.
- `src/lint.ts:336-342` — the prose set scanned by `lintReferences` is skill files, agent files
  and `collectAll(root/skills)`. `README.md` and `CLAUDE.md` sit at the repository root and are
  in none of those.

Case 4 is the one that matters most: `/mstack:router` is the command this very commit deleted,
planted in the very wiki page this very commit edited, and the linter is green. The item was
filed because "README.md, CLAUDE.md and four wiki pages" named a command that did not resolve.
The check added covers every file except that set.

`lintFrontDoor`'s docstring (`src/lint.ts:180-185`) explains why doc-scanning was rejected in
favour of anchoring to `plugin.json`. That argument is sound for the *bare* `/mstack` front door
and I have no objection to it. It does not answer this bullet, which is about the
`/mstack:<x>` form, where the plugin.json anchor gives nothing.

There is also **no test for this bullet in either commit**. The three new tests cover A1 and A2
only.

### **"every doc reference to skills/router/ points at the new path"**

**Met**, rung 4.

```
$ rg -n --hidden --glob '!.git' 'skills/router' .
./src/lint.ts:225:  // the frontmatter spelling. This shipped: the router sat in skills/router/
./CHANGELOG.md:7:- **`/mstack` is a command you can actually type.** The router shipped in `skills/router/`
./.mstack/decisions.tsv:59,82,83
./.mstack/progress/*.md            (26 historical report files)
./.mstack/state.json:425           (the acceptance bullet's own text)
```

Every live doc is clean: no hit in `README.md`, `CLAUDE.md`, `docs/wiki/`, `agents/` or
`skills/`. The two source hits are deliberate historical description (a comment about the defect
and a changelog entry about the defect), which is correct — those are supposed to name the old
path.

The decision not to rewrite `.mstack/progress/` and `.mstack/decisions.tsv` was **right**, and it
is not merely defensible, it is already the codified rule: `src/lint.ts:483-490` says in as many
words that "a report is a dated record of what was true, and editing one to satisfy a linter is
what the append-only rule exists to prevent", and excludes `.mstack` from `collectAll` for that
reason. Rewriting them would have been the defect.

The renames are byte-clean — `git diff --find-renames --stat` shows `0` changed lines on all ten
moved files, so no content was smuggled in under a rename.

---

## Findings

### 1. BLOCKING - Acceptance 3 is unimplemented and untested

`src/lint.ts:336-342` and `src/lint.ts:490`. See the quoted bullet above for the four-case run.

What would fix it: extend the `lintReferences` prose set to the repository's own docs — at
minimum `README.md` and `docs/wiki/*.md` — or, if that scope is deliberately out of the
linter's remit, say so and take the bullet out of the item rather than leaving it recorded as
satisfied. Either way the bullet needs a test; right now nothing would notice if the check
regressed.

Note `scripts/check-doc-links.mjs` covers README and the wiki for *links*, and passes:

```
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
```

but it checks link targets, not `/mstack:<x>` command names, so it does not close this gap.

### 2. BLOCKING - the `lintReferences` change has no test

`src/lint.ts:321-330`. The commit message and `CHANGELOG.md:14-19` both single this out:

> "Its cross-reference check also resolved names front-matter-first, the opposite of the
> harness, so it would clear a reference the harness cannot resolve; it keys off the directory
> now."

I reverted that one line on a scratch copy of HEAD and reran the suite:

```
$ sd 'for \(const file of skillFiles\) known\.add\(basename\(dirname\(file\)\)\);' \
     'for (const file of skillFiles) known.add(nameOf(file) ?? basename(dirname(file)));' src/lint.ts
$ node --test 'tests/*.test.ts'
ℹ tests 289
ℹ pass 289
ℹ fail 0
```

289/289 green with the change removed. It is not covered.

To be fair to the change: I looked for a legitimate case it breaks and found none. The only
input where `nameOf(file)` and `basename(dirname(file))` differ is a skill whose front matter
and directory disagree, which `lintSkill` now fails outright; a skill with no `name:` key takes
the same branch as before. So the answer to "does that last change break any legitimate case" is
**no**. But it is defensive code guarding a window that `lintSkill` closes, and nothing pins it.

A test would plant a skill whose directory and front-matter name disagree, plant a
`mstack:<directory>` reference in a playbook, and assert the reference does *not* appear in the
failures — the shape `expectFail` cannot express today.

Incidentally, the repro run at `d38e0ef` exhibits the old bug directly, which is a nice
confirmation the change is aimed at something real: mutating `verify`'s name to `prove` caused
the pre-fix linter to report `mstack:verify is referenced in ... but no such skill or agent
exists` — a false positive on a reference the harness resolves fine.

### 3. BLOCKING (prose) - the shipped docs state a mechanism I can refute from the harness's own source

This is the thing I was asked to attack hardest, so here is the whole chain with locations.

The installed harness is `claude 2.1.241` at
`/Users/romerma/.local/share/claude/versions/2.1.241` (Mach-O arm64, minified JS embedded).

**a. The directory claim is true, for the canonical name.** Plugin skills under `skills/` are
loaded by `opf`. Its directory branch is:

```js
u.map(async (d) => {                      // d = each subdirectory of skills/
  let p = join(e, d.name), f = join(p, "SKILL.md"), ...
  y = `${t}:${d.name.replace(/[^a-zA-Z0-9_-]/g,"-")}`,   // t = plugin name
  b = RVn(y, _, r, n, o, !0, {isSkillMode:!0});
```

`y` is built from the **directory name**, front matter ignored. So the canonical command `name`
for `skills/router/SKILL.md` was `mstack:router`. The item is right about this much.

(There is a second branch, taken when the path handed in is itself a skill directory, which
*is* front-matter-first: `m = ((typeof d.name==="string"?d.name.trim():"") || basename(e))`.
It does not apply to mstack, whose `skills/` holds subdirectories.)

**b. But the front-matter `name` is not discarded — it becomes a display name and an alias.**
The record builder `RVn` continues:

```js
C = a.name != null ? String(a.name) : void 0,       // front-matter name -> "mstack"
k = e.slice(0, e.lastIndexOf(":")+1),                // "mstack:"
A = C ? `${k}${C}` : e,                              // "mstack:mstack"
R = C && !C.includes(":") ? [C] : void 0,            // ["mstack"]
...
return { type:"prompt", name:e, ..., userFacingName(){return A}, aliases:R, ... }
```

So the old `skills/router/` skill registered as: `name = "mstack:router"`,
`userFacingName() = "mstack:mstack"`, `aliases = ["mstack"]`.

**c. Typed slash commands resolve against all three.**

```js
function Vf(e){return e.userFacingName?.() ?? e.name}
function PFt(e){let t=e.startsWith("/")?e.slice(1):e, r=t.search(/\s/); ...}
function JUS(e,t){return e.name===t || Vf(e)===t || (e.aliases?.includes(t) ?? !1)}
function yb(e,t){let r; return t.find((o)=>{if(o.name===e)return!0; if(r===void 0&&JUS(o,e))r=o; return!1}) ?? r}
```

and on submit: `let {name:vT,args:Uv}=PFt(Qf), uw=yb(vT,ci)`.

`/mstack` -> `PFt` yields `"mstack"` -> no command has that exact `name` -> the fallback scan
hits `aliases.includes("mstack")` on the router skill -> resolves.

**d. The alias survives the collision filter.** `jyw` strips a plugin command's alias only when
the alias collides with some command's `name` (or a non-plugin command's alias). Every mstack
skill name contains a colon and no builtin is called `mstack`, so `["mstack"]` survives.

**Consequence.** Before the rename: `name = mstack:router`, alias `mstack`. After the rename:
`name = mstack:mstack`, alias `mstack`. `/mstack` resolves in both. What the rename actually
changed is that `/mstack:router` stopped resolving and `claude plugin details` will list
`mstack` instead of `router`.

Two statements now shipped are therefore, on this evidence, false:

- `CHANGELOG.md:9` — "so the front door was `/mstack:router` and `/mstack` answered nothing".
  The first half is right about the canonical name; the second half is not.
- `docs/wiki/Skills-and-Playbooks.md:14-16` — "a directory called anything else would leave
  `/mstack` unanswered no matter what its frontmatter claimed". The front matter claim is
  exactly what produced the working alias.

The commit message convicts the previous wiki text of explaining the mechanism backwards. The
replacement explains it backwards in the other direction, and the CHANGELOG entry is the
version a reader outside this repo will see.

**Where this stopped on the ladder, honestly.** Reading a dependency's own source is **rung 2**
by `skills/mstack/references/evidence-ladder.md:9`, and walking the failure step by step to show
it does not reach is **rung 3** by line 10. So my refutation is rung 3. I could not reach rung 4
or 5: `claude --plugin-dir <probe> -p "/zzprobe"` on a purpose-built two-file probe plugin
returned

```
Credit balance is too low
```

so no live run of the resolver was available to me, with or without `--debug`. I am flagging
this as an unsettled contradiction between two rung-3 readings, not as a settled refutation —
but mine walks the resolver, and the implementer's (`claude plugin details` lists the skill as
`router`; a transcript `lastPrompt` of `/mstack:router`) is consistent with either story, since
an inventory listing is not a command table and a recorded prompt is not a recorded resolution.

What would fix it: either reach rung 4/5 on a machine with credits and correct me, or soften the
CHANGELOG and wiki to what is actually established — the canonical command name was
`mstack:router`, directory and front matter disagreed, and the rename makes the two spellings
agree so the inventory and the command stop telling different stories. That claim needs no
outage to be worth making.

### 4. Non-blocking - item 28 is `blocked` in `state.json` with no recorded reason

`.mstack/state.json:426` reads `"status": "blocked"`. It was `reviewing` at `c08f696` and was
flipped to `blocked` by `5ea9110`, an item-29 commit, with nothing in the commit message,
`decisions.tsv` or `current.md` saying why. `blocked` is a legal transition from `reviewing`
(`src/lifecycle.ts:93,119`) and the gate does not object, so this is not a red gate — but I was
asked whether this is close-worthy, and an item cannot be closed out of `blocked` without
someone saying what it is blocked on.

Item 28 also carries no `verification` field, unlike items 27 and 29 which both do. There was
therefore nothing item-specific for me to run beyond the gate.

### 5. Non-blocking - small things in `src/lint.ts`

- `src/lint.ts:188-195` re-reads and re-parses `.claude-plugin/plugin.json`, which
  `lintManifest` (`src/lint.ts:140-151`) already parsed thirty lines earlier. Two parses of one
  file, and the second swallows its own error with `return` on the grounds that the first
  reported it. Passing the parsed name through would remove the coupling.
- `src/lint.ts:198` emits `report.ok(...)` unguarded, while `lintSkill:248` guards its `ok` with
  `if (!report.failed)`. Cosmetic inconsistency in a failing run's output.
- `src/lint.ts:229` compares against `basename(dirname(file))` for arbitrarily nested skills,
  but `collect()` recurses and Claude Code's `opf` does not — a `skills/a/b/SKILL.md` is never
  loaded by the harness at all. No such skill exists here, so this is a note, not a defect.

No debug leftovers, no dead code (`nameOf` is still used at `src/lint.ts:330` for agents), no
layering problem: the new check sits with the other skill checks and the front-door check is its
own function with its reasoning written down.

---

## Tests: were any weakened?

**No.** `git diff d38e0ef..4eefde6 -- tests/lint.test.ts` is five hunks, every one of them a
path substitution `skills/router` -> `skills/mstack` at lines 99, 169, 180, 195 and 244,
following the rename. No assertion was loosened, no matcher widened, no test deleted. The three
tests added by `d38e0ef` reach `4eefde6` byte-identical.

## Did the repro really fail?

Yes, verified rather than reasoned about. I extracted the `d38e0ef` tree with `git archive` into
a scratch directory (no worktree, no stash, the repository untouched) and ran the lint tests
against it:

```
$ git archive d38e0ef | tar -x -C $SCRATCH/repro && cd $SCRATCH/repro
$ node --test 'tests/lint.test.ts'
✖ a skill whose front-matter name disagrees with its directory is caught (16.016792ms)
✖ the front door the docs name is a command the plugin actually ships (11.046208ms)
✖ removing the front door skill is caught (15.577459ms)
ℹ tests 17
ℹ pass 14
ℹ fail 3

test at tests/lint.test.ts:203:1
  AssertionError: name/dir disagreement: failed silently. Nothing matched
  /name 'prove' but its directory is 'verify'/. Got ["mstack:verify is referenced in
  skills/implement/SKILL.md, skills/router/SKILL.md, skills/router/playbooks/feature.md
  but no such skill or agent exists -> rename the reference, or ship the thing it names"]

test at tests/lint.test.ts:217:1
  AssertionError: skills/mstack/SKILL.md is what makes /mstack typable

test at tests/lint.test.ts:231:1
  AssertionError: missing front door: expected a failure, got a pass
```

All three fail, each for its own reason, none vacuously. `skills/mstack/` genuinely did not
exist at that commit (`fd -t d -d 1 . repro/skills` lists `router`, no `mstack`). Rung 4.

## The "89 cached skills" claim

The commit message's survey reproduces exactly:

```
$ cd ~/.claude/plugins/cache && for f in $(fd -H -t f '^SKILL\.md$' .); do ... done
MISMATCH: ./mstack/mstack/0.1.0/skills/router/SKILL.md  name=mstack dir=router
total SKILL.md in cache: 89 ; mismatches: 1
```

89 skills, one mismatch, the router. Rung 4. That justifies the new lint rule regardless of how
finding 3 resolves: a lone outlier across 89 samples is a defect worth failing on.

---

## Verification I ran

```
$ ./bin/mstack version
mstack 0.1.0 at /Users/romerma/Code/mstack

$ ./bin/mstack gate --full
ℹ pass 289
ℹ fail 0
...
-- skills
[ok]    skills/mstack/SKILL.md (145 lines, 310 description chars)
...
[ok]    front door: /mstack resolves to skills/mstack/SKILL.md
...
PASSED - 0 failures, 0 warnings
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .

PASSED - 0 failures, 0 warnings
```

```
$ npm test          # node half
ℹ tests 289
ℹ pass 289
ℹ fail 0
ℹ duration_ms 15858.796708

$ npm run test:bun
 289 pass
 0 fail
Ran 289 tests across 16 files. [33.39s]
```

```
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
93 relative links checked, 0 broken
exit=0
```

```
$ ./bin/mstack ledger check mstack-front-door
FAIL no verdict recorded for mstack-front-door
```

Plus, all pasted in full above: the `d38e0ef` repro run, the four planted-doc lint cases, the
one-line revert of `src/lint.ts:329`, the `skills/router` sweep, the 89-skill cache survey, the
`claude plugin details mstack` inventory, and the failed live probe.

The gate was green before I started and I changed nothing in the repository. Every experiment ran
on a `git archive` copy in the scratch directory.

---

## Where each claim stopped

| Claim | Rung | On what |
|---|---|---|
| Suite 289/289 on both runtimes, typecheck and lint clean at HEAD | 4 | This checkout, `./bin/mstack gate --full` |
| The three new tests fail at `d38e0ef` | 4 | `git archive` copy of `d38e0ef`, `node --test` |
| No test was weakened between the two commits | 2 | `git diff d38e0ef..4eefde6 -- tests/lint.test.ts` |
| `lint-plugin` does not catch `/mstack:<x>` in README.md or `docs/wiki/` | 4 | `git archive` copy of HEAD, four planted cases |
| `src/lint.ts:329` is uncovered | 4 | Line reverted on the copy, 289/289 still green |
| The directory-keyed change breaks no legitimate case | 3 | Walked the three input shapes against `src/lint.ts:228-235,329` |
| Every live doc reference repointed | 4 | `rg 'skills/router'` across the tree |
| 89 cached skills, router the only name/dir mismatch | 4 | `~/.claude/plugins/cache`, scripted sweep |
| Claude Code names the canonical skill command after the directory | 3 | `opf` in the 2.1.241 bundle, dependency source |
| Claude Code also registers the front-matter name as an alias, so `/mstack` resolved before the fix | 3 | `RVn` / `jyw` / `yb` / `JUS` in the 2.1.241 bundle |
| `/mstack` actually resolving in a live session, before or after | **not established** | No credits; `claude -p` returned "Credit balance is too low" |
| The plugin inventory listing `mstack` after this change | **not established** | Installed cache is stale and still lists `router` |

---

## Changes required

1. **`src/lint.ts:336-342` and `src/lint.ts:490`** — acceptance 3 is not implemented. A
   `/mstack:nosuchthing` in `README.md` or `docs/wiki/*.md` leaves the lint green; only files
   under `skills/` and `agents/` are scanned, and `SKIP_DIRS` excludes `docs` outright. Either
   widen the prose set to the repository's own docs, or strike the bullet from item 28 and say
   why. Whichever way, it needs a test — there is none today.

2. **`src/lint.ts:329`** — the directory-keyed cross-reference resolution is untested. Reverting
   this single line leaves 289/289 green. Add a test that plants a name/directory disagreement
   plus a `mstack:<directory>` reference and asserts that reference is *not* reported as
   dangling.

3. **`CHANGELOG.md:9` and `docs/wiki/Skills-and-Playbooks.md:14-16`** — both assert that
   `/mstack` did not resolve before the rename. Reading the 2.1.241 bundle, `RVn` registers
   `aliases: [<front-matter name>]` and `yb`/`JUS` resolve typed input against `name`,
   `userFacingName()` and `aliases`, so `skills/router/` + `name: mstack` gave a working
   `/mstack`. Either establish the outage at rung 4/5 on a machine that can run it, or restate
   both to the claim that is actually supported: the canonical command name was `mstack:router`,
   directory and front matter disagreed, and the rename makes them agree. Note that
   `docs/wiki/Skills-and-Playbooks.md:13` ("The `<name>` is the **directory**") is correct as
   far as it goes; it is the counterfactual in the next clause that overreaches.

4. **`.mstack/state.json:426`** — item 28 sits at `blocked` with no reason recorded anywhere,
   set by `5ea9110`, a commit belonging to item 29. Record what it is blocked on, or move it back
   to `reviewing`. It also has no `verification` field, unlike items 27 and 29.

5. **Non-blocking, `src/lint.ts:188-195`** — `plugin.json` is read and parsed a second time
   here after `lintManifest` already parsed it at `:140-151`, and the second parse swallows its
   error. Pass the name through instead.

## What I could not establish

- Whether `/mstack` resolved in a live Claude Code session before the rename. My reading of the
  harness says yes; nobody on either side of this change has observed it either way. This is the
  single fact the item's framing rests on and it is at rung 3 for both the implementer and me.
- Whether the plugin inventory now lists `mstack`. The installed copy is stale; refreshing it is
  an environment change I did not make.
