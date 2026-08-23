# Orchestrate

A program of work: many changes, several tracks, more than one session.

**Read this first.** Work one agent could finish inside a single session is not a program. The
ceremony below costs real throughput, and in at least one measured head-to-head it turned a
twelve-unit job into one landed unit while a plain agent landed all twelve. Below that line,
use [feature](feature.md) and move on. Choosing this playbook is a decision worth recording
with `mstack decide`, including why the simpler route was rejected.

1. **Frame.** One sentence naming the outcome. Then the tracks: groups of work that do not
   write the same files.
2. **Seed the state.** One item per unit in `.mstack/state.json`, each with its own slug and a
   real acceptance list. `mstack state add --slug <s> --title <t> --acceptance "..."`.
3. **Isolate.** `mstack worktree new <slug>` per unit that runs concurrently. Each worktree
   carries its own `.mstack/`, which is what makes "one active item" mean one active item
   *here* rather than one across the machine. Record the base SHA in that worktree's
   `current.md`.
4. **Pilot one unit end to end** before fanning out. A brief that has never been executed is a
   guess about how the work decomposes.
5. **Scale**, in waves. Each worker gets a brief a stranger could execute:

   ```
   GOAL        one sentence, the outcome
   SCOPE       paths it may write; paths it may not; its worktree
   CONTEXT     file and PR pointers; upstream reports pasted in full, because
               workers cannot see each other
   ACCEPTANCE  checkable criteria, one per line
   VERIFY      the exact commands, plus the gotchas you already hit
   TIMEBOX     on expiry, return partial findings and stop rather than run on
   FORBIDDEN   no rebase, no force-push, no work outside scope
   REPORT      status, branch, head SHA, PR, verdict, what was actually run,
               deviations, suggested follow-ups
   ```

   **The brief is the product.** A vague one fails quietly, because a worker cannot ask a
   question. Missing fields are a reason not to launch it yet.
6. **Land continuously.** Integration starts with the first verified unit, not after the last.
   Walk up from the lowest unmerged change and stop at the first without a passing verdict: a
   verified change sitting above an unverified one is not landable, because merging it pulls
   the gap in underneath.
7. **Close.** `mstack worktree prune` once branches are merged. It lists before it removes, and
   it removes nothing without `--yes`.

**Reply:** the tracks, what landed, what is still open, and every unit that returned partial.
