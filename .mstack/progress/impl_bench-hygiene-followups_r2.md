# Implementation, round 2 - bench-hygiene-followups (item 49)

Round 2 at head `1bff9ac`. It follows the leak rule of `sandbox/bench/DESIGN.md`: tests, assertion lines and sentences are named by id and number only. The change is in `sandbox/bench/`, which is gitignored here and untracked in the nested `sandbox` repository, so it is under no version control. Before copy of round 1: `bench49_r1/` in the scratchpad (`tasks/H3/meta.json`, `tasks/H4/meta.json`). Pre-item copy: `bench49_before/`, untouched.

## What changed since round 1

Finding 1 of the round 1 review holds for all three gaps; I checked each against the hidden tests, `template-hard/README.md`, `issue.md` and the `meta.json` files. I went assertion by assertion through the five tests and found two more mapping gaps, both small. Only `tasks/H3/meta.json` and `tasks/H4/meta.json` changed; no test, README or issue changed.

Applied from finding 1:
- H3-b added to H3 entry 8 (`README.md:181`).
- H4-a added to H4 entries 5 (`issue.md:11`) and 7 (`README.md:237`).
- New H4 entry 25 for `README.md:151`, mapped to H4-c, in the file's existing shape.

Found beyond finding 1:
- H3-b added to H3 entry 11 (`README.md:180`): the test saves a version 1 file and reads it back, which is the rewrite entry 11 states.
- H4-a added to H4 entry 11 (`README.md:163`): the total H4-a prints at its first assertion is the credit note total, which entry 11 defines (valued at the invoiced unit price times the units credited). Entry 3 gives only the output format.

Left as is, stated: H4-b `:123` rests on entry 23 (`README.md:239`) read with the template's own treatment of an order line sku as an id (`orders.py:63`), as non-blocking finding 2 describes. Mapping H4-b to issue entry 5 would add an issue-mapped test and move the issue denominator 7 to 8, which the review asked not to move. Whether a fresh reader takes that reading is the reviewer's call.

## Files

- `sandbox/bench/tasks/H3/meta.json`
- `sandbox/bench/tasks/H4/meta.json`
- `.mstack/progress/impl_bench-hygiene-followups_r2.md`, one `implement` decision row, one ledger row

## Match table (by id and number only)

Test ids: H3-a = `test_H3.py:128`, H3-b = `test_H3.py:151`, H4-a = `test_H4.py:128`, H4-b = `test_H4.py:121`, H4-c = `test_H4.py:176`. Entry numbers are 1-based positions in the current `meta.json` `sentences`; entries marked `*` were added in round 2.

| Test | Assertion line | Entailed by entry |
|---|---|---|
| H3-a | `test_H3.py:131` | 9 |
| H3-a | `test_H3.py:132` | 15 |
| H3-a | `test_H3.py:133` | 15 |
| H3-a | `test_H3.py:134` | 16 |
| H3-b | `test_H3.py:155` | 8*, 12 |
| H3-b | `test_H3.py:156` | 8*, 12 (README wording of 8 is filed as finding 2 of `review_benchmark-hard-tier.md`) |
| H3-b | `test_H3.py:157` | 15 |
| H3-b | `test_H3.py:158` | 15 |
| H3-b | `test_H3.py:159` | 16, with 11* (the save that rewrites the file) |
| H4-a | `test_H4.py:138` | 3, 11* |
| H4-a | `test_H4.py:142` | 5*, 7*, 22 |
| H4-a | `test_H4.py:143` | 22, 7* |
| H4-b | `test_H4.py:123` | 7, 23 (reading named above) |
| H4-b | `test_H4.py:125` | 7, 23 |
| H4-c | `test_H4.py:182` | 10, 8 |
| H4-c | `test_H4.py:183` | 24 (order id), 8 (warehouse), 10 |
| H4-c | `test_H4.py:184` | 10, 8 |
| H4-c | `test_H4.py:185` | 25* |
| H4-c | `test_H4.py:179`, `:181` (selection of new events by sequence number) | 25* |

No assertion of the five tests is left without an entry, with the one reading on H4-b `:123` named above. On that basis the trace of these five tests is complete. The other 39 hidden tests of H3 and H4 were not checked; item 99 holds that.

## diff -u of the two meta.json files against `bench49_r1/`

```
--- /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/bench49_r1/tasks/H3/meta.json	2026-11-18 21:43:03
+++ sandbox/bench/tasks/H3/meta.json	2026-11-18 21:44:32
@@ -54,7 +54,8 @@
    "source": "README.md",
    "tests": [
     "test_v1_file_loads_with_its_discounts_in_basis_points",
-    "test_a_migrated_discount_prices_the_invoice_like_a_native_one"
+    "test_a_migrated_discount_prices_the_invoice_like_a_native_one",
+    "test_discounts_and_text_survive_the_migration_and_a_restart"
    ]
   },
   {
@@ -76,7 +77,8 @@
    "source": "README.md",
    "tests": [
     "test_a_v1_file_becomes_v2_on_the_next_save",
-    "test_small_v1_file_round_trips_through_a_save"
+    "test_small_v1_file_round_trips_through_a_save",
+    "test_discounts_and_text_survive_the_migration_and_a_restart"
    ]
   },
   {
--- /private/tmp/claude-501/-Users-romerma-Code-mstack/4aadee9d-d352-4d5b-825b-4d11a47e2193/scratchpad/bench49_r1/tasks/H4/meta.json	2026-11-18 21:43:03
+++ sandbox/bench/tasks/H4/meta.json	2026-11-18 21:44:32
@@ -33,7 +33,8 @@
   {
    "text": "never more than was shipped minus what was already returned for that line; asking for more is an error",
    "tests": [
-    "test_never_more_than_shipped_minus_already_returned"
+    "test_never_more_than_shipped_minus_already_returned",
+    "test_cli_return_command"
    ]
   },
   {
@@ -46,7 +47,8 @@
    "text": "Every deliberate error derives from `StockroomError` in `stockroom/domain/errors.py`.",
    "source": "README.md",
    "tests": [
-    "test_a_sku_that_is_not_on_the_order_is_an_error"
+    "test_a_sku_that_is_not_on_the_order_is_an_error",
+    "test_cli_return_command"
    ]
   },
   {
@@ -77,7 +79,8 @@
    "tests": [
     "test_inclusive_credit_rounds_per_line_like_an_invoice",
     "test_exclusive_credit_rounds_per_line_like_an_invoice",
-    "test_credit_is_valued_at_the_invoiced_unit_price"
+    "test_credit_is_valued_at_the_invoiced_unit_price",
+    "test_cli_return_command"
    ]
   },
   {
@@ -172,6 +175,13 @@
    "tests": [
     "test_a_return_writes_audit_events"
    ]
+  },
+  {
+   "text": "Event sequence numbers never repeat and never go back.",
+   "source": "README.md",
+   "tests": [
+    "test_a_return_writes_audit_events"
+   ]
   }
  ]
 }
```

Entry ids by hunk: H3 hunks are entries 8 and 11; H4 hunks are entries 5, 7, 11 and the new entry 25.

## Commands

```
$ node sandbox/bench/verify.mjs; echo $?      -> 0, "all checks passed"
  H3 trace: 16 sentences, 18 tests (9 from issue.md, 9 from README.md), all mapped
  H3 naive: visible 202/202, issue-mapped tests failing 0/9, README-mapped tests failing 4/9
  H4 trace: 25 sentences, 26 tests (7 from issue.md, 20 from README.md), all mapped
  H4 naive: visible 202/202, issue-mapped tests failing 0/7, README-mapped tests failing 9/20
  hard tasks with a naive patch: 4 of 4 (every hard task needs one)
$ node sandbox/bench/check.mjs; echo $?       -> 0, "all harness checks passed", 91 ok
```

Against the round 1 state, the only `verify.mjs` summary figure that moved is H4's sentence count, 24 to 25. No denominator and no pass count moved. Full output: `scratchpad/impl49r2/verify.out` and `check.out`. Neither starts a model session; no `run.mjs` was run.

After the work: `git status --short` is clean; `git -C sandbox status --short` is `?? bench/` and `?? clima-portable/`. Round 1's ledger row said `type-check-only` for a claim at rung 4; this round's row is `test-verified`, because both checks were run after the last edit and passed.

## R to test

| R | Test | Where |
|---|---|---|
| A1 | scratch-root assertion | n/a: node sandbox/bench/check.mjs exits 0 (91 ok) with the assertion from round 1, unchanged this round; file is untracked under sandbox/ |
| A2 | DESIGN.md leak rule | n/a: prose in sandbox/bench/DESIGN.md, unchanged this round; this report and its decision row follow it |
| A3 | meta.json mapping | n/a: node sandbox/bench/verify.mjs exits 0 with the same pass counts; the match table above covers the five tests; files are untracked under sandbox/ |
| A4 | left by decision | n/a: nothing changed, the design row of 2026-11-18T20:21:02Z records leaving the README wording and the cosmetic items |
