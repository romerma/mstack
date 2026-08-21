# Review - docs-for-newcomers, round 3 (reader lens)

**Verdict:** APPROVED

Confirmation pass. Both round-2 blockers are fixed at the cited locations, the round-1
partial is closed, the diff touched nothing else, and the suite is green. One nit recorded
below, introduced by the facts-driven caption rewrite; it is a local roughness with a route
to the definition in the same paragraph, not a wrong model, and not worth a fourth round.

## Verification I ran

`./bin/mstack gate` - exit 0.

```
[ok]    one active item: docs-for-newcomers (reviewing)
[ok]    docs-for-newcomers is reviewing; a verification run is due at verifying
[ok]    on branch docs/docs-for-newcomers
[warn]  1 uncommitted change(s); expected mid-session, not at close
PASSED - 0 failures, 1 warning
```

The item's `verification` field, command by command, at head `871f976`:

```
npm test                                                   TEST_EXIT=0   (276 pass / 0 fail bun, pass 276 / fail 0 node)
npm run typecheck                                          TC_EXIT=0
./bin/mstack lint-plugin .                                 LINT_EXIT=0   PASSED - 0 failures, 0 warnings
node scripts/check-doc-links.mjs README.md docs/wiki/*.md  LINKS_EXIT=0  100 relative links checked, 0 broken
```

Link count 91 -> 99 -> 100 across the three rounds, 0 broken throughout.

Ledger: no row from me (panel lens, `agents/reviewer.md` Record-it). Same structural note as
rounds 1 and 2 - the implementer's round-3 row is at `05a7c49` and `871f976` is the row
itself, so the synthesizing pass records at whatever head it is standing on.

## The subgraph finding, closed

My round-2 finding 2 was that `spec` and `impl` are referenced on the `steps -->` edges
before being declared inside `subgraph orch`, and that if mermaid binds a node to the scope
where it is first *referenced* rather than where it is *declared*, the frame would contain
only `review` and the entire round-1 blocker-4 fix would collapse silently.

I accept the coordinator's probe and the method. Running mermaid 11.17.0's own parser db over
the shipped source is rung 4 on the question I actually asked - membership is
`[spec, impl, review]` - and the mutant that declares only `review` returning `[review]` is
the part that makes it evidence rather than a formality: it shows the probe can fail. A probe
that cannot fail would have told me nothing. Not restructuring the diagram once the binding
was measured is the right call; my proposed reordering was a hedge against an unknown, and
the unknown is now known.

One residual, stated rather than swept: the probe pins mermaid 11.17.0, and GitHub pins its
own version, so "renders on GitHub" is still one inference step from what was measured.
Subgraph membership is not semantics I would expect to move between versions, and the syntax
is unremarkable, so I am not reopening it - but the honest rung on the diagrams for bullet 2
is 4 on membership and 3 on the GitHub render itself. Nobody in this panel has seen either
diagram rendered.

## Confirmations

**1. The reintroduced jargon (my round-2 blocker).** All three fixed, at first use, and I
checked the anchors resolve to real headings rather than trusting the link count:

| Round-2 finding | Now | Anchor target |
|---|---|---|
| "fanned-out reader" unglossed, `S&P:43` | `:43` "one per fanned-out reader (fanning out runs several readers in parallel, each with its own narrow question)" | n/a, inline gloss |
| "lens" first used undefined, `S&P:48` | `:48` `[lens](The-Agents.md#reviewer)` | `## reviewer`, `The-Agents.md:139`. No collision with `## spec-reviewer` at `:116`, which generates `#spec-reviewer` |
| "rung" 90 lines before its definition, `S&P:70` | `:70` `[rung](#the-evidence-ladder)` | `## The evidence ladder`, `Skills-and-Playbooks.md:157`, same page |

The gloss landed at `:43`, which is the *first* occurrence; the two later uses at `:126`
("before fanning out") and `:132` ("per fanned-out reader") now follow a reader who has been
told what the word means. That ordering is the thing that matters and it is correct.

**2. The round-1 partial: worktrees.** Fixed. `S&P:30` is now
`isolated [worktrees](The-CLI.md) (each its own checkout of the repository)` - the gloss moved
to first use instead of arriving twenty lines later at `:50`, which was my exact complaint.
The link still has no anchor onto a 484-line page, but with the definition now inline the
link is a "more detail here" affordance rather than the only route, so the reader is no
longer dependent on it. Closed.

**3. The new caption.** Read cold, on both pages. `Home.md:39-43`:

> One box is deliberately missing: the session gate, `mstack gate`, is not a step in this
> flow. The `Stop` hook runs the fast gate at the end of every turn, and every pass runs
> `mstack gate` before it acts, so it can go red at any point in the picture. Both gates are
> on [Gates-and-Hooks](Gates-and-Hooks.md).

Teachable, and it does **not** leave a wrong model. The load-bearing half is the second
clause - "every pass runs `mstack gate` before it acts, so it can go red at any point in the
picture" - and that is precisely the model a newcomer needs: the gate is ambient, not a step.
That was what the old sentence was reaching for and, per my sibling, getting wrong. The
correction keeps the teaching and fixes the fact, which is the right trade.

It did cost some plainness, and that is the nit below.

**4. Nothing else regressed.** The diff is `README.md` 3 lines, `Home.md` 7,
`Skills-and-Playbooks.md` 9, plus `.mstack/` bookkeeping and the round-2 lens reports landing
on disk. No other page touched. I re-read all three changed hunks whole. The
`/mstack:understand` cell at `:43` grew by the parenthetical to about 33 words and is still
one scannable line, not a paragraph-cell.

## Acceptance, quoted - final reader verdict

**"All five agents, all twelve skills and all seven playbooks are documented on wiki pages a
stranger can read: purpose, when it runs, what it writes, what it must not do"**

Met. Round 1 I scored skills 2/4 on the four named dimensions and called it the blocker;
round 2 closed it; round 3 closed the vocabulary that the round-2 fix had itself introduced.
Final state, all three casts at four dimensions:

| | purpose | when it runs | what it writes | what it must not do |
|---|---|---|---|---|
| 5 agents | `The-Agents.md:19-24` | `:33-43` | `Writes` column + sections `:91-170` | `Must never` column |
| 12 skills | `S&P:19-32` | `S&P:19-32` + route table `:88-99` | `S&P:39-52` | `S&P:59-72` |
| 7 playbooks | `S&P:114-125` | route table `:88-99` | `S&P:128-137` | `Its discipline` column |

Every one of them is a section or a row a stranger can find and cash, not a name in a cell.
The three artifact gaps I named in round 1 are each stated, and the terms a stranger would
have stalled on are glossed or linked at first use.

**"The lifecycle and the request-to-router-to-playbook-to-agents-to-gate flow each carry a
mermaid diagram that renders on GitHub"**

Met, with the rung stated above. Both diagrams present; the flow diagram's shape defect from
round 1 is corrected without growing - nine nodes before and after, one subgraph frame added,
edges 9 -> 10. The `merge-gate` box names the thing that actually decides landing, and the
caption teaches the session gate by explaining its absence rather than by drawing it in the
wrong place. On my round-1 question "would you understand the flow from the diagram alone
before reading the prose": yes, now.

**"Every wiki content page and the README top open with a plain-language summary before
mechanism detail, and the README first screen maps where each concept lives"**

Met and unchanged since round 2. Round 3 touched no opener. All eleven summaries verified
individually in round 1 and re-confirmed in round 2; the README map is nine rows, ending at
raw line 31, above the fold. Note the nit below is about a diagram *caption*, not an opening
summary, so this bullet is not what it bears on.

## Nit, recorded not blocking

`Home.md:40-41` and `README.md:53-54` - the caption now introduces two terms a stranger
meets cold on the two most newcomer-facing surfaces in the project: **the `Stop` hook** and
**the fast gate**. Both have real homes on the linked page (`Gates-and-Hooks.md:26` is the
`Stop` row of the five-hook table; `:252` contrasts `gate --full` with the fast gate), and
Home's paragraph ends with that link. README's does not - its only route is the map row at
`README.md:26`, twenty-seven lines up.

Secondary: Home's paragraph now names three gate-things - "the session gate", "the fast
gate", and the `merge-gate` box in the diagram directly above - and then closes "Both gates
are on Gates-and-Hooks". A reader counting nouns gets three and is told two. The fast gate is
a *mode* of the session gate rather than a third gate, which the sentence does not say.

Either would be fixed by one clause, e.g. "...runs the gate in its fast mode at the end of
every turn". Not worth a round on its own; worth doing next time these lines are touched.

## Panel note

I own the reader lens only. My sibling owns whether the new caption's claims about the `Stop`
hook and per-pass gate runs are true; I judged only whether a stranger can read them and what
model they leave behind.

## Closing

Across three rounds this went from a doc set where twelve skills were a table of names and
the landing diagram taught the wrong gate, to one where a stranger can find every agent,
skill and playbook, learn what each leaves on disk, and read the flow picture without being
misled about where the merge decision happens. The round-3 fixes were surgical - three glosses
and a link - and the implementing pass resisted the temptation to restructure a diagram that
measurement had just shown to be correct. The user's complaint was "the docs are not really
friendly". On the reader lens, that complaint is answered.
