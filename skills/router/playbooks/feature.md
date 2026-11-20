# Feature

Steps 1, 2, 6 and 8 change with the item's size, as the
[size matrix](../references/size-matrix.md) sets out; the rest hold at every size.

1. `/mstack:understand` over the subsystems this touches, at size `l`. At `s` and `m`,
   `skip: size <s|m>` and read the code the change touches yourself: skipping both on
   unfamiliar code is how a feature ends up parallel to the one that already exists.
2. `/mstack:design`. At `l`, two structurally distinct candidates before you pick one, or a
   stated reason the constraints forced the answer; at `m`, the design written in the session,
   with at least one rejected alternative; at `s`, `skip: size s`.
3. **Throughput checkpoint**, as four todo items. A dimension that genuinely does not apply
   keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** What has to land before anything can fan out.
   - **Independent workstreams.** Disjoint files, layers or services parallelize. Shared writes
     serialize.
   - **Shared mutable state.** Split the target by default. Serialize only for a real
     invariant, and name it.
   - **Smallest safe decomposition.** If one worker is right, say why.
4. **Test-first**, before delegating. Read the item's seams with `mstack state show <ref>`
   (`mstack state active` prints only the slug) and write them into the brief as pre-agreed, so
   the implementer does not ask anyone to confirm them. An item that changes behaviour but has no
   seams gets them first: `mstack state set <slug> --seam "..." --seam "..."`, every seam in
   that one call, because `--seam` replaces the list. `skip: no behaviour` is only for a change
   with none, and you still delegate. The brief asks for the first test only, run red for the
   expected reason with the output pasted, before any code; the rest follow one slice at a time.
   The implementer already has the test-first reference in its context; the brief does not
   repeat it.
5. Delegate implementation to `mstack:implementer`. **Mandatory, with no skip-with-reason
   escape**: the gain here is review separation, not lines saved, so "it was faster to do it
   myself" is not a reason.
6. `/mstack:verify` on the surface a user actually reaches. Inconclusive is not a pass, and
   verifying on the wrong surface is worse than not verifying, because it looks like proof.
   At `m` and `l`, also `mstack verify --mutation` once the implementer's last commit is in.
7. Rebase into small, ordered commits. Each one should build and pass on its own.
8. `/mstack:review`, then `/mstack:ship`. At `s` one lone reviewer; at `l` a panel with two or
   more lens reports in one round.

**Reply:** what it does for the person using it, what it costs the person maintaining it, and
where it was verified.
