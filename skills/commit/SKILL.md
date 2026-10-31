---
name: commit
description: Write commit messages that hold to Conventional Commits 1.0.0, with the type the change actually earns and a description a stranger can read from the log alone. Use before every git commit, when amending or rewording one, when squashing, and when writing a PR title.
argument-hint: [what you are committing]
---

# Commit

The log is read by people who were not in the session. A subject that made sense with the diff
open in front of you is not the test. The test is whether it still says something six months
later in `git log --oneline`.

$ARGUMENTS

## The shape

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

The colon and the space after it are required. So is the description.

## Pick the type

Two are fixed by the spec and the rest are convention:

- `feat` when the commit adds a feature. This is the only thing that earns `feat`.
- `fix` when the commit repairs a bug. Not "touched a file under src/".
- `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `chore`, `revert` for everything
  else.

The type is a claim about the change, and a wrong one is a lie the release tooling believes:
`fix` cuts a PATCH release, `feat` cuts a MINOR one, and a breaking change cuts a MAJOR one.
Reaching for `chore` because the change is hard to classify is how a feature ships unreleased.

A scope is optional. Use one when the repository has real sections a reader would recognise
(`fix(parser):`), and leave it off rather than inventing one.

## Write the description

The spec says only that a description follows the colon and space, and that it is a short
summary of the change. Write it so a stranger can read it from the log:

1. **Imperative mood** is a common habit, not a rule: "add the receipt" rather than "adds" or
   "added". Follow it where the repository does.
2. **Name the change, not the file.** "fix the gate" says nothing that `--stat` does not.
3. **One commit, one change.** If the description needs an "and" joining two unrelated things,
   it is two commits.

Keep the subject short enough to read in `git log --oneline`. A repository's own rules, in its
`CLAUDE.md` or `CONTRIBUTING.md`, extend or override this skill, including any length limit,
casing or trailer policy; read them before you commit.

## Breaking changes

Mark them in the prefix with `!`, in a footer, or both:

```
feat(api)!: take the store root from the manifest

BREAKING CHANGE: MSTACK_ROOT is no longer read.
```

`BREAKING CHANGE` is uppercase, and it is the one part of the format that is case sensitive.
`BREAKING-CHANGE` is the same token. With `!` in the prefix the footer may be dropped, and the
description then has to carry the break on its own.

## Body and footers

The body starts one blank line after the description and says **why**, not what. The diff
already holds the what. A body earns its place when the change had a reason that is not
obvious: a rejected alternative, a constraint, a measurement.

Footers start one blank line after the body. Each is a token, then `: ` or ` #`, then a value.
Tokens use `-` instead of spaces, so `Reviewed-by`, `Refs: #33`, `Closes #12`.

## Before you commit

1. `git diff --staged`. Commit what is staged, not what you remember doing.
2. Check the type against what actually changed, not against what you set out to do.
3. Check the repository's `CLAUDE.md` or `CONTRIBUTING.md` for rules of its own.

## What the standard does not say

Do not claim otherwise when explaining a rejection. Conventional Commits 1.0.0 does not require
imperative mood, lower case, a subject length limit, or any particular type beyond `feat` and
`fix`. It is also silent on merge commits. A repository may enforce any of these as a house
rule, but a house rule is not the specification.
