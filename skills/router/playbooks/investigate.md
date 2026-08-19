# Investigate

Answer a question about the system. Produce understanding, not a change.

1. Split the question. "How does it work" goes to `/mstack:understand`. "Why is it like this"
   needs history: git log and blame on the seam, plus whatever issue tracker or chat the repo
   is connected to.
2. For anything with more than three moving parts, fan out two or three readers with narrow,
   disjoint questions rather than one reader with a broad one. Each writes to
   `.mstack/progress/explore_<topic>.md` and returns the path.
3. Synthesize into one account: Overview, Key concepts, How it works, Where things live,
   Gotchas.
4. Verify the claims that matter. A claim about behaviour gets rung 4; a claim about structure
   gets rung 2 with a real `file:line`. Say where each one stopped.
5. `mstack decide` the conclusions worth remembering, with the evidence path.

**Reply:** the account, and the specific things you could not establish.
