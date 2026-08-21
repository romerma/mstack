# Current session

> Live state. Keep it updated **while** you work, not at the end. This file is
> what survives a crashed context window.
>
> On close: append the summary to `history.md` and reset this file to the
> empty template below.

- **Item:** 11 sandbox-weather-dogfood
- **Status:** in_progress, all four acceptance criteria met, awaiting the protocol's
  closure confirmation
- **Branch:** chore/sandbox-dogfood
- **Base:** main
- **Worktree:** none (sandbox/ is a nested, gitignored repository)

## Plan

- Add `sandbox/` to .gitignore so nothing in it can reach GitHub. **Done**, commit 70c43db.
- Create sandbox/ as its own git repository and run the weather app through the complete
  mstack lifecycle. **Done**: sandbox item 1 weather-app is `done`, merged to its main.
- Keep `sandbox/PROTOCOL.md` as a command-by-command record of the friction. **Done**, and
  fact-checked by an independent pass that refuted two of its claims.
- Lighthouse 100 across the board with the report saved as evidence. **Done**: four runs,
  100 in all five categories, including one under real devtools throttling.
- Close both stores green.

## Log

- Sandbox item 1 weather-app closed: spec path over three rounds (12 then 6 blocking
  findings from independent reviewers, both on a different model than the author), two
  sequential implementer passes, independent review with 8 findings, all closed and
  confirmed. Verdict `live-verified` at 897f5aaf by a non-implementing verifier, merged
  `--ff-only` so no SHA was rewritten.
- The app: Astro 7.2.4 static, `dependencies` exactly `{astro}`, 248 unit tests, 140 browser
  drills, Lighthouse 100 x5, R36 at 9552/30720 bytes.
- Item 12 rm-guard-command-boundary added to this repo's queue: a real defect in the shipped
  `rm` guard found by using the tool, reproduced at rung 5, four false positives and two
  bypasses. Still `pending`.
- PROTOCOL.md fact-checked: nine friction claims, **two refuted** (F2 and F3 were my errors,
  not the plugin's), seven confirmed, plus one the fact-check found that I had missed (F10).
  All findings applied; closure confirmation in flight.

## Verification

- Rung 5 for the app: four Lighthouse runs and a live browser acceptance walk.
- Rung 5 for the friction claims: the fact-check reproduced each one independently, and hit
  the `rm` guard defect unplanned while working.
- Rung 1 for the agent timings and token counts in PROTOCOL.md: they come from task
  notifications and are not verifiable from either repository. Said so in the document.

## Next step

- On the fact-check's confirmation: record a verdict for item 11 citing it, close the item,
  append to history.md, and hand the protocol to the user for the refinement round. Item 12
  stays pending; it is the first candidate for that round.
