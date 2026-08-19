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
git log -S '<exact string from the code>' -- <file>   # commits that added or removed it
git log -G '<regex>' -- <file>
git blame -L <start>,<end> -- <file>
git log <old>..<new> -p -- <file>
```

Then pull the PR behind each substantive commit. The review thread is where the signal is,
not the description:

```bash
gh pr view <n> --json title,body,author,mergedAt,closingIssuesReferences,comments,reviews
```

And look for the out-of-band notes:

```bash
rg -l -i 'architecture.decision|adr' --glob '*.md'
rg -n -C2 '(TODO|FIXME|HACK|XXX)' <file>
```

## What it systematically lies about

- **`git blame` names the last person to touch a line, not the person who decided it.** A
  reformat, a lint autofix, or a bulk rename rewrites authorship for the whole file. Check
  whether the blamed commit actually changed behaviour before attributing intent to it.
- **A squashed merge collapses the entire discussion into one message.** The reasoning lived in
  the branch commits, which no longer exist. The PR thread is the only surviving copy.
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
