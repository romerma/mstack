# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 29 readme-leads-with-use
- **Status:** reviewing, APPROVED at a84950b; awaiting a fresh row at the final head
- **Branch:** fix/mstack-front-door
- **Base:** main
- **Worktree:** none

Item 28 mstack-front-door is **cancelled and reverted**. Its premise was false; see the
section below. Items 31 and 32 carry the two findings from its review that were worth keeping.

## Plan

Investigate playbook, steps copied verbatim (no TodoWrite tool in this session, so they
live here):

1. Split the question. "How does it work" goes to `/mstack:understand`. "Why is it like
   this" needs history: git log and blame on the seam, plus whatever issue tracker or chat
   the repo is connected to. — DONE, both halves answered below.
2. For anything with more than three moving parts, fan out two or three readers with
   narrow, disjoint questions rather than one reader with a broad one.
   — skip: the surface is 12 SKILL.md files, one manifest and the docs pages that name the
   front door; read directly. This session also carries a standing instruction not to launch
   subagents the user did not ask for.
3. Synthesize into one account: Overview, Key concepts, How it works, Where things live,
   Gotchas. — DONE, in the reply and below.
4. Verify the claims that matter. Behaviour gets rung 4; structure gets rung 2 with a real
   `file:line`. Say where each one stopped. — DONE, rungs recorded per finding.
5. `mstack decide` the conclusions worth remembering, with the evidence path. — DONE.

## Log

Question: why mstack does not feel like one entry point, and what "one entry point like
pstack's `/poteto-mode`" would have to change here.

Findings, with where the evidence stopped:

- **The registered command is `mstack:router`, not `mstack`.** `claude plugin details mstack`
  lists the skill inventory as `... review, router, setup ...`, and this session's own
  invocation resolved to `/mstack:router`. Rung 3: two independent observations of the real
  harness, but not a direct observation of `/mstack` failing, because the headless probe
  could not run (no credit on that auth path).
  The docs assert the opposite in six places: `README.md:107`, `README.md:162`,
  `README.md:223`, `CLAUDE.md:9`, `docs/wiki/Home.md:22`, and most explicitly
  `docs/wiki/Skills-and-Playbooks.md:14`, which states the mechanism as fact: *"named
  `mstack`, so it is invoked as plain `/mstack`"*.
  Cause, rung 2: `skills/router/SKILL.md` sets `name: mstack` while the directory is
  `router`. Across all 89 cached plugin skills on this machine it is the only one where the
  frontmatter name and the directory name disagree, so nothing else was ever going to catch
  it. `docs/research/pstack-port.md:349` records the naming rule as "frontmatter `name` **or**
  the directory name" — the ambiguity in that "or" is exactly where this fell through.

- **The front door is the one door the model cannot open.** `skills/router/SKILL.md` is the
  only mstack skill carrying `disable-model-invocation: true`. Rung 2, and confirmed at rung
  4 by this session's own skill listing: eleven mstack skills are offered to the model
  (`design, implement, orchestrate, reflect, review, setup, ship, spec, understand, unslop,
  verify`) and the router is absent. A user who describes a task in plain words instead of
  typing the command gets a phase skill or no skill, never the router. Every rule that lives
  in the router — orient, gate, copy the playbook verbatim, author is not reviewer — is
  skipped on that path.

- **Twelve commands is the advertised surface.** `claude plugin details mstack`: Skills (12),
  Agents (5), always-on ~1,060 tok. `README.md:419` and `docs/wiki/Home.md:63` both sell it
  as "The twelve `/mstack` commands". pstack ships 44 skills behind **one** front door.

- **Why it is like this**, rung 2: `git log --follow skills/router/SKILL.md` returns two
  commits. `name: mstack` and `disable-model-invocation: true` both landed in the first one,
  `818855d feat: router, phase skills and plugin manifests`, and were never revisited.
  `.mstack/decisions.tsv` holds no row for either. This was never a decision, so there is no
  rationale to argue with.

The fork I drafted was the wrong question and the user said so. They wanted one thing:
`/mstack <what you want done>`, the way `/poteto-mode <request>` works. Scoped to that.

Bug-fix playbook, steps copied verbatim:

1. **Reproduce it yourself**, on the surface where it actually happens. — DONE.
   `claude plugin details mstack` lists the skill as `router`; the session transcript's
   `lastPrompt` is `/mstack:router ...`.
2. Binary-search the cause. Confirm the *mechanism* with runtime evidence before designing
   anything. — DONE. Cause is one line: `skills/router/SKILL.md` declared `name: mstack`
   while the directory said `router`, and the directory is what the command is named after.
3. Write the failing test first. — DONE, three of them, red on the unmodified tree, committed
   in `d38e0ef` before the fix.
4. `/mstack:design` only if the fix crosses a function boundary.
   — skip: the fix is a directory rename plus two checks in one module.
5. Delegate the fix to `mstack:implementer` so a different pass reviews the diff.
   — **skip: this session carries a standing instruction not to launch subagents the user did
   not ask for.** The separation is not waived, only deferred: the item stays at `reviewing`
   and no ledger verdict was written, so the gate will refuse `done` until a pass that did not
   write this code approves it.
6. Verify on the same surface as step 1. — PARTIAL, see Verification.
7. Stage the commits so the failing repro lands **before** the fix in history. — DONE:
   `d38e0ef` (red) then `4eefde6` (green).
8. `/mstack:review`, then `/mstack:ship`. — pending, blocked on step 5's deferral.

### Item 29, the README

The complaint: the README explained the machinery before it showed anyone how to use the
thing, and it never named the playbooks or the agents at all. Both were wiki-only.

What changed:

- Opens with `## One command` and four real `/mstack <request>` lines, before any mechanism.
  Install moved up under it; the old `## Quickstart` further down was the same content twice,
  so it is gone.
- New `## The seven playbooks`, `## The five agents` and `## The twelve skills` sections. The
  playbook and agent rows were written from the files themselves, not from memory:
  `skills/router/playbooks/*.md` and the `description:`/`tools:` front matter in `agents/*.md`.
- Dropped `## The map`, whose nine rows pointed at the same wiki pages the `## Documentation`
  table at the bottom already lists, and `### A router, not an orchestrator`, which repeated
  the new `## One command` section.
- Dropped `## Where this comes from`, which shared its pstack attribution and its "44 skills,
  23 playbooks and zero hooks" statistic with two other sections; its two unique links moved
  into `## Credit`.

Net 439 -> 473 lines: about 65 lines of new playbook and agent tables against about 30 lines
of removed duplication.

### Item 28's premise is refuted. Do not release.

The reviewer read the installed `claude 2.1.241` bundle and found that a plugin skill whose
front-matter `name` contains no colon is registered as an **alias**. I confirmed the bytes
myself in `/Users/romerma/.local/share/claude/versions/2.1.241`:

```
C = a.name != null ? String(a.name) : void 0        // the front-matter name
R = C && !C.includes(":") ? [C] : void 0            // becomes aliases
JUS(e,t){return e.name===t || Vf(e)===t || (e.aliases?.includes(t) ?? !1)}
```

So `skills/router/` + `name: mstack` registered canonical `mstack:router` **and** alias
`mstack`. **`/mstack` already worked.** It was never broken.

That makes the change net negative as it stands. Before: canonical `mstack:router`, alias
`mstack`. After: canonical `mstack:mstack`, alias `mstack`. `/mstack` works either way, and
`/mstack:router` no longer does. The rename buys nothing and costs one command name.

Consequences, all of which block the release:

- `CHANGELOG.md` says "`/mstack` answered nothing". False, and it would ship as the headline
  of 0.2.0.
- `docs/wiki/Skills-and-Playbooks.md` says a differently-named directory "would leave
  `/mstack` unanswered no matter what its frontmatter claimed". False, and it is the inverse
  of the error it replaced.
- `README.md:141-142` explains the naming rule without the alias, so it is misleading too.
- `lintSkill`'s hard failure on a name/directory disagreement is **actively wrong**: that
  disagreement is how a plugin declares a short alias. Shipped, it would reject legitimate
  plugins.
- Acceptance 3 was never implemented. `SKIP_DIRS` at `src/lint.ts:490` excludes `docs`, and
  the prose set at `src/lint.ts:336-342` is skills plus agents, so `README.md` and the wiki
  are never scanned. The reviewer planted `/mstack:nosuchthing` in both and lint stayed green.
- `src/lint.ts:329` is uncovered: reverting it by hand leaves the lint suite at 17 pass, 0
  fail.

Ledger at this head: both items `verifier-failed`. Nothing is close-worthy.

Done, in that order. `git revert` of `4eefde6` then `d38e0ef`, resolving the `.mstack/`
conflicts in favour of the live store so the append-only records and items 29 to 32 survived.
The result is byte-identical to `61fdd04` across `src`, `tests`, `skills`, `agents`,
`CHANGELOG.md` and `docs/wiki`, confirmed with `git diff --stat 61fdd04 -- ...` returning
empty. Item 28 is `cancelled` with a row in `decisions.tsv`.

Two corrections the revert alone did not make, because the text they restore was written
before anyone understood the mechanism:

- `README.md` now says the router answers `/mstack` because its front matter declares
  `name: mstack`, and that Claude Code registers `/<plugin>:<directory>` plus the bare
  declared name as an alias when it carries no colon.
- `docs/wiki/Skills-and-Playbooks.md` says the same thing, so both name the alias rather than
  leaving "its skill is named `mstack`, so it is invoked as plain `/mstack`" as an assertion
  with no mechanism behind it. That sentence was correct all along; it was the one I replaced
  with something false.

Kept from item 29: the whole README restructure. What it lost: nothing, since the only line
that depended on the rename was the naming paragraph, now rewritten.

## Verification

Against the reverted tree, item 29 only:

- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 93 relative links, 0 broken.
- `./bin/mstack lint-plugin .`: PASSED, 0 failures, 0 warnings.
- `npm test`: 286 pass, 0 fail on node, and 286 pass, 0 fail on bun. Back to 286 from 289
  because the three tests item 28 added went with it.
- `npm run typecheck`: clean.
- `git diff --stat 61fdd04 -- src tests skills agents CHANGELOG.md docs/wiki`: empty, which is
  the revert being byte-clean rather than approximately clean.

**Rung note on the alias finding.** Both the reviewer's refutation and item 28's original
claim are rung 3: each walks a resolution path, neither typed `/mstack` in a live session. The
refutation wins anyway because it reads the resolver itself, `JUS`, and shows an alias branch
that the original evidence never accounted for, while `claude plugin details` printing `router`
and a transcript `lastPrompt` of `/mstack:router` are consistent with both stories. Rung 4 is
still open and still cheap: type `/mstack` in a session running this checkout.

## PR #1 was merged early, and main carries the refuted work

At 07:00Z PR #1 was merged by hand at `5ea9110`, three commits before this branch finished.
`main` therefore carries every part of item 28: the `skills/mstack/` rename, the false
`CHANGELOG` line, the wiki sentence asserting the inverse of the truth, and the lint check that
would reject any plugin declaring a short alias. `git show origin/main:CHANGELOG.md | grep -c
'answered nothing'` returns 1, and `git ls-tree -d origin/main skills/` lists `skills/mstack`.

Recovery, not a rewrite of history: `origin/main` merged into this branch (its tree was
identical to `5ea9110`, so the merge added nothing), and PR #2 carries the three commits main
is missing. Nothing outside `.mstack/` moved between the approved `a84950b` and the current
head, checked with `git diff --stat a84950b HEAD -- . ':!.mstack'` returning empty.

**No release until PR #2 lands.** Tagging main as it stands would publish the refuted claim as
the headline of the version.

Item 33 filed from the reviewer's round-3 note: every mstack skill declares a colon-free name,
so `/setup`, `/verify`, `/design` and the rest resolve with no `mstack:` prefix. That is a
property of the shipped plugin, documented nowhere, and a cross-plugin collision surface.
