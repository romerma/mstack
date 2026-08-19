# notes-cli

A deliberately small notes CLI in dependency-free Python. The point of this repository is not
what it does. It is that an agent can work in it verifiably, and that you can watch the whole
mstack cycle run end to end against real code.

## Run it as a human

```bash
python3 -m src.cli add "buy bread" --body "and milk"
python3 -m src.cli list
python3 -m unittest discover -s tests -t . -q
```

## Run it as the exercise it exists for

From the repository that contains this directory:

```bash
claude --plugin-dir . 
```

Then, with this directory as your working directory:

```
/mstack implement the next pending item
```

### What you should see

**Item 2, `cli-search`, takes the direct path.** No spec, because the acceptance array is
already the contract. The router copies the feature playbook's steps into the todo list,
delegates to `mstack:implementer`, then a reviewer that did not write the code judges it.

**Item 3, `export-json`, takes the spec path.** It carries `sdd: true` and a
`decision_required` field naming a real product fork: whether the export is a stable public
contract or a convenience dump. Those two answers produce different work, which is exactly the
case where a human should be asked. Watch the same router take the longer route on the same
command.

### Watching the state rather than the chat

Content does not travel through chat here. Open `.mstack/` in your editor while it works:

| File | Written by | Holds |
|---|---|---|
| `progress/current.md` | orchestrator | The live checkpoint, and the next step if the session dies |
| `progress/impl_<slug>.md` | implementer | Files touched, commands run, requirement-to-test map |
| `progress/review_<slug>.md` | reviewer | The verdict, walked criterion by criterion |
| `progress/history.md` | orchestrator | Append-only session log |
| `ledger.tsv` | whoever verified | `target, sha, verdict, evidence, verifier` |
| `decisions.tsv` | any pass | One row per decision, append-only |
| `state.json` | orchestrator | The lifecycle state the gate enforces |

## Break it on purpose

The enforcement plane is worth seeing fail. Each of these should be caught:

```bash
# The shape that silently disables every downstream check.
echo '{"items": {}}' > .mstack/state.json && mstack gate     # exit 1, names the shape

# Two active items in one worktree.
mstack state set 2 --status in_progress
mstack state set 3 --status specifying                        # gate now fails

# A verdict that no longer applies.
mstack ledger record cli-search "$(git rev-parse HEAD)" test-verified --evidence x --verifier me
mstack ledger check cli-search 0000000000000000000000000000000000000000   # stale, exit 1
```

`git checkout .mstack/` to put it back.
