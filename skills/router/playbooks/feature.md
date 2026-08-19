# Feature

1. `/mstack:understand` over the subsystems this touches. Skipping this on unfamiliar code is
   how a feature ends up parallel to the one that already exists.
2. `/mstack:design`. Two structurally distinct candidates before you pick one, or a stated
   reason the constraints forced the answer.
3. **Throughput checkpoint**, as four todo items. A dimension that genuinely does not apply
   keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** What has to land before anything can fan out.
   - **Independent workstreams.** Disjoint files, layers or services parallelize. Shared writes
     serialize.
   - **Shared mutable state.** Split the target by default. Serialize only for a real
     invariant, and name it.
   - **Smallest safe decomposition.** If one worker is right, say why.
4. Delegate implementation to `mstack:implementer`. **Mandatory, with no skip-with-reason
   escape**: the gain here is review separation, not lines saved, so "it was faster to do it
   myself" is not a reason.
5. `/mstack:verify` on the surface a user actually reaches. Inconclusive is not a pass, and
   verifying on the wrong surface is worse than not verifying, because it looks like proof.
6. Rebase into small, ordered commits. Each one should build and pass on its own.
7. `/mstack:review`, then `/mstack:ship`.

**Reply:** what it does for the person using it, what it costs the person maintaining it, and
where it was verified.
