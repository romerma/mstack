# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** none yet (investigation, pre-intake)
- **Status:** investigating the entry-point surface
- **Branch:** main
- **Base:** main
- **Worktree:** none

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

Waiting on: the user's answer to the one product fork, recorded below. The shape of "one
entry point" has materially different user-visible outcomes and is not observable by running
anything, so it is theirs.

## Verification

- `mstack gate`: PASSED, 0 failures, 1 warning (on main, no feature branch yet).
- No code changed this session.
