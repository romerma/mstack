# current

## Item

25 provenance-fixtures-lack-package-json — in_progress, branch fix/provenance-fixtures-lack-package-json.

## Done

- Red run captured on real node 22.6.0 (4/12 provenance fails, the exact CI four).
- Sweep of all six checkout-shaped builders; the two isMstackCheckout accepts now copy the
  repo's real package.json (tests/provenance.test.ts:61, tests/gate.test.ts:1206), the four
  deliberately-not-a-checkout builders untouched. Decision row recorded.
- Green: provenance 12/12 and full suite 276/276 on 22.6.0 with the CI incantation;
  npm test 276/276 on both runtimes; typecheck and lint-plugin clean.
- Fix committed at 471b163e. Report: .mstack/progress/impl_provenance-fixtures-lack-package-json.md.

## If this session stops right now

Implementation is complete and committed; ledger row (implementer, test-verified) is the
only step possibly unfinished — check `./bin/mstack ledger check provenance-fixtures-lack-package-json`.
Next: reviewer pass, then push; acceptance 3's CI-green-on-main half is pending the push
and is stated as pending in the report.
