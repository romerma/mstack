<!-- Origin: vocabulary and tests from mattpocock/skills, skills/engineering/codebase-design/SKILL.md and DEEPENING.md @ 49dd158d1076134a641b33efb035946536778336 (MIT, licenses/mattpocock-skills-LICENSE.txt). Adapted: reduced to terms and tests with no process, because the source's own documentation records a session spending 100k tokens redesigning things nobody asked about when it ran as one. -->

# Deep modules

Terms and tests, not a procedure. When judging or designing a change, apply them to that
change and to nothing else: do not go looking for more to redesign. Use these words exactly;
"component", "service", "API" and "boundary" blur them.

- **Module**: anything with an interface and an implementation, at any scale: a function, a
  class, a package, a slice across tiers.
- **Interface**: everything a caller must know to use the module correctly: signature, but
  also invariants, ordering, error modes, required configuration, performance.
- **Depth**: how much behaviour a caller or test gets per unit of interface it must learn.
  **Deep**: much behaviour behind a small interface. **Shallow**: an interface nearly as
  complex as its implementation.
- **Leverage** is what callers get from depth: one implementation pays back across every call
  site and test. **Locality** is what maintainers get: change, bugs and knowledge concentrate
  in one place instead of spreading across callers.
- **Seam**: where the module's interface lives, a place where behaviour can change without
  editing there. **Adapter**: a concrete thing that fills the interface at a seam.

## Tests

- **Deletion test.** Imagine deleting the module. If the complexity vanishes, it was a
  pass-through. If it reappears across N callers, the module was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. A test that
  has to reach past the interface says the module has the wrong shape.
- **One adapter is a hypothetical seam; two make it real.** A seam nothing varies across is
  indirection. A port needs two adapters, typically production and test.
- **Dependency category** decides how a deepened module is tested across its seam:
  1. *In-process*: pure computation or in-memory state. Merge the modules and test through
     the new interface; no adapter.
  2. *Local-substitutable*: has a local stand-in (an in-memory filesystem, an embedded
     database). Test with the stand-in running; the seam stays internal.
  3. *Remote but owned*: your own service across a network. Put a port at the seam, with a
     transport adapter in production and an in-memory one in tests.
  4. *True external*: a third party you do not control. Inject it as a port; tests supply a
     mock adapter.
- **Replace, do not layer.** Once tests exist at a deepened interface, the tests of the
  shallow modules it absorbed are waste; delete them.
