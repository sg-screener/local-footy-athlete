# Dead-control class — architecture reassessment (2026-07-29)

Written because the CLAUDE.md escalation trigger fired: **the same class of bug
appeared three times, twice after a supposedly general fix.**

The class: *a control that looks live and does nothing.* Occurrences:

1. **Profile setup-sheet Save** — `setupHasChanges` and `buildSetupPatch` were
   two comparisons over the same fields, free to disagree.
2. **Profile setup-sheet Save, again** — I collapsed those two into one
   decision and declared it fixed. The button became live; the commit still
   did nothing. My test asserted the DECISION and stopped one layer short.
3. **Season-phase skew repair button** — found on Sam's device re-check. The
   disclosure appeared, the button darkened on press, nothing happened.

All three are one defect, and my fix for (1) did not touch it.

## 1. What is the current source of truth?

The clock owns the season phase; the profile selection is the input it is
minted from; `commitProfileProgramTransaction` publishes both together. That
part holds.

## 2. How many representations of the request exist?

Two, and the second is lossy. The athlete's request is *"make my program
In-season."* The transaction's proxy for it is *"does the profile object
differ?"* — `semanticFingerprint(nextProfile) === semanticFingerprint(currentProfile)`.

## 3. Where can intent be reinterpreted?

At that short-circuit. On a phase-skewed device the profile **already** holds
the athlete's selection — that is what skew means — so every route that asks
the program to be re-owned under it produces a byte-identical profile and is
discarded as `no_change`. Three separate controls funnel through this one line:
the repair button, the setup-sheet Save, and the phase-shift sheet.

The intent was understood correctly at every layer above. A later layer
reinterpreted "the program is wrong" as "nothing to do".

## 4. Which layer should own the decision?

The transaction — it is the only thing that publishes both surfaces. But its
already-satisfied test has to span **what it publishes**, not one of the two
things it publishes.

## 5. What simpler architecture removes representations instead of adding guards?

Make `no_change` mean **"the accepted state already satisfies this request"**.
One comparison over the state the transaction actually owns, replacing a
profile-only proxy standing in for it:

```
profileUnchanged && programAlreadyOwnsRequestedPhase
```

This removes the second representation rather than adding a third. Every
current and future "the profile is right but the program is stale" repair works
without its own branch.

**Explicitly rejected:** a `force: true` flag, or a `season_phase_skew_repair`
branch inside the transaction. Both are the "just add a guard" / "special-case
this route" move the Stop-Patching Trigger names. A flag lets the next caller
bypass the check entirely, and neither one states what "no change" means.

## 6. Which legacy paths should be retired?

None new. The profile-only fingerprint check is not retired — it is one half of
a correct test now, rather than the whole of an incorrect one.

## 7. What tests prove the new ownership boundary?

Commit-level, not decision-level — that distinction is the whole lesson:

- repair press on a skewed device → `changedProgram === true`, and
  `ownSeasonPhase(...).skew === null` afterwards
- setup-sheet Save on a skewed device → same, via `decideProfileSetupChange`'s
  real patch
- the genuine no-op on an **unskewed** device still returns `no_change`
  (the fix must not un-gate every unchanged Save)
- the repair handler reports a no-change outcome instead of swallowing it

All four in `test:phase-skew-repair`, all four RED before the fix. Three
mutations — reverting the gate to profile-only, widening it to always rebuild,
and re-swallowing the outcome — are all killed.

## The lesson worth keeping

**A test that stops at the decision layer cannot see a defect in the commit
layer.** Occurrence (2) shipped with a passing test suite and a commit message
claiming the dead tap was "reproduced and fixed". It was reproduced at the
button and fixed at the button. The press still did nothing, and the only
reason we know is that Sam pressed it on a real device.

Where a control's visible outcome is the thing under test, assert on the
outcome — the accepted state after the press — not on the decision that
precedes it.

A second, smaller lesson: the repair handler branched only on `!result.ok`, so
an `ok: true, changedProgram: false` outcome was invisible. The refusal table
had covered `no_change` since it was written; the caller never asked it.
Coverage in the owner is not coverage at the call site.
