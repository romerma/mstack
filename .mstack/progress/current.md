# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 29 readme-leads-with-use
- **Status:** reviewing (written; needs a pass that did not write it)
- **Branch:** fix/mstack-front-door
- **Base:** main
- **Worktree:** none

Item 28 mstack-front-door is parked at `blocked` on the same branch: implemented, green, and
waiting on a review pass this session is not permitted to launch. It is not abandoned, it is
one reviewer away from `done`.

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
  `skills/mstack/playbooks/*.md` and the `description:`/`tools:` front matter in `agents/*.md`.
- Dropped `## The map`, whose nine rows pointed at the same wiki pages the `## Documentation`
  table at the bottom already lists, and `### A router, not an orchestrator`, which repeated
  the new `## One command` section.
- Dropped `## Where this comes from`, which shared its pstack attribution and its "44 skills,
  23 playbooks and zero hooks" statistic with two other sections; its two unique links moved
  into `## Credit`.

Net 439 -> 473 lines: about 65 lines of new playbook and agent tables against about 30 lines
of removed duplication.

## Verification

- `node scripts/check-doc-links.mjs README.md docs/wiki/*.md`: 93 relative links, 0 broken.
- `mstack lint-plugin .`: PASSED, 0 failures, 0 warnings, including the new line
  `[ok] front door: /mstack resolves to skills/mstack/SKILL.md`. Rung 4.
- `npm test`: 289 pass, 0 fail on node and 289 pass, 0 fail on bun. Rung 4.
- `npm run typecheck`: clean.
- `mstack gate`: PASSED, 0 failures.
- **Not closed:** typing `/mstack` in a live session still has no rung-4 observation. The
  installed copy comes from the `romerma/mstack` GitHub marketplace, so `claude plugin details`
  cannot see this branch, and the headless probe could not run on this machine's auth. What is
  proven is structural, at rung 2: directory and front matter now both read `mstack`, so both
  candidate resolution rules yield `/mstack`. Confirming it costs one session started with
  `claude --plugin-dir .` and the marketplace copy disabled.
