# Item 64: plans-for-a-contextless-executor (implementer)

Branch `feat/task-sizing-rule`, base `7f77190`. Commits: `cb01c3f` (test), `e669a8e` (text, headers, lint entries), `a371143` (docs), plus this report.

## What changed

The spec skill (section 4), the spec-author, the `tasks.md` template, the spec-reviewer and the orchestrate playbook now carry one size rule and one no-context rule, adapted from obra/superpowers `skills/writing-plans/SKILL.md`. Three files carry origin headers and are required by `lint-plugin`: `skills/spec/SKILL.md`, `skills/router/playbooks/orchestrate.md`, `agents/spec-author.md`. Criterion 2 (a real spec judged by the spec-reviewer) is the reviewer's live run and was not attempted. The wording is not shown to work; prose has no unit test.

## Pin and licence

Pin: `8e1262a3bae92b640d87fa81c51c53b65e490590`, from `git log -1 --format=%H -- skills/writing-plans/SKILL.md` in the clone at `.../scratchpad/impl61/up`. It is the last commit touching that file in that checkout (checkout HEAD `3be5aad3dd2400ef23b15680969f4bcd3b6d7b8b`); upstream may have moved since.
Licence: `git show 8e1262a:LICENSE | cmp - licenses/obra-superpowers-LICENSE.txt` printed nothing and exited 0 (identical).

## Point 4: does the spec-author get the spec skill?

No. `agents/spec-author.md` frontmatter has no `skills:` field (`tools`, `model`, `color` only); `agents/implementer.md` has `skills: - test-first`. So the agent file carries both rules in short (6 lines) plus a pointer to section 4 of the skill, and because that wording derives from the source it has its own header. `agents/spec-reviewer.md` also has no `skills:`; its two checks are written to be self-contained (they name the failure shapes) and point at section 4. It has no header: the lines are mstack's own checks, naming what to find, and the rule text they point at lives in the skill, whose header covers it. The one phrase near the source ("a setup or docs step apart from the task that needs it") is a failure example, not the source's sentence. Judgement call, flagged for the reviewer.

## Final text

`skills/spec/SKILL.md` section 4 (the R-id and close rules kept):

```
**Size.** A task is the smallest unit that carries its own test cycle and is worth a fresh
reviewer's gate. Setup, configuration, scaffolding and docs fold into the task whose deliverable
needs them. Split only where a reviewer could reject one task and approve its neighbour. Each
task ends in something that can be tested by itself.

**Written for an executor who has only this file.** Each task gives the exact paths it touches,
the exact command that shows it done and what that command prints. Never "TBD", "add error
handling", "handle edge cases", "as in task 3", or a name (type, function, file) that no task
or existing file defines.
```

`agents/spec-author.md` "Design and tasks": the same two rules in six lines, ending "Section 4 of `${CLAUDE_PLUGIN_ROOT}/skills/spec/SKILL.md` has both rules in full."

`agents/spec-reviewer.md` two added checks (Then completeness): each task sized by the rule in section 4 (name one too small, a setup or docs step apart from the task that needs it, or too big, a reviewer could not approve half and reject the rest); each task executable by someone with only `tasks.md` (name the placeholder, the missing path or command, or the undefined name).

`skills/spec/references/templates.md` task 1.1 line: `- [ ] 1.1 <task: what it changes, in which `path`; its test in `tests/path`; done when `<exact command>` prints `<what it prints>`> (covers R1)`.

`skills/router/playbooks/orchestrate.md`: step 1 gains "A unit is the smallest piece that carries its own test cycle and deserves a fresh reviewer's gate; setup, configuration and docs fold into the unit whose deliverable needs them, and two units are separate only where a reviewer could reject one and approve the other." Step 5 gains "Write it for a worker with only the brief: exact paths, the exact VERIFY command and what it prints; never "TBD", "handle edge cases", "as in unit 3", or a name the brief and the repository do not define."

Deviation: the size rule sits in step 1 only, not also in step 2 (step 2's "one item per unit" now follows a step that defines a unit; repeating it would only duplicate).

## Header clause table (source lines at `8e1262a`)

| header clause | source heading and lines | where in mstack |
|---|---|---|
| Task Right-Sizing, reworded | Task Right-Sizing 36-43 | spec SKILL.md "Size"; orchestrate step 1; spec-author para 1 |
| Overview premise only (reader has no context) | Overview 8-12 | spec SKILL.md "Written for an executor"; orchestrate step 5; spec-author |
| "questionable taste", skilled-developer, test-design, docs to check, "DRY. YAGNI. TDD. Frequent commits" not carried | Overview 10, 12 | absent |
| "TBD" | No Placeholders 131 (first bullet) | all three |
| "add error handling", "handle edge cases" (not "add validation") | No Placeholders 132 | spec SKILL.md, spec-author; orchestrate has only "handle edge cases" |
| "Similar to Task N" as "as in task N", remedy differs | No Placeholders 134 | "as in task 3" / "as in unit 3" |
| undefined type/function/method; here files too, existing files define | No Placeholders 136 | "a name (type, function, file) that no task or existing file defines" |
| "Write tests for the above", "describe what to do without showing how" not carried | No Placeholders 133, 135 | absent |
| "Exact file paths always", "Exact commands with expected output" carried; "Complete code in every step" not | Remember 139-141 | "exact paths ... exact command ... what it prints" |
| not copied: Bite-Sized Task Granularity, Plan Document Header (Global Constraints), Task Structure (Files/Interfaces, steps, commit), Scope Check, File Structure, Self-Review, Execution Handoff, announcement, Context (worktree), save path | 14, 16, 18, 21-34, 45-77, 79-126, 144-174 | absent; spec file path stays `.mstack/specs/<slug>/tasks.md` |

Per-file differences: the orchestrate header says "scaffolding" is left out of what is folded in (its text says setup, configuration, docs) and lists only "handle edge cases" (its text has no "add error handling"). The spec-author header is a pointer to the spec skill's header, not a second clause list.

## Lint: red then green

Entries were added test-first (`cb01c3f` has only the test list).

```
AssertionError: header removed from skills/spec/SKILL.md: expected a failure, got a pass
 26 pass / 1 fail
```
After adding spec to `ORIGIN_REQUIRED`:
```
AssertionError: header removed from skills/router/playbooks/orchestrate.md: failed silently. Nothing matched /skills\/router\/playbooks\/orchestrate.md.*no origin header/. Got ["skills/spec/SKILL.md: no origin header -> ..."]
```
spec-author (spec and orchestrate entries present, spec-author absent):
```
AssertionError: header removed from agents/spec-author.md: expected a failure, got a pass
 26 pass / 1 fail
```
Green after all three: `bun test ./tests/lint.test.ts` 27 pass, 0 fail; `./bin/mstack lint-plugin .` PASSED - 0 failures, 0 warnings.

## Mutants (copy of the checkout in `.../scratchpad/impl64m/c`, header line removed, `lint-plugin .`)

| mutant | result |
|---|---|
| remove header from skills/spec/SKILL.md | `[fail]  skills/spec/SKILL.md: no origin header`, FAILED - 1 failure (killed) |
| remove header from skills/router/playbooks/orchestrate.md | `[fail]  ... orchestrate.md: no origin header`, FAILED - 1 failure (killed) |
| remove header from agents/spec-author.md | `[fail]  agents/spec-author.md: no origin header`, FAILED - 1 failure (killed) |
| restored | PASSED - 0 failures |

(The exit codes printed empty in my loop because of `PIPESTATUS` in zsh; the FAILED/PASSED lines are the evidence.)

## Verify, at head after the last edit (docs commit a371143)

- `./bin/mstack lint-plugin .`: PASSED - 0 failures, 0 warnings.
- `npm run typecheck`: no errors (tsc printed nothing).
- `./bin/mstack gate` (run before this report was written): PASSED - 0 failures, 0 warnings.
- `npm run test:bun`: 631 pass, 0 fail (count unchanged: the new entries sit inside an existing looped test).
- `npm run test:node`: 631 pass, 0 fail.
- Line counts: skills/spec/SKILL.md 82, skills/spec/references/templates.md 78, skills/router/playbooks/orchestrate.md 53 (limit 56), agents/spec-author.md 79, agents/spec-reviewer.md 65.

## Not shown

Whether a spec-author following this text writes tasks a stranger can execute (criterion 2). Whether the reviewer's two checks catch anything. `docs/wiki/How-A-Work-Item-Flows.md` was left unchanged: no sentence in it became untrue.

## Look first

1. The spec-author and spec-reviewer decisions (header on the first, none on the second).
2. Each "Adapted:" clause against the lines in the table, especially the "carried" quotes and the per-file differences.
3. The orchestrate step 2 deviation.
