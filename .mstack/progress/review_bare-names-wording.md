# Review - bare-names wording, for 0.2.1

**Verdict:** APPROVED, all three. Two optional refinements, one flagged-unverified note for
item 33.

Checked against `/Users/romerma/.local/share/claude/versions/2.1.241`, which `claude --version`
confirms is the active version, not against the description I was given. Working tree at
`40bf444` on `main` with `docs/wiki/Skills-and-Playbooks.md` uncommitted.

## The resolver, end to end

Round 3 established how a skill is *registered*. This round needed how a typed command is
*resolved*, because that is what decides whether three spellings actually answer. Four functions,
copied verbatim from the bundle:

```js
function PFt(e){                              // parse what the user typed
  let t=e.startsWith("/")?e.slice(1):e, r=t.search(/\s/);
  if(r===-1)return{name:t,args:""};
  return{name:t.slice(0,r),args:t.slice(r+1).trim()}}
function JUS(e,t){return e.name===t||Vf(e)===t||(e.aliases?.includes(t)??!1)}
function yb(e,t){let r;return t.find((o)=>{
  if(o.name===e)return!0;                     // exact `name` wins immediately
  if(r===void 0&&JUS(o,e))r=o;                // Vf or alias held as fallback
  return!1})??r}
function Vf(e){return e.userFacingName?.()??e.name}
```

There was a real chance this made the new sentence wrong. The bundle has a second matcher,
`al(e,t){return e.name===t||(e.aliases?.includes(t)??!1)}`, which does **not** consult
`userFacingName`. Had command dispatch used `al`, `/mstack:mstack` would resolve to nothing and
"three spellings" would be the fourth wrong sentence. It does not: `al`'s call sites are all
tool and permission lookups (`t.options.tools`, MCP tool lists), and `JUS` is used in exactly one
place, `yb`, which sits directly after the slash-command parser `PFt`. Two occurrences of `JUS(`
exist in the whole 310 MB binary: its definition and that call.

## 1. The wiki paragraph: attributions are correct

Ran the real chain against this repository's twelve skill directories and their real front
matter:

```
router:  name = mstack:router | userFacingName = mstack:mstack | aliases = ["mstack"]

/mstack:router                     -> skills/router/  via name (from directory)
/mstack:mstack                     -> skills/router/  via userFacingName (from declared name)
/mstack                            -> skills/router/  via alias (bare declared name)
/mstack why does the cache thrash  -> skills/router/  via alias   args="why does the cache thrash"
```

Both attributions you asked about are right, and right for the reason the sentence gives:

- **`/mstack:router` from its directory.** `opf` builds the id as
  `` `${t}:${d.name.replace(/[^a-zA-Z0-9_-]/g,"-")}` `` from the directory entry, and `RVn`
  stores it as `name`. The directory is the only input to that spelling.
- **`/mstack:mstack` from its declared name.** `A = C ? `${k}${C}` : e` becomes
  `userFacingName()`, where `C` is the front-matter name. `Vf` returns it and `JUS` tests it.

One precision point, not a correction. `k = e.slice(0, e.lastIndexOf(":")+1)` is `"mstack:"`,
derived from the directory-based id, so `/mstack:mstack` is strictly *prefix from the plugin
namespace, second segment from the declared name*. "From its declared name" correctly identifies
the segment that differs from `/mstack:router`, which is what the sentence is distinguishing. No
change needed.

The last line, "The last is the front door everything else sits behind", is also borne out: the
fourth probe shows `/mstack <prose>` resolving through the alias with `args` parsed intact, which
is the README's entire premise.

## 2. The README paragraph: I agree, leave it

It is accurate and it does not claim to be exhaustive. A reader will not take
"registers a skill under `/<plugin>:<directory>`" as the complete set, because the sentence does
not stop there: it continues "and, when the declared name carries no colon, registers that name
as a bare alias too". The reader is being handed an enumeration that is visibly still going, and
the clause that follows links the wiki page that now gives all three. The paragraph's job is to
answer why plain `/mstack` works, and it answers exactly that.

If you want parity it is four words, "and as `/mstack:mstack` from that name". I would not spend
them. `/mstack:mstack` is a spelling nobody will type, and the README is the front door, not the
reference.

## 3. The CHANGELOG sentence: the residue is gone

> This project's research had not recorded it, which `rg -ni 'alias' docs/research/pstack-port.md`
> returning nothing confirms, and it was established here by reading the loader in the installed
> binary and running its own expressions against this repository's twelve skill directories.

Every clause is now something this session established, and I re-checked the cited evidence
rather than trusting the citation:

```
$ rg -ni 'alias' docs/research/pstack-port.md
[no output, exit 1]

$ fd . docs/research -t f
docs/research/pstack-port.md
```

The second command is the one that matters, and it is why the sentence is airtight rather than
merely true: `docs/research/` contains that one file, so "this project's research" is fully
covered by the command cited. The evidence is not narrower than the claim it supports. That is
the failure mode the old sentence had, and this is its opposite.

Optional, one word: "the installed binary" is version-bound. The mechanism is 2.1.241's, and a
later version could change it without a word of this becoming visibly stale. Naming the version
makes the claim checkable in a year. A release note is a point-in-time document, so this is a
preference, not a defect.

## Flagged unverified, for item 33

`yb` gives an exact `name` match absolute precedence: it returns on the first command whose
`name` equals what was typed, and only falls back to a `userFacingName` or alias match. Plugin
skills always carry a namespaced `name` (`<plugin>:<directory>`), so no plugin skill can take
`/mstack` out from under the router's alias by that route.

What I have **not** verified is whether a user-level or project-level command, which as far as I
know is not namespaced, would have `name === "mstack"` and therefore win outright over the
router's alias. I did not read that loader. If true it is the sharpest form of the collision item
33 exists to decide about, and it would cut both ways: mstack squats eleven bare names, and
anyone's own `/verify` would silently displace `/mstack:verify`'s alias. Settling it means
reading the user- and project-command loaders the way this round read `opf`, and it is worth
doing before the keep-or-drop decision, not after.

## What I ran

```
$ claude --version
2.1.241 (Claude Code)

$ rg -o -a 'JUS\(' <bundle> | wc -l
2

$ node <the four functions above, verbatim, over skills/*/SKILL.md>
(output pasted in section 1)

$ rg -ni 'alias' docs/research/pstack-port.md      -> no output
$ fd . docs/research -t f                          -> docs/research/pstack-port.md
```

Rung 4, and what I ran it on: the shipped 2.1.241 expressions against this checkout's twelve real
skill directories and their real front matter. Not a live session typing `/mstack`, which would
be rung 5 and which I have not done at any point in this review.
