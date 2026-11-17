# impl: test-first-reference (item 56)

## What changed

A new internal skill, `skills/test-first/SKILL.md` (`user-invocable: false`, 61 lines with
frontmatter and origin comment, self-contained), holds the test-first reference. `agents/implementer.md`
loads it with `skills: [test-first]` and says its brief's seams are pre-agreed. The router's
Delegation list gains "the item's seams (pre-agreed)". `feature.md` gets a new step 4 "Test-first"
before delegation (later steps renumbered 5 to 8; no other file references feature.md step numbers:
`rg` over skills, docs, agents found only the pstack research notes, which are about pstack's file).
Docs: wiki Skills-and-Playbooks, The-Agents, The-CLI (lint transcript counts), README, CHANGELOG.
**No SubagentStart hook was built**: the preload injects (Run 1). `bug-fix.md` and `refactor.md` unchanged.

## Files

agents/implementer.md (skills field line 5-6, seams paragraph line 32-34), skills/test-first/SKILL.md (new),
skills/router/SKILL.md:77, skills/router/playbooks/feature.md:15-20 (new step 4, steps 5 to 8 renumbered),
README.md, CHANGELOG.md, docs/wiki/{Skills-and-Playbooks,The-Agents,The-CLI}.md, .mstack/decisions.tsv (2 rows).

Commits: 4a3085f skill; 4a13610 implementer and router wiring; 9735040 playbook step; ccee121 docs; then
the transcript-count fix and this report.

## Sources

- tdd: `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/tdd/{SKILL,tests,mocking}.md` at `49dd158d1076134a641b33efb035946536778336` (MIT).
- superpowers: `skills/test-driven-development/SKILL.md` at `5bf4e78011075bcfc0dc295f0724994cd123ee71`, fetched with `gh api ...contents...?ref=`. LICENSE at that commit hashes `5f09b05242b8b94f400ae8a5b27422c489e40bbb`, identical to `licenses/obra-superpowers-LICENSE.txt` (shasum of both). Nothing about this project was sent.
- Deliberate departures from tdd: it says "confirm seams with the user", which the item forbids; it says nothing on mutants; superpowers' "delete code written before the test" and "ask your human partner" exceptions were left out (the first is not a habit this repo wants to enforce by prose, the second asks a person).

## Documentation relied on

- https://code.claude.com/docs/en/sub-agents (frontmatter table): "`skills` ... Skills to preload into the subagent's context at startup. The full skill content is injected, not only the description." Also: "You can't preload skills that set `disable-model-invocation: true`" (so `user-invocable: false` is the right flag; it hides the skill from the `/` menu, https://code.claude.com/docs/en/skills.md: "Set to `false` when only Claude should invoke the skill ... Use for background knowledge").
- https://code.claude.com/docs/en/plugins/components.md, "Frontmatter fields in plugin agents": supported fields include `skills`; ignored are `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`.
- The name form for a plugin skill referenced from a plugin agent is NOT stated on any page I fetched (sub-agents page read to char 100000 of 116378, skills page likewise). Skills are documented as `/plugin-name:skill-name` for commands. I therefore tried the bare `test-first` first; it worked (Run 1), so the other form was not needed. `src/lint.ts` already lists `skills` among allowed plugin-agent keys.

## Live runs (claude 2.1.326, model claude-opus-5-5, permission-mode auto, `env -i` rebuilt env, no ANTHROPIC_*, `--plugin-dir /Users/romerma/Code/mstack`, projects are fresh copies of sandbox/bench/template under the scratchpad `impl56/`, streams kept outside them)

Wrapper `scratchpad/impl56/run.sh` (perl alarm 600 around `env -i ... claude -p ...`); stream summariser `show.mjs`.

### Run 1: injection check, attempt 1 (bare name `test-first`), 25 s, success, $0.14

Distinctive sentence in the reference: "The red output is the receipt: no receipt, no code."
```
TOOL Agent {"subagent_type":"mstack:implementer","description":"Quote test-first reference","prompt":"Do not use any tool. Quote, word for word, two full sentences from the test-first reference you were given at start, ..."}
  [SUB] TOOL SubagentHandback {"message":"I didn't use any tools to answer this. ... Two full sentences, word for word, from the test-first reference:
  1. \"The red output is the receipt: no receipt, no code.\"
  2. \"For any change that has behaviour, the test comes first and you show it failing.\"
  Where they came from: ... The reference wasn't part of my starting system prompt. My system prompt only says \"The test-first reference is already in your context\". The text itself came in the same message as your request, as a skill expansion tagged `<command-name>test-first</command-name>`, with \"Base directory for this skill: /Users/romerma/Code/mstack/skills/test-first\"."}
RESULT ... <usage>subagent_tokens: 7542 tool_uses: 0 duration_ms: 9276</usage>
```
The only subagent tool call is `SubagentHandback`, the harness's delivery channel (no Read, no Bash); `tool_uses: 0`. Both quotes are verbatim from the file. This is the only attempt; the other name form and the hook were not needed. Caveat: the subagent says the text arrived as a skill expansion in the same message as the request, which is how the `skills` preload is documented to deliver. Issue 25834 does not reproduce on this version for this plugin agent.

### Run 2: behaviour, prompt `/mstack add a --guest option to the list command: ...` (fully specified, no fork), ran to completion 11:42, success, 20 turns, $1.30

Coordinator copied the playbook, read `intake.md` and `feature.md`, ran `state add` with two `--seam`s, then launched `mstack:implementer`. The brief (verbatim, relevant part):
```
SEAMS (pre-agreed, attach the tests here, don't ask anyone to confirm):
- CLI: `cli.main(["list","--guest",...], service=..., out=..., err=...)` stdout and exit code
- `BookingService.list(room=None, guest=None)` in bookings/app/service.py

TEST-FIRST: write the tests first and run them. Paste the red output, showing failure for the expected reason (unknown `--guest` arg or unexpected `guest` kwarg), into your report before you write any code. Required cases: ... Then implement and get `python3 -m unittest discover -s tests` green. Also do a mutant check ...
```
The brief carries the seams as pre-agreed and asks for red first. The implementer (report in the sandbox project, `.mstack/progress/impl_list-guest-filter.md`):
- red slice 1: `TypeError: list() got an unexpected keyword argument 'guest'` (FAILED errors=3), before service code;
- red slice 2: `bookings: error: unrecognized arguments: --guest Ada Lovelace` (SystemExit 2), before CLI code;
- then green, 25 tests; 8 mutants M1 to M8 all killed (drop filter, lower(), strip(), startswith, OR instead of AND, drop cancelled check, CLI passes guest=None, CLI drops --room), restored, suite OK after restore;
- it found, and did not fix, a pre-existing bug outside its scope (`JsonFileRepository.update` never saves, so `cancel` is not persisted) and the coordinator queued it as an item.
No playbook or router rewording was needed, so no rerun. Honest limit: one run; the coordinator had also read `intake.md`, so I cannot separate how much of "seams in the brief" came from the new step 4 versus the router's Delegation line; both were in context.

## Verification (last code commit ccee121 plus the transcript fix)

```
$ bun run test            # both halves
 542 pass / 0 fail / Ran 542 tests across 26 files. [91.23s]     (bun half)
ℹ tests 542  ℹ pass 542  ℹ fail 0                                  (node half, duration_ms 26137)
$ bun run typecheck       -> $ bunx --bun tsc --noEmit   (exit 0, no output)
$ ./bin/mstack lint-plugin .
[ok]    19 skills and agents, every cross-reference in 40 file(s) resolves
PASSED - 0 failures, 0 warnings
$ node scripts/check-doc-links.mjs README.md docs/wiki/*.md
96 relative links checked, 0 broken
```
`tests/costs.test.ts:698` and `tests/run.test.ts:239` did not fail. `claude plugin validate . --strict` fails on one warning that exists without my change too (verified with `git stash`): "CLAUDE.md at the plugin root is not loaded as project context". `./bin/mstack gate` at the end: PASSED, 0 failures, 1 warning (uncommitted report, expected mid-session); see the final rerun below.

No hook was built, so there is no hook red output or mutant table. The reference itself is prose with no unit test (the repo has none for prose); it is checked by lint and the two live runs.

## Decisions recorded (`./bin/mstack decide --phase implement`)

1. No SubagentStart hook: preload injects (evidence Run 1).
2. Reference kept at 61 lines with the mutant check as a section.

## Found, not fixed

- `claude plugin validate . --strict` is red on the plugin-root `CLAUDE.md` warning (pre-existing; CONTRIBUTING lists that command as a CI step).
- Docs do not state the name form for a plugin skill inside a plugin agent's `skills` list; relying on bare `test-first` working is empirical on 2.1.326. A claude upgrade that changes it would be caught by rerunning Run 1.
- The coordinator in Run 2 hit `Exit code 1 ... no active item` after `state add` (it then set the item active by hand); not investigated.

## Criteria

| Criterion | Evidence | Rung |
|---|---|---|
| 1 internal skill, user-invocable false, self-contained, origin headers | `skills/test-first/SKILL.md` frontmatter and origin comment; lint passes; licences byte-checked | 2 (read) plus lint, `test-verified` for the lint part only |
| 2 text in implementer context at start, quote without reading | Run 1: verbatim quote of the unguessable sentence, `tool_uses: 0`; hook not needed, decision recorded | 5 (one live run, one attempt, claude 2.1.326) |
| 3 feature.md test-first step before delegation; brief declares seams pre-agreed | feature.md step 4; Run 2 brief quoted above; implementer red output and mutants | 5 (one live run); the router Delegation line and step 4 were both in context so attribution is not isolated |
| 4 lint-plugin and both suites green | tails above | 4 |
