---
name: setup
description: Initialize mstack in a repository, creating the durable state directory and seeding the work queue from what the repo already tells you. Use once per repository, when mstack reports no .mstack directory, or when asked to set up or install mstack here.
argument-hint: [optional project name]
---

# Setup

## 1. Create the store

```
mstack setup
```

That writes `.mstack/` with `state.json`, `progress/current.md`, `progress/history.md`,
`ledger.tsv`, `decisions.tsv` and an empty `specs/`. It never overwrites an existing file
unless you pass `--force`.

Commit it. The store is the durable state and it belongs in version control: `progress/` is
reviewable, `decisions.tsv` renders as a table on GitHub, and a worktree needs its own copy for
the one-active-item rule to mean anything.

## 2. Interview the repository, not the user

Fill `state.json` from what the repo already knows. Do not ask questions the code answers.

- **`verify`**: the command CI actually runs. Look at `.github/workflows/`, the `Makefile`, the
  `scripts` block of `package.json`. If several exist, pick the one that mirrors CI most
  closely, because that is the one whose green means something.
- **`project`**: the repository name.

## 3. Seed the queue honestly

```
mstack state add --slug <kebab> --title "<what it is>" \
  --acceptance "<criterion>" --acceptance "<criterion>" \
  [--sdd] [--source "issue #12"] [--verification "<command>"]
```

Two rules the gate enforces, so get them right now:

- **Acceptance criteria are quoted from the source, not paraphrased.** A paraphrase is where
  scope quietly changes, and nobody notices until the review.
- **The slug is kebab-case**, because it names the spec directory, the branch and the progress
  files.

Mark `--sdd` only where the spec path earns its cost: the change crosses subsystems, or the
person asking will step away and trust the result later.

## 4. Tell the repository about it

Add a short section to the project's `CLAUDE.md`, or create one:

```markdown
## Workflow

This repository uses mstack. Start work with `/mstack`. Durable state is in `.mstack/`;
`mstack gate` must be green before a session closes.
```

A plugin-root `CLAUDE.md` is not loaded as context, but the *project's* is. That line is what
makes a fresh session find the workflow without being told.

## 5. Prove it works

```
mstack gate
```

Green, with at most the two expected warnings about being on the default branch and having
uncommitted changes. If it is red, it is telling you something real about the seed data.
