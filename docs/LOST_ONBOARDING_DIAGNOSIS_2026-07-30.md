# Where Sam's 21 answers went — read from export 4

**Status: MECHANISM PROVEN FOR THE REPUBLICATION. The ORIGIN is narrowed to
three suspects and instrumented, not yet proven.** Both guards are built; the
next onboarding either survives or leaves a tape that names the writer.

Export deleted in the commit that recorded this file. Everything it said is below.

---

## 1. What the export said

```
capturedAt                       2026-07-29T04:34:38Z
isOnboardingComplete             false
onboardingData                   { trainingLocation: "Commercial gym",
                                   equipment: [8 items] }          ← 2 answers
acceptedProfileSnapshot          same 2 answers,
                                 sourceRevision 1, capturedAt 04:25:12Z
program                          4 microcycles, acceptedRevision 5
profileMirrorRefusals            []
athleteActionLog                 5 entries, ALL from this launch's hydration
```

**The decisive read: the live profile is BYTE-IDENTICAL to
`initialOnboardingData`** — the module-level default in `store/profileStore.ts`,
`Commercial gym` plus that exact eight-item equipment list. His answers were not
partially lost. The profile was replaced with the app's built-in default.

That also disposes of the reading that "only the first two answers saved":
`trainingLocation` and `equipment` are not the first two questions. They are the
only two the default happens to contain.

## 2. The republication — PROVEN

The last line of his own log:

```
04:34:16.819  hydration  athlete_action_completed  hydration_accepted_canonical_projection
```

That is the branch in `store/programStore.ts` that calls

```ts
require('./profileStore').publishAcceptedProfileCompatibilityMirror(
  acceptedBefore.acceptedProfileSnapshot.onboardingData,
);
```

**directly.** The narrowing law — "the mirror may only narrow toward accepted
truth, never widen a gap" — was written into the `useProfileStore.subscribe`
fence, and this call sets `acceptedProfileMirrorPublicationInProgress = true`,
whose whole purpose is to make the subscriber stand down. So the guard was not
bypassed by accident; the call is *designed* to bypass it, and the law had been
put on the wrong side of that design.

This is why the export shows a wiped profile beside an EMPTY refusal log. The
guarded path never ran.

**A guard only one of two callers passes through is not a guard.** Fixed: the
law now lives inside `publishAcceptedProfileCompatibilityMirror`, so every
publication is checked at the single place publication happens, and refusals go
to the durable action log as well as the in-memory record.

## 3. The fabrication — PROVEN, and it is the loop

`sourceRevision: 1` at 04:25:12, from `programStore.ts`:

```ts
sourceRevision: acceptedBefore.revision + 1,   // 0 + 1
onboardingData: profileForAcceptance,          // whatever is live RIGHT NOW
```

Hydration mints an accepted profile from the live profile whenever none exists.
The guard in front of it skipped acceptance only when there was **no program and
revision 0** — and generation had already built Sam a four-microcycle program
from those two answers, so it did not fire.

Once minted, the snapshot is self-perpetuating: ordinary transactions refresh it
only when the profile they carry differs, so a fabricated one freezes, and
every subsequent hydration republishes it over the live profile. That is the
loop that has now cost three onboardings.

**Fixed:** `acceptedProfileSnapshotMintRefusal` — an accepted profile records an
acceptance THE ATHLETE MADE, and before `isOnboardingComplete` there is no such
thing. Program presence was never the question. The condition is completion,
not answer count, deliberately: "enough answers to look complete" is a heuristic
about identity, and this file is where that class of mistake gets made.

## 4. The ORIGIN — narrowed, NOT proven

At 04:25:12 the live profile was **already** the 2-key default, and
`isOnboardingComplete` was false. So the loss happened DURING onboarding, before
completion — which rules out everything that only runs after completion,
including the subscribe fence (it returns early when incomplete).

What is NOT yet proven is which writer emptied it. Three suspects, in the order
the next tape will separate them:

1. **A mid-onboarding hydration republication.** Section 2's mechanism firing
   *during* onboarding rather than after it — the snapshot minted at 04:25:12
   would then be both a symptom and the cause of everything after. Requires a
   rehydrate mid-flow. The new mint guard breaks this loop at both ends, so if
   the answers still vanish, it was never this.
2. **`commitOnboardingStep`'s persistence.** It awaits `flushPendingStorageWrites`
   and throws on failure, so a silent loss would have to be a write that
   resolved without landing. Prior art: `ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md`
   §3.2/§4, the fire-and-forget window this door was built to close.
3. **`clear()` / `resetOnboarding()` landing late.** Both set
   `onboardingData: initialOnboardingData` — the exact bytes observed. Sam ran a
   Full reset immediately before onboarding, so a reset that resolved late,
   after answers had started landing, would produce precisely this state.

Suspect 3 fits the observed bytes most exactly and is the cheapest to confirm.
It is NOT being acted on: two of the three would leave identical wreckage, and
this is the fourth time reconstruction has been offered as diagnosis on this
device.

## 5. What the next tape will say

The log now covers the store this class of defect lives in — the instrumentation
rule applied to the instrument's own gap:

- `onboarding_step_committed` — per step: which FIELD NAMES were written, the
  answer count before, the answer count after, and whether onboarding was
  already marked complete. A wipe shows as `answerCountBefore: 21,
  answerCountAfter: 2` with the step that straddles it named.
- `onboarding_completion_result` — the guard's verdict, the number of missing
  answers, and the size of the profile it judged. Sam's refusal said "one more
  answer needed" over sixteen; nothing recorded that the profile it read held
  two keys.
- `profile_mirror_publication_refused` — every refusal, on disk, surviving the
  relaunch that hid the last set.

Answers themselves are never recorded — field names and counts only. The log
leaves the device.

**Re-run:** full reset, onboarding, then export whether it succeeds or refuses.
The export button is on both the refusal screen and Welcome, so a refusal no
longer traps its own evidence.
