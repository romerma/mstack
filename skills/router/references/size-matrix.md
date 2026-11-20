# Size matrix

An item's size is `s`, `m` or `l`: `--size` on `mstack state add` and `mstack state set`, and an
item with no size reads as `m`. Intake picks it: `l` when its paragraph below fits, else `s` when
its paragraph fits, else `m`. When the work turns out bigger than intake expected, raise it with
`mstack state set <slug> --size`; never lower it to skip a step. The skills and playbooks that
change with the size link this file and say only their own step; this is the one copy of the table.

| Step | s | m | l |
|---|---|---|---|
| Understand (`/mstack:understand`) | skip: read the code it changes | skip: read the code it changes | over the subsystems it touches |
| Design (`/mstack:design`) | skip | in the session: criteria, the pick, a rejected alternative | design it twice: candidates fanned out, a judge on another model |
| Spec path | never: `sdd` and `s` are refused together | when a trigger fires; at most 12 requirements | when a trigger fires; at most 30 requirements |
| Test first, delegated to `mstack:implementer` | yes | yes | yes |
| Code diff | at most 60 changed lines in 3 code files | no limit | no limit |
| `mstack verify --mutation` | skip | after the last commit | after the last commit |
| `/mstack:verify` | yes | yes | yes |
| Review by a pass that did not write it | one lone reviewer | a lone reviewer, or a panel | a panel: two or more lens reports in one round |

**s** is a request on the direct path (no `sdd`, no fork) whose code change you expect to fit in
60 changed lines in at most 3 code files; tests, docs and the store do not count. The gate fails
an active `s` item whose code diff passes either limit: the fix is `mstack state set <slug> --size
m`, not code squeezed to fit. It skips understand, design and the panel: the implementer's
decision rows are the design record, and one reviewer (`mstack fanout plan --kind review --solo`)
judges the diff.

**m** is everything that is neither `l` nor `s`. The session reads the code the change touches and
writes the design itself: the criteria first, then the shape it picked and at least one alternative
it rejected, in a decision row or the spec's `design.md`. It adds `mstack verify --mutation` once
the implementer's last commit is in: the command reverts the item's code in the working tree and
runs the verification on it, and a `mutation-survived` or `mutation-blocked` result is a finding
the review answers.

**l** is a change that crosses several subsystems, or whose acceptance or spec would carry more than
the 12 requirements a size `m` spec may declare. It adds `/mstack:understand` over the subsystems it
touches, the design skill's whole procedure (two structurally distinct candidates from generators
that cannot see each other, and a judge on a different model), and a review panel: `mstack fanout
plan --kind review` with two or more `--worker` lenses in one round. The gate fails an `l` item at
`verifying`, and `state set --status done` refuses it, `--force` included, while no review round
has two or more lens reports; a later round may be a lone review.

At every size, implementation is delegated to `mstack:implementer`, and a pass that did not write
the code reviews it.
