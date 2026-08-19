# Publishing the wiki

The files in `docs/wiki/` are the wiki. They live in the repository so they can be reviewed
like code, exist before the GitHub repository does, and carry links that resolve in-repo. A
GitHub wiki is itself a git repository, one the docs let you clone once its first page has
been created on github.com, so publishing is a short mechanical copy, not an export.

GitHub-side mechanics below were checked against GitHub's official documentation on
2026-08-19: [Adding or editing wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages),
[About wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis/about-wikis),
[Creating a footer or sidebar](https://docs.github.com/en/communities/documenting-your-project-with-wikis/creating-a-footer-or-sidebar-for-your-wiki),
and [Disabling wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis/disabling-wikis).
Claims those pages do not state are marked as unverified where they appear.

## 1. Make sure wikis are enabled

Wikis come with every repository ("Every repository on GitHub comes equipped with a section
for hosting documentation, called a wiki"). If the **Wiki** tab is missing, enable it: the
repository's **Settings**, then the **Features** section, then the **Wikis** checkbox. A
public repository's wiki is public.

## 2. Create the first page in the web UI

The docs make the first page a precondition for cloning: "Once you've created an initial page
on GitHub, you can clone the repository to your computer with the provided URL." That the
wiki's git repository does not exist at all before that first save is observed behaviour,
unverified against the docs, which speak only of when you can clone.

On the repository: **Wiki**, then **New Page** in the upper-right corner. Content does not
matter — the copy in step 4 will overwrite it — so save a one-line `Home`.

## 3. Clone the wiki repository

The wiki clones from the repository URL with `.wiki` appended, exactly as the docs give it:

```bash
git clone https://github.com/<owner>/<repo>.wiki.git
cd <repo>.wiki
```

As everywhere in these docs, `<owner>/<repo>` is a placeholder for the real owner and
repository name, unknown until publication.

## 4. Copy the pages in

From the wiki clone, with the main repository checked out next to it:

```bash
cp ../<repo>/docs/wiki/*.md .
```

That includes `_Sidebar.md` and `_Footer.md`. They are special files, rendered as the footer
and sidebar rather than as ordinary pages: per the docs, "If you create a file named
`_Footer.<extension>` or `_Sidebar.<extension>`, we'll use them to populate the footer and
sidebar of your wiki, respectively."

## 5. Rewrite the links

In the repository, pages link to each other as `](Page.md)` so the links resolve for a reader
browsing `docs/wiki/` as files. On the published wiki, pages are addressed without the
extension — observed behaviour, and the wiki links here rely on it, but it is not stated on
the docs pages checked — so strip `.md` from the intra-wiki links. With
[`sd`](https://github.com/chmln/sd), run in the wiki clone:

```bash
sd '\]\(([A-Za-z-][A-Za-z_-]*)\.md\)' ']($1)' \
  Home.md Getting-Started.md The-Story.md How-A-Work-Item-Flows.md Gates-and-Hooks.md \
  The-CLI.md State-Files.md Status-Line.md _Sidebar.md _Footer.md
```

Two deliberate scopings. The character class matches bare page names like
`Getting-Started.md` and cannot match a path containing `/` or `.`, so a repo-relative link
like `../research/pstack-port.md` is left alone. And the file list is every page except
`Publishing-the-Wiki.md`: this page's own prose mentions the `](Page.md)` shape (the first
sentence of this section), a `*.md` sweep rewrites that sentence into saying its opposite,
and this page carries no intra-wiki links of its own to lose by being excluded. If it ever
gains one, rewrite it by hand in the wiki clone.

The one repo-relative link these pages do carry (`../research/pstack-port.md`, in
`The-Story.md` and `Gates-and-Hooks.md`) points outside the wiki, so rewrite it to the
repository's URL:

```bash
sd -F '](../research/pstack-port.md)' '](https://github.com/<owner>/<repo>/blob/main/docs/research/pstack-port.md)' The-Story.md Gates-and-Hooks.md
```

Named files again for the same reason: this page quotes that command in a code block, and a
fixed-string replace over every file would rewrite its own example. Both commands were run
against a fresh copy of these files and the result diffed against the originals: with these
scopings the diff touches link targets and nothing else, this page included.

## 6. Commit and push

```bash
git add -A
git commit -m "docs: publish the wiki from docs/wiki"
git push
```

Per the docs, "only changes pushed to the default branch will be made live and available to
your readers." The wiki repository's default branch is whatever the clone shows; push to that.

## Page names and titles

"The filename determines the title of your wiki page", per the docs, which is why these files
are named `How-A-Work-Item-Flows.md` rather than `flows.md`. The docs also advise against
these characters in titles, because users on some operating systems cannot work with
filenames containing them: `\ / : * ? " < > |`.

A further detail the checked pages do **not** state: that a dash in a filename is displayed
as a space in the rendered title (`How-A-Work-Item-Flows` shown as "How A Work Item Flows").
That is observed GitHub behaviour, widely relied on, but unverified against official
documentation; the filenames here are chosen so the pages read fine under either rendering.

## Republishing

The wiki is a plain git repository, so republishing after the pages change in `docs/wiki/` is
the same copy, rewrite, commit, push. Nothing in the wiki clone is hand-edited; `docs/wiki/`
in the main repository stays the single source, and a wiki-side edit someone makes through the
web UI should be ported back into `docs/wiki/` or it will be overwritten by the next publish.
