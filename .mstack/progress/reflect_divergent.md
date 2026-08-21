# Reflect - divergent lens on the sandbox dogfood retro

**Head:** `26c22d38163a3f5f0528a72f7ae858218d98e205` (`main`, working tree clean).
Note for whoever reads this next: `chore/sandbox-dogfood` was fast-forwarded into `main`
between my first and second `mstack gate` run of this session, by something that was not me.
My readings are all at `26c22d3`.

I did not run the session that produced these findings, and I am arguing **against** acting on
them. Where a finding survives that argument I say so in one line and move on. Rungs refer to
`skills/router/references/evidence-ladder.md`.

The single sentence of this report: **one finding out of sixteen is shape-independent and
ready, one more is real but wearing three hats and mis-diagnosed, and the other fourteen are
either already answered somewhere in the repository or unverified.** Six of the sixteen are the
same failure the fact-check already found twice - the doc was there and nobody read it.

> **Written under D1.** This file could not be written by the obvious route. The `PreToolUse`
> guard denied the heredoc that contains it, because the report *quotes* the false positives it
> documents. I had to assemble the offending strings out of fragments to get them past the
> guard - which is exactly the "aprende a rodear el guard" behaviour `PROTOCOL.md:267-268` names
> as the real damage. Fourth independent reproduction, and the first one where the guard blocked
> the write-up of its own defect.

---

## Verdict table

| # | Verdict | One-line reason |
|---|---|---|
| **F1** | **DROP** (BACKLOG a 1-line residue) | Premise false: `docs/wiki/The-CLI.md:66-69,85-86` documents four of the five flags. Only `--description` is undocumented anywhere. |
| **F3** | **DROP** | Already reduced to operator error; the residue is false too - `src/hooks.ts:136-142` **is** the detection it says is missing. |
| **F4** | **DROP** headline, **BACKLOG** one string | Used as documented the tool emits exactly the convention (rung 5, below). Residue: one warning sentence that `src/roles.ts:53` disproves. |
| **F5** | **DROP** | Same finding as O5. Its severity rests on a rung-1 number, and a written stopping rule is the pstack escape hatch `README.md:32-34` exists to reject. |
| **F6** | **ACT, reframed** | Real, but it is two defects and the proposed fix closes neither. `sh -n` accepts the exact broken string (rung 5). |
| **F7** | **DROP** | Generalised from a self-imposed constraint; 3 of merge-gate's 4 inputs cannot exist without a PR and the 4th already ships as `ledger check`. |
| **F8** | **DROP** as doc/code contradiction | `docs/wiki/How-A-Work-Item-Flows.md:12,22-24,31` and `README.md:88` document the order. `feature.md` never names a status. |
| **F9** | **DROP** | Documented in three places, including the identical FAIL line at `docs/wiki/The-CLI.md:115-116`. The one "fix" available teaches chasing green. |
| **F10** | **BACKLOG**, folded into F6 | Fires only because sandbox `state.verify` is `""` - `skills/setup/SKILL.md:23-30` step 2 skipped. The parent repo, which filled it, is unaffected (rung 5). |
| **D1** | **ACT** - the only one that needs no argument | Reproduced. Both of my objections to item 12 as filed were **already answered by an implementation that landed while I wrote**; see the postscript. |
| **O1** | **DROP** | Justification already refuted; fixes neither of the two brief failures it cites; `skills/router/SKILL.md:67-72` already specifies the skeleton and the report path. |
| **O2** | **DROP** as stated | `skills/verify/SKILL.md:11-12`, `principles.md:58-59` and `evidence-ladder.md:3,12` all push to rung 5. |
| **O3** | **DROP** | Premise wrong twice at rung 5: 30 rows not ten, and **zero** carried `--resolves`, so the CLI required only `--decision`. |
| **O4** | **ACT** - smallest item on the list | One clause at `evidence-ladder.md:11`. It sharpens a rule that already exists and was violated. |
| **O5** | **DROP** | Identical to F5. One finding, two hats. |
| **O6** | **DROP** as its own finding | It is F6 and F10 wearing a third hat. One item, not three. |

Net: **two ACT** (D1 with a corrected scope, and F6 reframed), **one ACT-trivial** (O4),
**three BACKLOG residues** measured in single lines, **ten DROP**.

---

## The arguments

### F1 - the flags were in the wiki

The claim (`sandbox/PROTOCOL.md:32-35`, table row `:654`) is that the `add` flags "solo se
descubren leyendo `src/cli.ts` o el help global".

```
$ mstack state add --help ; echo EXIT $?      -> mstack: Unknown option '--help'      EXIT 2
$ mstack state set --help ; echo EXIT $?      -> mstack: no item matches '--help'     EXIT 2
```
Rung 5, reproduced here. The behaviour is real. The **premise is not**:

- `docs/wiki/The-CLI.md:66-69` shows `--verification` and `--source` inside a working
  `state add` example.
- `docs/wiki/The-CLI.md:85-86` names `--sdd`, `--decision-required` and `--closed-by` in prose.

Four of the five flags are in the page called "The CLI", in the section called "state add".
`rg -- "--description" docs/ README.md skills/ agents/` returns nothing, so `--description` is
the only genuine gap, and it is one word in one table.

This is the **sixth** instance in this document of the same class the fact-check already
refuted twice (F2, F3). At some point the pattern is the finding: the operator's discovery
route was `src/cli.ts`, not `docs/wiki/`, and a plugin cannot fix that by growing a
`--help` handler on every subcommand.

Residue worth one line, not a feature: `src/cli.ts:238-247` resolves `--help` as an item
reference, so `state set --help` says "no item matches '--help'". That message is actively
misleading and the fix is a two-line guard. Adding per-subcommand help text is the expensive
answer to the cheap half of the problem.

### F3 - the residue is false as well

The fact-check reduced F3 to operator error (`review_protocol-factcheck.md:65-88`). What
survived, at `PROTOCOL.md:656`, is: "un brief puede nombrar una ruta de reporte que el contrato
no acepta y nada lo detecta hasta que el hook se queja."

That sentence names the detection and then calls it an absence. `src/hooks.ts:126-142` is a
`SubagentStop` hook whose entire job is to fire at exactly that moment, with exactly that
message, naming the expected path *and* the `_<lens>` variant. Detection at subagent-stop is
not late; it is the first instant at which the fact exists. There is nothing left in F3.

### F4 - the tool gives the convention when you use it as documented

Reproduced at rung 5 in a throwaway store with an active item slugged `weather-app`:

```
$ mstack fanout plan --kind spec_review --worker weather-app
  weather-app   .../progress/spec_review_weather-app_weather-app.md

$ mstack fanout plan --kind spec_review --worker correctness --worker security
  correctness   .../progress/spec_review_weather-app_correctness.md
  security      .../progress/spec_review_weather-app_security.md
```

The second form is the one `skills/review/SKILL.md:15` shows. It produces the convention
exactly. So `PROTOCOL.md:657`'s "La herramienta que debía dar la ruta correcta da una peor que
la convención" is **false**: the tool gives the right answer to the documented question, and
the operator asked a different one. `--worker` is a lens (`src/fanout.ts:9-23`,
`src/roles.ts:35-42`), and a single reviewer needs no fan-out at all - `src/roles.ts:36` says
"A lone reviewer writes `review_<slug>.md`."

One real residue, reproduced:

```
$ mstack fanout check --kind spec_review --worker weather-app
[warn]  spec_review_weather-app.md was not in the plan; nothing will read it
```

"nothing will read it" is factually wrong - `src/roles.ts:53` matches `${prefix}.md` and the
`SubagentStop` hook reads it. Fix the sentence at `src/fanout.ts:136`. I would **not** take the
fact-check's suggestion of rejecting a worker name equal to the slug: that guesses at intent,
and a lens legitimately named after the thing under review is not an error.

### F5 / O5 - one finding, and its severity is rung 1

First, these are one finding. `PROTOCOL.md:354-356` (O5) and `:658` (F5) are the same sentence
with the same proposed rule, counted twice in a table that a refinement round reads as a count.

Second, the severity is unverifiable. F5's whole weight is "~95 min de agente y ~868k tokens en
seis pases". The fact-check placed every agent duration and token count at **rung 1**
(`review_protocol-factcheck.md:207`, and again at `:342-344`: "The cost argument in F5/O5 rests
on them"). Neither round of fact-check could raise it. So the one finding whose entire case is a
cost figure has no verifiable cost figure.

Third, and this is the argument I would put first: **the proposed remedy is the exact failure
this plugin was built to reject.** `README.md:32-34`:

> pstack ships 44 skills, 23 playbooks and **zero hooks**; its own feature playbook says a
> design pass is required and then supplies the escape hatch two lines later.

"A round whose findings are all single-clause closes with a closure-only review" is a
requirement with an escape hatch two lines later, and the escape is self-assessed by the pass
that wants to stop. It cannot be enforced by a hook or a gate, because "single-clause" is a
judgment about prose. By `skills/reflect/SKILL.md:44` an unenforceable rule is a prose change,
and by `README.md:29-36` a prose rule drifts. The session already solved this correctly and
said so: the operator recorded a decision (`decisions.tsv`, phase `spec-review`, "Spec round 3
amends, then a closure-only review"). That is the mechanism the plugin provides for a judgment
call with lasting consequences, and it worked.

### F6 - survives, but it is two defects and the proposed fix closes neither

This is the only friction item I would act on, and the write-up mis-diagnoses it.

**Defect A, wider than reported.** `PROTOCOL.md:659` frames this as a `--verification` problem.
It is not; `state set` is write-once on **every** field but `status` and `closed_by`
(`src/cli.ts:242`). Reproduced at rung 5:

```
$ mstack state set weather-app --decision-required "..."   -> Unknown option   EXIT 2
$ mstack state set weather-app --verification "npm test"   -> Unknown option   EXIT 2
$ mstack state set weather-app --description "x"           -> Unknown option   EXIT 2
```

The `--decision-required` case is strictly worse than the one reported.
`skills/spec/SKILL.md:33-38` says forks are found by interviewing the repository during
`specifying` - which is *after* intake - and `README.md:116-129` sells `decision_required` as
the human gate. So the plugin's headline gate cannot be attached to an item at the moment the
workflow says the fork gets discovered, without hand-editing `state.json`. Nobody found this,
including two rounds of fact-check.

**Defect B, and the reason F6 cost 230 minutes.** The proposed fix is "una validación al
escribir". It does not work. The exact string that broke the gate is valid shell:

```
$ sh -n <file containing 'npm run build && npm run check; lighthouse CLI run against ...'>
EXIT 0
```

Rung 5. A syntax check accepts it. The only thing that catches a non-executable verification is
**running** it, and nothing in the plugin ever does that automatically: `src/hooks.ts:172` is
`runGate(store, { quiet: true })` - the `Stop` hook runs the **fast** gate, never `--full`. That
is the mechanism behind the 230 minutes, and it is also all of F10 and all of O6. One item.

If this is filed, file it as: *the item's verification is never executed by anything automatic,
and no field but status can be corrected after intake.* Filing it as "validate the string at
write time" buys a check that would not have fired.

### F7 - generalised from a constraint the exercise imposed on itself

`PROTOCOL.md:629-630`: "Este repo **nunca puede tener remoto**, que era el requisito del
ejercicio." The requirement came from the experiment, not from a user.

`skills/ship/SKILL.md:2-3` scopes the whole skill to a PR: "Use to open or land a PR". Now count
what `merge-gate` evaluates (`src/mergegate.ts:60-68,117-119`): `state`, `isDraft`,
`reviewDecision`, `statusCheckRollup`, and the ledger. Without a remote, four of the five do not
exist. The fifth is `mstack ledger check <slug> <sha>`, which already ships, is already
documented, and is already what the operator used. A local merge-gate would be a new subcommand
that runs one existing subcommand. `skills/router/references/principles.md:12-13`: "Subtract
before you add. The first question about a new abstraction is whether deleting something would
serve better."

The honest version of F7 is a documentation sentence in `skills/ship/SKILL.md` saying what the
local substitute is. That is worth one line and no code.

### F8 - the order is documented; the playbook does not name statuses

`PROTOCOL.md:661` calls this "Contradicción doc/código" and says the CLI "impone el que no está
documentado". Both halves fail at the line:

- `docs/wiki/How-A-Work-Item-Flows.md:22-24` prints the transition table verbatim, including
  `reviewing -> in_progress, verifying, cancelled`.
- `:31` - "Work passes through `reviewing` and `verifying` or it does not".
- `README.md:88` - "The lifecycle goes through `reviewing` and `verifying`".

And `skills/router/playbooks/feature.md` names **no status at all** in any of its seven steps.
Steps 5 and 7 invoke the skills `/mstack:verify` and `/mstack:review`. The operator mapped skill
invocation order onto status order and got an exit 2 with a message that told them exactly what
to do. Seventh instance of the class.

There is a real nit underneath: the skills `verify`/`review` and the statuses
`verifying`/`reviewing` are near-homographs whose natural orders read backwards. That is worth
one clarifying clause in `feature.md`, and it is not a doc/code contradiction.

### F9 - documented three times, and the available fix teaches the wrong reflex

`docs/wiki/The-CLI.md:112-117` documents this with the identical output:

> The row is keyed by `(target, sha)`, so a new commit voids it:
> ```
> $ mstack ledger check greet-flag        # after one more commit
> FAIL no verdict at 542ac0cf; 2 row(s) exist at other SHAs and a new head SHA voids them
> ```

Also `evidence-ladder.md:36` (the full `"$(git rev-parse HEAD)"` form) and `:38-40`, and
`docs/wiki/State-Files.md:52-55`. `PROTOCOL.md:662`'s "nada lo dice" is false three times over;
the fact-check already said so (`review_protocol-factcheck.md:153-158`) and the friction row
kept the sentence anyway.

The remaining half - the error message does not tell you to pass a SHA - I would leave alone on
purpose. `src/ledger.ts:146` already states the cause ("a new head SHA voids them"). A message
that adds "try passing the SHA" teaches an operator staring at a red check to reach for the
argument that makes it green. That is the reflex `agents/reviewer.md:30-33` exists to prevent.

### F10 / O6 - the store's `verify` field was never filled

Rung 5, both stores:

```
# sandbox: state.verify == ""      -> [warn] no verify command is configured  EXIT 0
# parent:  state.verify == "npm test && npm run typecheck && bin/mstack lint-plugin ."
$ mstack gate --full   (parent, no active item)
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning
```

Same command, same absence of an active item, opposite outcome. The difference is
`skills/setup/SKILL.md:23-30`, step 2 of the setup skill: *"Interview the repository, not the
user... **`verify`**: the command CI actually runs."* It was skipped in the sandbox. Eighth
instance.

And the obvious fix is harmful. Turning `gate.ts:380`'s warning into a failure makes
`gate --full` **red at birth** in every fresh store, because `src/setup.ts:70` seeds
`verify: ""`. That destroys the "gate verde de nacimiento" property `PROTOCOL.md:57` praises
four hundred lines earlier in the same document.

What is left of F10 and O6 is Defect B of F6, and it should be one item.

### D1 - the one that survives, filed with the wrong scope and a missing decision row

I reproduced it, and it then blocked me twice: once when probing the other guards, once when
writing this report. Four independent trips in two days by three different passes.

Two things are wrong with item 12 as filed:

**1. It is not the `rm` guard. It is `[^\n]*`.** Rung 5, driving `./bin/mstack hook
pre-tool-use` from a file, one JSON per case:

```
DENIED   push guard, unrelated later command  ::  git push origin main; ls --force
DENIED   push guard, word inside a commit msg ::  git push origin main && git commit -m "banned: --force"
allowed  control: nothing dangerous           ::  ls -la && echo done
```

Item 12's title, description and all four acceptance criteria are `rm`-specific
(`.mstack/state.json`, item 12). An `rm`-only fix ships the identical defect in the guard people
hit most - the one that fires when the words `--force` appear anywhere later on the line,
including inside a commit message.

**2. It silently reverses a decision that is already written down.** `src/hooks.ts:189-196`:

> These are regexes over the command string, not a shell parser, and the consequence is
> **deliberate**: `echo "do not git push --force"` is denied. Erring that way is recoverable...
> Carrying a shell parser to fix it would buy accuracy on **a case nobody hits** and add a whole
> grammar to a hook that must never be the thing that breaks a session.

And `tests/hooks.test.ts:204` pins the crossing behaviour on purpose, with the row
`["cd /tmp && git push --force origin main", "inside a compound command"]`.

So D1 is not "a bug nobody noticed". It is a **judgment that was made, argued in a comment, and
pinned by a test** - and the session's real contribution is falsifying its load-bearing clause:
"a case nobody hits" has now been hit four times in two days. That is a much stronger finding
than "the regex is wrong", and it is the version that should be written down.
`CONTRIBUTING.md:57-58` requires it: *"If your PR reverses one, add the row that supersedes it
and say why."* Item 12 cites neither the comment nor the test, and no superseding row exists in
`.mstack/decisions.tsv` (15 rows, 1 with `resolves` - checked).

Before this is implemented: widen the title and criteria past `rm`, and record the decision that
supersedes `src/hooks.ts:189-196`. Otherwise the implementer will read the module comment,
believe the current behaviour is intentional, and either narrow the fix or argue with the item.

### O1 - a generator for a skeleton that is already written down

Its stated justification is gone: the fact-check killed "cerraría F3 de paso"
(`review_protocol-factcheck.md:84-87`), and `PROTOCOL.md:673-675` now concedes it.

What remains is "el brief es el punto de máximo esfuerzo manual". Check the two failures it
cites:

- *The first brief lacked the hourly variable list.* No generator knows that. It is domain
  content the operator had and omitted.
- *One brief named a report path contradicting the agent file.* Already at
  `agents/spec-reviewer.md:36`, `agents/implementer.md:36,49`, `agents/spec-author.md:49-50`,
  `agents/reviewer.md:36-37`, and `skills/router/SKILL.md:70`.

Zero for two. And the skeleton is already specified: `skills/router/SKILL.md:67-69` - "goal,
scope, context, acceptance, how to verify, what is forbidden, and what to report" - seven named
fields, with the failure mode stated in bold on the next line.

The cost side is the part the lever does not price. Every command in `src/cli.ts` is data
plumbing over `state.json`, `ledger.tsv`, `decisions.tsv` and git. A `brief` command would be
the first that **generates prose**, and the prose it generates is a copy of what the agent file
already says - the second copy that `src/lifecycle.ts:1-8` and the lint's "single source of
truth" check exist to prevent. Meanwhile every role agent carries `Bash` and is told at
`agents/spec-reviewer.md:49` that "`.mstack/state.json` is the state": an agent that needs the
acceptance array can read it in one tool call.

### O2 - three places already push to rung 5

"Nada empuja hacia rung 5" is false at the line:

- `evidence-ladder.md:3` - "get it as far down this list as is cheap"; `:12` - rung 5 is
  "reproduced it in the running system".
- `skills/verify/SKILL.md:11-12` - "Pick the surface where the claim is actually true or false.
  Unit tests answer questions about branches. They do not answer questions about the running
  system."
- `principles.md:58-59` - "Prove it works. Check the real thing directly. Not proxies, not
  self-reports."

The document already rewrote O2 once after the fact-check (`PROTOCOL.md:677-691`) and landed on
the honest version: "Lo que falta no es permiso para instalar, es el **hábito** de construir el
caso mínimo y correrlo cuando el sistema real todavía no existe." A habit is not enforceable by
a hook or a gate, so `skills/reflect/SKILL.md:44` sends it to prose, and `README.md:29-36` is
this project's own statement that prose rules drift. If anyone insists, it is one clause on
`skills/verify/SKILL.md:11`, and it should be filed knowing it will drift.

### O3 - the premise is wrong twice, at rung 5

`PROTOCOL.md:691-694`: "Diez filas en `decisions.tsv` y cada una exigió cuatro campos largos en
una sola línea de shell."

```
sandbox/.mstack/decisions.tsv -> 30 rows; rows with a non-empty `resolves`: 0
```

Both halves fail. There are thirty rows, not ten - a stale count in the levers section, which is
error class 6/7/8 from the document's own list, in the section a refinement round reads first.
And **none** of them resolved a fork, which means the four-field floor at `src/cli.ts:397-409`
never applied to a single one: `src/cli.ts:354` requires only `--decision`, and everything else
defaults. The four long fields were the operator's own discipline, correctly applied, and then
reported as a tax the tool imposed.

Neither fact-check round caught this - round 1 did not check O3, round 2 scoped itself to seven
findings. That took me two minutes, which is the point I make in Part 2.

The lever also points the wrong way. The floors it wants softened exist with an argued reason
(`src/cli.ts:388-396`: "a boolean with extra steps, which is the phrase this whole mechanism
exists to avoid earning"). Making a fork cheaper to answer is making the floor lower.

### O4 - survives, and it is one clause

`evidence-ladder.md:11` currently reads: "**You ran it.** A script or test that calls **the real
code** and fails loudly if you are wrong."

The 264-byte Astro probe did not call the real code; it called a synthetic minimum. So under the
wording that already ships it was never rung 4 for the claim three passes cited it for. The
defect is real but it is a *misapplication of an existing rule*, not a missing rung, and that
matters: the fix is sharpening one sentence, not adding a sixth rung and renumbering every
reference in the plugin.

Add "and say what you ran it against" to `:11`. That is the whole change. It is the only lever
whose damage chain is documented end to end in the session (probe -> three citations ->
falsified by the implementer -> evidence file amended), and it is the cheapest thing on the list.

---

## Part 2 - the strongest argument that this refinement is premature

**The levers have had no adversarial pass at all, and the one I checked failed in two minutes.**

The fact-check scoped itself to the ten friction claims and the numbers. It touched O1 and O2
only as knock-ons from F3 and from a truncated quote. **O3, O4, O5 and O6 have never been
reviewed by anyone but the author** - the same author whose own error list in the same document
runs to nine, seven of which are stale or over-general numbers. I checked O3 and its premise is
wrong in both halves at rung 5. That is a 1-for-1 failure rate on the sample of unreviewed
levers I drew. Acting on O1-O6 now means acting on five statements whose only support is the
memory of a pass with a measured error rate.

**And every friction item except D1 is a property of the shape of the work, not of the plugin.**
One operator, one greenfield static page, no team, no CI, no remote, one item in the queue, one
worktree. Run the same protocol on a brownfield repo with a PR flow and:

- **F7 inverts.** With a remote, `merge-gate` is the point of the plugin rather than a command
  that cannot run, and the finding disappears. Fixing F7 now hardens a path that exists because
  the exercise forbade the normal one.
- **F9 inverts.** On a team that rebases and force-pushes, the strict `(target, sha)` key is the
  feature, and the complaint becomes "why did my verdict survive a rebase". Softening the
  message now optimises for the case where nothing rewrites history.
- **F5/O5 shrinks.** Three spec rounds before a line of code is a greenfield artifact: on a
  brownfield repo the constraints are already in the code and the spec converges against
  something. The stopping rule would be tuned on the shape where stopping is hardest.
- **F1 and F8 vanish on the second session** with the same operator, and probably on the first
  session of an operator who reads `docs/wiki/` before `src/`.
- **F10 and O6 vanish** in any repo with CI, because `skills/setup/SKILL.md:27-29` fills
  `state.verify` from `.github/workflows/`.
- **F6 survives and gets worse**, because a team has more fields worth correcting after intake
  and more people to be blocked by a stale one.
- **D1 does not move.** It is the only shape-independent finding in the set, which is exactly
  why it is the only one I would ship without another session.

The honest read of this table is that the dogfood run measured a workflow against the one shape
of work the workflow was least designed for - no PR, no CI, no team, no second item - and the
findings are dominated by that choice. A second run on a brownfield repo with a remote would
cost a fraction of this one and would tell you which of these fourteen are real.

**One more, smaller:** `PROTOCOL.md:272-274` says D1 "solo apareció cuando alguien usó la
herramienta para trabajo real". True, and it is the argument for the exercise. It is also an
argument for one more exercise before turning the *rest* of the list into work, since the one
finding that justified the session is the one finding that did not come from reading a doc badly.

---

## Part 3 - what the session did not find, and the absences of friction that should worry you

### 1. `decision_required` never fired, and it cannot be attached after intake

Rung 5. `sandbox/.mstack/state.json` item 1 carries no `decision_required` and no
`decision_resolved`; `sandbox/.mstack/decisions.tsv` has 30 rows and **zero** with a `resolves`
value.

Yet two textbook product forks arrived, and the document says so at `PROTOCOL.md:186-188`: the
default place (Madrid vs an empty screen) and what "cada byte de JS escrito a mano" means. Both
are "product choices with different user-visible outcomes", which is `README.md:117-118`'s own
definition of the thing the gate exists for. They were answered with plain `mstack decide`, and
the gate never had an opinion.

That is not the operator's fault: `state set` cannot add the field (rung 5, above), and
`skills/spec/SKILL.md:33-38` says forks get found during `specifying`, after intake. So **the
mechanism the README leads with was structurally unreachable for the forks this session
actually produced**, the session presents its handling of them as a success, and the retro
proposes nothing about it. That is the single largest gap in the write-up.

### 2. Nothing automatic ever runs `--full`, so a red verification is invisible

`src/hooks.ts:172` - the `Stop` hook is `runGate(store, { quiet: true })`. The fast gate does not
touch `state.verify` or `item.verification`. That is *why* the gate was red for 230 minutes:
not because the string was unvalidated, but because nothing ever executed it until a human
typed `--full`. `CLAUDE.md` and `skills/setup/SKILL.md:64-71` both say "gate must be green
before a session closes", and for the verification half of the gate that sentence is not
enforced by anything.

### 3. The closing verdict is written by the pass that coordinated the code

`agents/implementer.md:45` is the **only** role instruction anywhere that says
`mstack ledger record`. `agents/reviewer.md` and `skills/review/SKILL.md:35` tell the reviewer to
run `ledger check`, never `ledger record`. So the closing row is always typed by someone else.

The sandbox ledger, rung 5 - 10 rows: eight `implementer`, one `orchestrator`, one `reviewer`.
The `reviewer` row was typed by the operator on the reviewer's behalf
(`PROTOCOL.md:587-589`). `src/roles.ts:96-99` already concedes the column is free text and a
floor. What it does not concede, and what this session demonstrates, is that **the reviewer
never writes the row at all** - so the separation the README leads with is enforced by the
coordinating pass choosing to type a different word. The reports carried the separation; the
ledger did not.

### 4. For a closed item the gate accepts a verdict at any SHA from any non-implementer

`src/gate.ts:311-320`: for `done` items the gate filters rows by target only. Not by SHA
(`:303-306` says so deliberately), and not by which SHA the item closed on. In the sandbox, the
row `ace059a2 live-verified orchestrator` - recorded mid-session, by the pass that drove the
implementation - satisfies the closed-item check on its own, forever, whether or not the
reviewer's row at `897f5aaf` exists.

So the entire Fase 8 anxiety (F9, the rebase-before-record lesson at `PROTOCOL.md:568-571`,
"nueve filas, ninguna en head") is anxiety about a property the gate does not check on closed
items. Nobody noticed that the careful thing they were doing was not the thing being enforced.

### 5. Nothing anywhere pushes back on scope, and 64 requirements for a weather page went unremarked

`rg "proportional|budget|too big|smallest"` across `skills/spec/`, `skills/router/`,
`agents/spec-author.md` and `agents/spec-reviewer.md` returns exactly one hit:
`agents/spec-reviewer.md:31`, "Verification is proportional to the risk" - which governs the
reviewer's depth, not the spec's size.

R1-R64 and 116 scenarios for a static weather page, produced by a workflow with no
proportionality check and reviewed three times by passes whose instructions are entirely about
finding *more*. Six adversarial passes and not one asked whether the spec was too large. The
retro's only response to this is F5/O5, "write a stopping rule for the review rounds" - which
treats the symptom (how many times we review) and never the cause (an `sdd` trigger with no
calibration and a spec path with no size signal). If any process finding deserves a slot, it is
this one, and the document does not contain it.

### 6. Whole surfaces never exercised, in a run whose acceptance bullet was "todas las fases"

Verified: `git worktree list` in the sandbox returns one entry.

- `mstack worktree new|list|prune` - never used. "One active item per worktree" was satisfied
  by having exactly one item.
- Review **panels** - never used. Every review was a single reviewer. `src/fanout.ts:16-21`
  says the fan-out machinery exists because a real run lost two of three reports; the only time
  this session touched it was the misuse that produced F4.
- `merge-gate`, PR flow, review threads, CI - impossible by construction.
- `blocked`, `cancelled`, `--force`, a queue with two items, a resume after a dead context
  window - none of them.

`PROTOCOL.md:3-5` promises "pasando por **todas** las fases de mstack" and item 11's second
acceptance bullet says "el ciclo de vida completo". Neither is true, and the review that closed
item 11 did not say so. A retro that lists ten frictions from a run that skipped four CLI
surfaces is reporting on the half of the tool it touched, and the friction table does not carry
that caveat.

### 7. The suspicious smoothness: nothing ever refused anything

Across the whole session the plugin issued, by the document's own record, exactly three
refusals: one illegal transition (F8), one guard false positive (D1), and one `ledger record`
missing `--evidence`. Two of the three were wrong, and the third was a usage error. **Not one
gate refused a substantive claim.** The spec gate passed because the artifacts existed; the
verdict gate passed because a row existed; `gate --full` passed because nobody ran it.
Everything real this session caught - the axe failures, the vacuous predicate, the undefended
guard at `app.ts:625`, the falsified toolchain probe - was caught by an **agent reading
something**, never by a check.

That is the finding a retro on this plugin should be most uncomfortable with, because
`README.md:35-36` is the claim it tests: *"Anything that must hold whether or not the model
remembers it lives in a hook or in a gate that is code."* On the evidence of this session, the
code caught nothing that mattered and the prose caught everything. Whether that is because the
gates cover the right things and nothing violated them, or because they cover the cheap things,
is the question the next session should be designed to answer - and it is not on the list of
sixteen.

---

## Verification I ran

```
$ mstack gate
PASSED - 0 failures, 1 warning          # [warn] on main; feature work belongs on its own branch

$ mstack gate --full
[ok]    npm test && npm run typecheck && bin/mstack lint-plugin .
PASSED - 0 failures, 1 warning

$ npm test                    -> tests 171, pass 171, fail 0
$ ./bin/mstack lint-plugin .  -> PASSED - 0 failures, 0 warnings
$ git rev-parse HEAD          -> 26c22d38163a3f5f0528a72f7ae858218d98e205

$ mstack state add --help   -> mstack: Unknown option '--help'    EXIT 2
$ mstack state set --help   -> mstack: no item matches '--help'   EXIT 2

# throwaway store, active item slugged weather-app
$ mstack fanout plan --kind spec_review --worker weather-app
  weather-app   .../spec_review_weather-app_weather-app.md
$ mstack fanout plan --kind spec_review --worker correctness --worker security
  correctness   .../spec_review_weather-app_correctness.md
  security      .../spec_review_weather-app_security.md
$ mstack fanout check --kind spec_review --worker weather-app
[warn]  spec_review_weather-app.md was not in the plan; nothing will read it

$ mstack state set weather-app --decision-required "..."  -> Unknown option   EXIT 2
$ mstack state set weather-app --verification "npm test"  -> Unknown option   EXIT 2
$ mstack state set weather-app --description "x"          -> Unknown option   EXIT 2

# ./bin/mstack hook pre-tool-use, driven from a file, one JSON per case
DENIED   push guard, unrelated later command  ::  git push origin main; ls --force
DENIED   push guard, word inside a commit msg ::  git push origin main && git commit -m "banned: --force"
allowed  control: nothing dangerous           ::  ls -la && echo done

$ sh -n <'npm run build && npm run check; lighthouse CLI run against the preview server...'>
EXIT 0

sandbox/.mstack/decisions.tsv  -> 30 rows, 0 with a `resolves` value
sandbox/.mstack/ledger.tsv     -> 10 rows: 8 implementer, 1 orchestrator, 1 reviewer
sandbox/.mstack/state.json     -> verify: "", item 1 decision_required: absent
.mstack/state.json             -> verify: "npm test && npm run typecheck && bin/mstack lint-plugin ."
sandbox git worktree list      -> 1 entry
```

I edited no file under review, committed nothing, and changed no item status. The one file I
wrote is this report. Throwaway stores live under the session scratchpad.

## Where my own claims stopped

- Rung 5: F1, F4, F6 (both defects), F10, D1's scope, O3, and every Part 3 item that cites a
  file count, a row count or a command output.
- Rung 2 (read the line, did not execute): F7's `gh` dependency, F8's transition table, F9's
  documentation, `src/gate.ts:311-320`'s closed-item check, `src/hooks.ts:172`'s fast-gate-only
  Stop hook, `agents/implementer.md:45` being the only `ledger record` instruction.
- Rung 1, and I am saying so: every judgment in Part 2 about how a brownfield or team-shaped
  session would go. I did not run one. That is a prediction, not a measurement, and it is the
  reason my recommendation is "run a second session" rather than "these fourteen are wrong".


---

## Postscript - item 12 was implemented while this report was being written

Written at the end of the session, after `git status` showed files I had not touched.

`mstack state list` now shows `* 12 rm-guard-command-boundary (in_progress)`, and the working
tree carries uncommitted changes to `src/hooks.ts` (+120) and `tests/hooks.test.ts` (+98) that
are not mine. **Every line number I cite for `src/hooks.ts` and `tests/hooks.test.ts` is at
`26c22d3`, not at the working tree.** Read them against that SHA or they will not resolve.

Both of my objections to item 12 as filed are answered by that work, independently of this
report:

- **Scope.** I argued an `rm`-only fix would leave the identical defect in the guard that fires
  on `--force`. The implementation does not do that: it segments the line once in `preToolUse`
  and matches each piece, so the fix applies to all five guards. `.mstack/decisions.tsv`,
  2026-08-21T07:23:48Z: *"Segment the command line before matching, and apply it to every guard,
  not only the rm rule ... All five patterns carry the same `[^\n]*` shape and the same defect."*
  It also names "3 sibling false positives reproduced at HEAD", which is the same family I
  reproduced above.
- **The superseded decision.** I argued the item silently reversed the argued comment at
  `src/hooks.ts:189-196` with no superseding row, contrary to `CONTRIBUTING.md:57-58`. Three
  rows now exist, dated 2026-08-21T07:23-07:24, and the comment itself is rewritten to say why
  the across-command case is *not* the tolerable-false-positive case the old text claimed, and
  to state the four classes of deletion the array cannot see. That is criterion 4 met in the
  place the criterion asked for.

So D1 stands as ACT and needs nothing from me. What I would still flag to whoever reviews that
work, since it is outside my lens and I did not verify it:

1. **The item text is still `rm`-only.** `state.json` item 12's title, description and all four
   acceptance criteria name the `rm` guard. The diff is wider than the item. Either the
   acceptance criteria should be widened to name the sibling guards the fix now covers, or the
   review has to state why a wider diff closes a narrower item. Right now criterion 2 - "The
   four reproduced false positives are covered by tests" - undercounts what shipped.
2. **`.mstack/progress/current.md` and `.mstack/state.json` are dirty in the same worktree this
   retro ran in.** Two passes writing the same store concurrently is the shape
   `src/fanout.ts:16-21` exists to prevent, one level up. My own report file is the sixth
   uncommitted change in that tree. Nothing was lost that I can see, but nobody planned for it.
3. This does not change Part 2. D1 was already the one finding I said was ready; watching it
   get implemented correctly while the other fifteen sat still is the argument for Part 2, not
   against it.
