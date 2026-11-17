# Implementation, round 2: intake-step

Commits on `feat/intake-step` (from `33b86fb`): `faf6068` prose, `53a6881` seams code and tests, `fe4437b` pinning tests, `94e90ed` docs line. This report and the ledger row follow in a fifth commit. No push.

## Findings

| Finding | Reproduced | Change |
|---|---|---|
| B-1 partial answer order | yes, by reading `cli.ts` (re-state clears `decision_resolved`, `--resolves` sets it) and by the new test run against the mutant that keeps the pointer; the review's order B output is the failure | `skills/router/references/intake.md:32-41` |
| N-2 after a parked fork | yes (no sentence said what happens next) | `intake.md:34-36` |
| N-3 more than three forks | yes | `skills/router/SKILL.md:100-103` (cap line only) |
| N-7 program of work | yes | `intake.md:63-64` |
| N-1 skip list | yes | `skills/router/SKILL.md:21-24` |
| N-4 seams lines | yes, red below | `src/cli.ts` (`--seam` adds `+ added`, `clearField` adds `- dropped`) |
| N-5 blank seam on read | yes, red below | `src/state.ts` `parseItem` |
| N-8 em dash | yes | `docs/wiki/The-CLI.md:249-250` |

Not touched: N-6, N-9, N-10. Prose added: +18/-11 lines in the two skill files, net +7.

## Mutant table (written before the code, results after)

| # | Mutant | Expected killer | Result |
|---|---|---|---|
| M1 | `--seam` does not print added seams | seams "adds them and prints them" | killed (1 fail) |
| M2 | `--clear seams` prints only the count | seams "--clear seams removes the key..." | killed (1 fail) |
| M3 | blank seam accepted on read | seams "hand-edited blank seam" | killed (1 fail) |
| M4 | empty `[]` refused on read | same test, `[]` half | killed (1 fail) |
| P1 | re-state keeps `decision_resolved` | both new decisions tests, plus the old one | killed (2 fail) |
| P2 | `--status in_progress` guard removed | new tests and 3 older ones | killed (5 fail) |
| P3 | a plain `decide` row sets the pointer on every item with a fork | "a decision without --resolves..." and the new two-order test | killed (2 fail) |

All source reverted after each (`git status` clean for src between mutants).

## Red output (seams, before `src/` changed)

```
AssertionError: The input did not match /added "CLI: `mstack state add` exit code and stdout"/. Input:
  actual: '1 storage-layer (pending)\n  seams: 0 seam(s) replaced with 2\n',
AssertionError: The input did not match /dropped "CLI: `mstack state add` exit code and stdout"/. Input:
  actual: '1 storage-layer (pending)\n  seams: 2 seam(s) -> (unset)\n',
AssertionError: seams [""] must be refused
  actual: 0, expected: 2
```

After the change `node --test tests/seams.test.ts`: 10 pass, 0 fail.

The B-1 tests pin behaviour that already held (the CLI was right, the prose was wrong), so there is no red for them; P1, P2 and P3 are their proof. Existing coverage checked first: "a decision without --resolves ... unblocks nothing" (`decisions.test.ts:92`) and "rewriting the fork drops the answer" (`:252`, but only for `spec_ready`, and not for the order). Added `decisions.test.ts:308` and `:339`: both orders with a plain row, ending refused at `in_progress`; and resolve, re-state, refused at `in_progress`.

## The two orders, following the new prose (real CLI, throwaway store)

```
=== order A (plain row, then re-state)
added 1 fee (pending)
recorded
1 fee (pending)
  decision_required: "1) Discount the fee? Recommended: no, flat fe..." -> "2) Own line in quote? Recommended: yes, guest..."
mstack: fee has an unanswered decision: "2) Own line in quote? Recommended: yes, guests see it."
        answer it with 'mstack decide --resolves fee ...' first
[exit 2]
=== order B (re-state, then plain row)
added 1 fee (pending)
1 fee (pending)
  decision_required: "1) Discount the fee? ..." -> "2) Own line in quote? ..."
recorded
mstack: fee has an unanswered decision: "2) Own line in quote? Recommended: yes, guests see it."
        answer it with 'mstack decide --resolves fee ...' first
[exit 2]
```

(My follow-up `--resolves` rows in the scratch store were refused for thin `--why`/`--evidence`; that all-forks path is already covered by existing tests, so I did not chase it.)

## Live runs

Setup per the review's Probe C wrapper: copy of `sandbox/bench/template`, git init, this checkout's `setup`, `state.verify` set, `env -i`, `--permission-mode auto`, opus, plugin-dir this checkout. Scratch: `.../scratchpad/impl55r2/`.

Attempt 1 (`streamA`, request: cleaning fee plus cancel): the agent took the discount question as a reversible decision ("fee is never discounted") and parked nothing, so it did not exercise the prose. It then went on to implement through a subagent. Killed (not a prose defect: the request's forks were judged reversible). Changed the request, not the prose.

Attempt 2 (`streamB`), prompt: `/mstack let a guest cancel a booking: a guest who cancels late should be charged a penalty, and one who cancels early should get money back. quote should also show what cancelling would cost.` Result success, 6 turns, 0.27 USD, 59 s. The agent read `intake.md`, reproduced the persistence bug, recorded 4 reversible decisions, ran `state add --slug cancellation-policy ... --decision-required "1) ... 5) ..."` with 5 forks, and ended the turn with one round (a single ask, five forks):

```
Questions for you. Answering "yes" accepts my recommendation.
1. When is a cancellation late? I suggest fewer than 2 days before check-in ...
2. What is the late penalty? ... 5. What should quote show? ...
Once you answer, I'll write the spec and get it reviewed before any code is written.
```

It said spec path, consistent with the router. No code, no playbook work after the round.

Attempt 3 (`streamC`), `--resume 03dcd008-edb3-4bf3-bccb-0dc74119f419` with: `for 1: no, make the cutoff 3 days before check-in instead of 2. I have not decided the rest yet.` 4 turns, 0.35 USD, 23 s. One Bash call, in this order:

```
mstack decide --phase intake --decision "Fork 1 answered by user: late cutoff is 3 days ..." --why ... --evidence ... --result "forks 2-5 still open; item stays parked" && \
mstack state set cancellation-policy --decision-required "2) ... 3) ... 4) ... 5) ..." && ... mstack gate | tail -1
```

No `--resolves`. Store afterwards (`decisions.tsv` last row is the plain fork-1 row with an empty resolves column; `state.json`: status `pending`, `decision_required` starts "2) Is the late penalty ...", no `decision_resolved`). Then by me:

```
$ ./bin/mstack state set cancellation-policy --status in_progress
mstack: cancellation-policy has an unanswered decision: "2) Is the late penalty ..."
        answer it with 'mstack decide --resolves cancellation-policy ...' first
[exit 2]
```

The final text restated forks 2-5 and said nothing gets built until answered. First attempt of the resume passed. No stray `claude` processes remain.

## Suite

`npm test` (bun half then node half): node half `tests 541, pass 541, fail 0`; bun half green (npm test chains with `&&` and reached node). `npm run typecheck`: clean. `npm run lint`: `PASSED - 0 failures, 0 warnings`. The load-sensitive tests (`costs.test.ts:698`, `run.test.ts:239`) did not fail.

## Decisions (also in `decisions.tsv`, phase implement)

- Cap exception in Autonomy only; the fork-round and spec-path sentences in `intake.md` only.
- `[]` stays valid on read, a blank entry is refused ("seams must not hold a blank string").
- `--seam` prints `+ added` for each new seam on every replacement, not only when none existed.

## Found, not fixed

- Attempt 1 shows that how many of a request's questions count as forks is the agent's judgement; nothing in the prose is wrong, but a request with only soft forks parks none.
- Prose steps are still pinned by nothing executable (N-6).
