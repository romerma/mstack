# Refactor

Structure changes, behaviour does not. Everything here exists to make that claim checkable.

1. **Pin the current behaviour first.** Characterization tests against the code as it stands,
   committed before you touch anything. Without them you are not refactoring, you are
   rewriting and hoping.
2. `/mstack:understand` the seam. Name what the module currently hides and what leaks through
   it, because that is what you are changing.
3. `/mstack:design` the target shape. Record at least one rejected alternative.
4. Migrate callers, then delete the old path **in the same change**. A legacy API kept "just in
   case" is a permanent tax, and the deletion never happens later.
5. Delegate the mechanical work. Keep each commit to one transformation.
6. Verify by running the tests from step 1 unchanged. If you had to edit them, behaviour
   changed: say what changed and why, or revert.
7. `/mstack:review`, then `/mstack:ship`.

**Reply:** the shape before, the shape after, and the evidence behaviour held.
