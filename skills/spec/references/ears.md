# EARS

Five statement forms. One requirement carries one obligation.

| Form | Shape | Use for |
|---|---|---|
| Ubiquitous | `The system MUST <do X>.` | Something always true |
| Event-driven | `WHEN <trigger>, the system MUST <do X>.` | A response to something happening |
| State-driven | `WHILE <state>, the system MUST <do X>.` | Behaviour that holds during a state |
| Optional | `WHERE <feature is present>, the system MUST <do X>.` | Behaviour behind a flag or tier |
| Unwanted | `IF <unwanted condition>, THEN the system MUST <do X>.` | Failure and error paths |

Avoid subjective language unless it has a measurable definition. "Fast" is not a requirement;
"responds within 200ms at p95" is.

## Scenarios

Every requirement carries at least one:

```markdown
### Requirement: R3 Finalize needs a green validation

WHEN the last validation for the current payload is green AND the form has not been edited
since, the system MUST enable Finalize.

#### Scenario: A stale green does not count
- **WHEN** the payload changes after a green validation
- **THEN** Finalize is disabled until the next validation succeeds
```

## Changing existing behaviour

Use `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`. When you
modify one, copy the **entire** existing requirement block including its scenarios, then edit
the copy. A modified requirement that silently drops a scenario has removed a guarantee nobody
agreed to remove.

Requirement ids are stable across revisions. Reuse `R3` when you change R3; never renumber.
