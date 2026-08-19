# Code archaeology — git and `gh`

The most trustworthy source, because it is tied to the code itself, and the only one every repo
has. Start here, always. If it answers the question, you may not need any other source.

## What it holds

Commit messages and diffs. PR bodies, review threads, linked issues. Inline `TODO`/`FIXME`/`HACK`
notes. ADRs, if the repo keeps them. Test names and assertions, which often encode the exact edge
case that motivated a change. Co-changed files, which reveal coupling nothing documents.

## How to search it

```bash
git log --follow --oneline -- <file>      # survives renames; plain git log does not
# -S counts occurrences: it fires when the string appeared or vanished, and
# stays silent on an edit in place. Changing a timeout from 30 to 5 inside an
# existing call is exactly the archaeology case, and exactly what -S drops.
git log -S '<exact string from the code>' -- <file>
# -G fires when any line containing the pattern changed, edits included.
git log -G '<regex>' -- <file>
# -w ignores whitespace-only changes and --ignore-rev skips a known reformat,
# both of which restore the author who actually decided the line. A repo with a
# .git-blame-ignore-revs file has already listed its reformats for you.
git blame -w -L <start>,<end> -- <file>
git blame --ignore-revs-file .git-blame-ignore-revs -L <start>,<end> -- <file>
git log <old>..<new> -p -- <file>
```

Then pull the PR behind each substantive commit. The review thread is where the signal is,
not the description:

```bash
gh pr view <n> --json title,body,author,mergedAt,closingIssuesReferences,comments,reviews,commits
```

And look for the out-of-band notes:

```bash
# The trailing path is not optional. Without it ripgrep takes its stdin form and
# blocks forever when stdin is not a terminal, which is how every subagent runs
# a command. Verified: no path and an open pipe on stdin hangs; `.` exits 0.
rg -l -i 'architecture.decision|adr' --glob '*.md' .
rg -n -C2 '(TODO|FIXME|HACK|XXX)' <file>
```

## What it systematically lies about

- **`git blame` names the last person to touch a line, not the person who decided it.** A
  reformat, a lint autofix, or a bulk rename rewrites authorship for the whole file. `-w`,
  `--ignore-rev` and `--ignore-revs-file` undo most of that outright; reach for them before
  reading the blamed commit by hand.
- **A squashed merge collapses the discussion into one message on the trunk, and only there.**
  The branch commits are still on the PR — `gh pr view <n> --json commits`, or
  `git fetch origin refs/pull/<n>/head` for the diffs — and they survive the head branch being
  deleted. The step-by-step reasoning this page is looking for is usually in them, so the trunk
  looking bare is the beginning of the search rather than the end of it.
- **Commit messages describe the intended change, not the achieved one.** "Fix the race" means
  someone believed they fixed a race.
- **A revert says the change was backed out. It does not say why.** That reason is almost never
  in the revert commit; it is in the incident or the thread that prompted it.
- **Absence of a comment is not absence of a reason.** Most decisions are never written down at
  all, which is exactly why the other sources exist.

## What to return

Per finding: the commit or PR link, the date, the author, and the **verbatim** sentence that
carries the reasoning. Then what it explains about the target, in one line.

## Rung it can reach

**2.** You can point at the line where someone said it. Rung 2 about *intent* is the ceiling for
every source in this directory — you cannot execute a reason. Any claim about present-day
behaviour has to leave this file and go to the code.
