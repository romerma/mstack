# Resume

Pick up work that was interrupted. The point is to not restart it.

1. `mstack gate`. It tells you whether the state on disk is coherent before you trust it.
2. `mstack state active`, then read `.mstack/progress/current.md` end to end. Its last section
   answers exactly the question you are asking.
3. Read the report files for the passes that already ran: `.mstack/progress/*_<slug>.md`. That
   work is done. Redoing it costs a session and produces a second opinion nobody asked for.
4. Reconcile against reality. The recorded state was true when it was written:
   - `git log --oneline <base>..HEAD` for what actually landed
   - `git status` for what is uncommitted
   - `mstack ledger check <slug>` for whether the verdict still stands at this head SHA
5. Where the record and the repository disagree, **the repository wins.** Correct the record,
   and say in `current.md` what you corrected.
6. Continue from the recorded next step. If there is no recorded next step, that is itself the
   finding: say so, then derive one and write it down before doing anything else.

**Reply:** where the work actually stands, and what you are doing next.
