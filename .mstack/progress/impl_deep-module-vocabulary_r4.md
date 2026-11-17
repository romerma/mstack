# Implementation, round 4 - deep-module-vocabulary

Written by the coordinator, not by an implementer agent (decision row `review-r4`, 2026-11-17).

One change, to queue item 79 only, through `./bin/mstack state set 79`:

- Title: "gate, statusline and worktree each ask git for the branch or the dirty state" became
  "gate and statusline each ask git for the branch".
- Description: the clause calling the gate's dirty check and `worktree.ts` `isDirty` the same
  question was deleted. One sentence was added: "Dirty state is not part of this item:
  worktree.ts isDirty passes --ignored=matching on purpose, and the comment above it says why."
  Evidence: `src/worktree.ts:67-84`. The quoted gate output lost its `[ok]` prefix, so the quote
  no longer depends on the gate's column spacing.
- Acceptance 2: "head and dirty" became "and head", and `worktree.ts` no longer takes answers
  from the module. The other three criteria are unchanged, word for word.

Nothing else changed: no file outside `.mstack/`, and no other item. No test was run, because
no code or prose changed. This pass asserts no verdict; the reviewer's row is the verdict.
