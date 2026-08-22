# current

## Item

25 provenance-fixtures-lack-package-json — in_progress, branch fix/provenance-fixtures-lack-package-json.

## Plan

CI oldest-node (node 22.6, no bun) fails 4/276: provenance fixtures copy bin/, src/,
.claude-plugin/ but not package.json, so node 22.6 prints MODULE_TYPELESS_PACKAGE_JSON on
stderr and the tests assert stderr empty.

1. Capture red run under real 22.6.0 (CI incantation, bun-free PATH). <- doing now
2. Sweep of builders done:
   - tests/provenance.test.ts scratchCheckout() line 50: FIX (copy real package.json)
   - tests/provenance.test.ts line 217 wrapper repo (no manifest, deliberately not a checkout): untouched
   - tests/provenance.test.ts line 295 fifo manifest (isFile false, not a checkout): untouched
   - tests/gate.test.ts checkoutMarkers() line 1196: FIX per acceptance 2 (copy real package.json)
   - tests/gate.test.ts manifest-shapes 1306-1317 (built on checkoutMarkers, deliberately not checkouts): inherit the copy, untouched otherwise
   - tests/lint.test.ts copy() line 14: no bin/, isMstackCheckout false, not a checkout stand-in: untouched
3. Apply fix, green run under 22.6.0, npm test both runtimes, typecheck, lint-plugin.
4. Report + ledger row (implementer). CI-on-main half is pending push, say so.

## If this session stops now

Nothing changed yet besides state.json (item activation). Start at step 1 above.
