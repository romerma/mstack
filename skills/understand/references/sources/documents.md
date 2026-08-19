# Long-form documents — Notion, Confluence, Google Docs

Where the considered version of a decision lives, when there is one. Design docs, RFCs,
postmortems, onboarding pages. Higher signal per page than chat, and far more likely to be stale.

## How to search it

Search the feature name, the subsystem name, and the names of the people in `git blame`. Look for
doc types by title: RFC, design, proposal, postmortem, runbook, "one-pager".

Read the **comment threads and version history**. A design doc's comments are where the
alternatives were argued; the body is where the winner was written up.

One tool-specific trap, and it defeats the point of this page if you do not know it: Notion's
comments endpoint returns **un-resolved comments only**. Every settled thread — which is exactly
where an argument concluded — is invisible to an MCP client and visible only in the browser. If
Notion is the source, say that you could not see the resolved threads, or open the page yourself.

Check the last-edited date against the code's last-changed date before believing anything.

## What systematically lies here

- **Documents describe the plan, and the plan changed.** The single most reliable failure of this
  source. A design doc is evidence of what was intended at the time it was written, and nothing
  more.
- **Nobody marks a document obsolete.** There is no signal distinguishing "still true" from
  "abandoned two years ago" except the date and your own reading of the code.
- **The rendered page hides the argument; the history does not.** The tradeoffs were in the
  comments and the earlier revisions, and the clean final page shows neither. Both are still
  there: Confluence retains every version with compare and restore, and Notion keeps page history
  bounded by the workspace plan. Open the version nearest the commit you are investigating.
- **Templates manufacture confidence.** A filled-in "Risks" section is not evidence anyone
  assessed the risks.

## What to return

Title, link, last-edited date, author, and the **verbatim** passage. Then, explicitly: does the
code match what this document describes? If it does not, that gap is the finding.

## Rung it can reach

**2** for what was intended. **1** for anything about the current system, because a document
cannot be run and this one is probably out of date.
