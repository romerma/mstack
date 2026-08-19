# Spec templates

Four files in `.mstack/specs/<slug>/`.

## proposal.md

```markdown
> Source: <issue reference, or "direct request">. This spec is authoritative for
> implementation; the source remains the discussion venue.

## Why
<!-- The problem. Why now. Not what you plan to build. -->

## What changes
<!-- New capabilities, modifications, removals. Be specific. -->

## Impact
<!-- Affected code, APIs, dependencies, data. What could break. -->

## Human gate
<!-- Does the lean trigger apply? Direct request with no issue, a decision_required
     field, or a product fork with different user-visible outcomes. State which, or
     "does not apply". -->
```

## spec.md

```markdown
## ADDED Requirements

### Requirement: R1 <short name>
The system MUST <EARS obligation>.

#### Scenario: <name>
- **WHEN** <condition>
- **THEN** <observable outcome>
```

## design.md

```markdown
## Context
<!-- Current state and the constraints that shape the approach. The motivation is in
     proposal.md; do not restate it. -->

## Usage
<!-- The caller's view, written first. The type sketch below derives from this. -->

## Shape
<!-- Data structures first, then how data moves through the signatures. -->

## Rejected alternatives
<!-- Required. At least one. "This was the only viable shape because X" is a valid
     entry; an empty section is not. -->

## Trade-offs accepted
<!-- "We accept X in exchange for Y." -->

## Open questions
<!-- Phrased as questions. Only genuinely deferrable ones: anything that would change
     the shape gets resolved now. -->
```

## tasks.md

```markdown
## 1. <group>
- [ ] 1.1 <task> (covers R1)
- [ ] 1.2 <task> (covers R2, R3)

## 2. Verification and close
- [ ] 2.1 <the exact verification command>; record R-to-test in the implementation report
- [ ] 2.2 Independent review by a pass that did not write the code
- [ ] 2.3 PR, merge gate, close
```

Every task names the requirements it covers. The tick boxes are the progress signal, so keep
the `- [ ]` form exactly.
