<!-- Origin: the procedure from mattpocock/skills, skills/engineering/improve-codebase-architecture/SKILL.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: the source ends in an HTML report and talks the result over with the user; this playbook asks the user nothing and ends with candidates filed as pending items, capped at five. -->

# Deepen

Find where the code should be deeper, and file what you find as work. It files candidates;
it implements nothing, designs no interface in detail and opens no branch.

Every term below (module, interface, depth, seam, adapter, the deletion test) is defined in
[deep modules](../../design/references/deep-modules.md). Read it first and use its words.
Intake does not apply: begin the reply with `skip: deepening, the playbook files its own items`.

1. **Scope.** If the request names a direction (a module, a subsystem, a pain point), take
   it. Otherwise `git log --oneline` and the files that keep changing are the hot spots:
   deepening pays off where change keeps landing. If the changes are scattered, widen the net.
2. **Explore.** A small repository you read yourself. A larger one takes at most three readers
   (`general-purpose` agents, which can write files; Explore agents cannot), each with a
   disjoint area and one question: where does understanding one concept mean bouncing between
   many small modules, where does an interface cost as much as its implementation, where do
   callers repeat what a module should hide, where are tests forced past the interface. Each
   writes to `.mstack/progress/explore_<topic>.md` and returns the path (findings in its reply
   if the write is refused).
3. **Find candidates.** Run the deletion test first on everything that looks shallow: delete
   it in your head and see whether the complexity vanishes (a pass-through) or reappears
   across its callers (it earns its keep). Then classify the dependencies of what survives by
   category. Keep a candidate only when you can point at the files where it holds.
4. **Rank, and keep at most five.** What other candidates or open items wait on ranks first.
   A repository with no candidate worth filing files none and says so.
5. **Check the queue.** `mstack state list`, and `mstack state show <ref>` for any open item
   on the same files. A candidate one already covers is not filed again: name it in the reply.
6. **Check before filing.** Just before each `state add`, re-derive by a search every count,
   file, line and function the item names, counting the unit its title names (handlers, not
   matches), and `state show` every open item it cites. Never copy from a reader's note or an
   earlier read. The item states only what that showed; a claim that fails is dropped, or the
   candidate is not filed.
7. **File each one** as a `pending` item, with no decision made on the user's behalf:

   ```
   mstack state add --slug <s> --title "<the problem, stated>" \
     --description "<the files, and the deepening that would fix it>" \
     --acceptance "<observable: what the deepened module's interface is>" \
     --acceptance "<observable: what stops being duplicated or passed through>" \
     --acceptance "<observable: tests that go through the interface>" \
     --source "deepen playbook run, <date>, .mstack/progress/deepen_<date>.md" \
     --seam "<the interface that becomes the test surface>"
   ```

   The title names the problem, not the fix; each criterion can be checked by reading or
   running something. Do not sketch the interface beyond what a criterion says.
8. **Stop.** Write what you checked and rejected to `.mstack/progress/deepen_<date>.md`, the
   path the items' `--source` names (a second run that day appends under a new heading), and
   `mstack decide` any call that shaped the ranking. Do not ask which candidate to take, do
   not offer to file or fix anything else, and end the reply with a statement, not a
   question. A defect met on the way is one line, under "found, not filed".

**Reply:** what was filed, each with its ref and one line on why it ranks where it does; what
an open item already covered; what you rejected, and why. If nothing was filed, say so and what you checked.
