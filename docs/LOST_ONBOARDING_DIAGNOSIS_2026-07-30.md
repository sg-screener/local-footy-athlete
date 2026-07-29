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

---

# Addendum — export 5, and the writer nobody can name

**The tape is decisive about the window and silent about the writer.** That is
what this round's fix is shaped around.

## The 31 seconds

```
04:54:05.356  program_store_hydration   hydration_accepted_canonical_projection
04:54:10.355  onboarding_step_committed firstName                        2 -> 3
   ... 17 more, one per step, every one clean ...
04:54:53.107  onboarding_step_committed injuries                        22 -> 22
                       ← 31 SECONDS, NOT ONE ENTRY →
04:55:24.709  onboarding_completion_result   judged=2  missing=15  REFUSED
```

Twenty-two answers went in, one step at a time, each one durable. Thirty-one
seconds later the completion guard read a profile of **two**, and the surviving
bytes were exactly `initialOnboardingData`. No `profile_mirror_publication_refused`,
no mirror refusal in the record, no commit. **A writer nothing could see.**

The guard was right every time. It has always been right. It was reading a
profile something else had already emptied.

## Why the fix is a shape and not a patch

Four attempts to name that writer by reading code have failed — this is the
fifth device round trip on the same defect. So the law stopped being a rule
about one caller and became the shape of the store:

1. **One door.** Every write of `onboardingData` goes through
   `applyProfileOnboardingWrite`. `profileMirrorNarrowingTests` fails the build
   on a second `useProfileStore.setState` anywhere in the file, on any store
   action that assigns the profile, and on a direct write from `resetCoach`,
   `programStore`, `acceptedStateTransaction` or `coachMutationTransaction`.
   Mutation-tested: adding one writer turns the suite red.
2. **The default is not a value.** Writing the built-in default over a profile
   with real answers is REFUSED — unless the write carries a reset action that
   is IN FLIGHT, because that is the only moment erasing answers is what the
   athlete asked for.
3. **In-flight, not "a reset happened".** A stale id — a deferred write
   belonging to a reset that finished before the athlete started answering — is
   refused as `reset_action_not_in_flight`. That is precisely the suspected
   shape of this loss, and it is now refused whether or not it turns out to be
   the culprit.
4. **Everything is on the tape.** Applied or refused, every write names its
   writer and the counts either side of it. The full reset brackets itself with
   `full_reset_started` / `full_reset_complete`, so the next export carries the
   one datum every reconstruction lacked: *when the reset actually ran*, against
   when the answers went in. Even zustand's rehydration — the one writer that
   cannot go through the owner, because the middleware calls it and it returns
   state rather than setting it — now emits `profile_rehydrated` with its three
   counts.

## What the next run proves

- **The answers survive.** Then the writer was one of the paths now refused, and
  the refusal names it: `default_over_answered_profile` or
  `reset_action_not_in_flight`, with `writer:` on the entry.
- **The answers vanish anyway.** Then it is not a profile-store write at all,
  and the tape's `profile_write` sequence plus `profile_rehydrated` counts
  bound it to something outside this store — which is a much smaller search
  than the one that has failed four times.

Either way the next export answers it. No further reconstruction.

---

# Closed — export 6 named the writer

```
05:13:21  profile_write  writer=accepted_transaction  REFUSED  22 -> 22   (×4)
05:13:23  onboarding_completion_result  ACCEPTED   answers 23
```

**The villain: `commitAcceptedStateTransaction`'s compatibility-mirror
publication, pushing the frozen accepted snapshot over the live profile.** Four
attempts in two seconds — one per ordinary transaction running around
completion — every one refused by the write owner, and onboarding then closed
with all 23 answers intact.

It took five device round trips because every layer was individually defensible.
The publication is correct in principle: the accepted profile IS authoritative.
What made it lethal was that the record it published had been fabricated at
revision 1 from the store's default, and could never afterwards be corrected.

## Why the record could never fix itself

`stageAcceptedStateTransaction` refreshes the snapshot only when

```ts
proposal.acceptedProfileSnapshot !== undefined ||
  (proposal.profile !== undefined && profileChanged)
```

and **no ordinary transaction carries a profile** — not a move, not a
generation, not `set_today_workout`. So the snapshot froze on first mint, while
`acceptedProfileForContext` handed that same frozen copy to everything
downstream and the publication pushed it at the live profile on every commit.
A corrupt record, republished forever, unable to be repaired by any of the
traffic that kept republishing it.

That is the answer to "were the four refused writes the snapshot trying to
propagate itself?" — **yes, literally**. Four transactions, four attempts to
overwrite the profile with the 2-key record, in one second.

## The residue, closed

`staleAcceptedSnapshotRepair`: when the stored snapshot is missing answers the
live profile has, the RECORD is what is wrong, and it is re-minted from the live
profile at the revision it is corrected at — emitting `profile_snapshot_repaired`
with the count it recovered. Sam's device repairs itself on his next ordinary
transaction; the snapshot stops reading 2 at revision 13 and starts matching the
acceptance.

Scoped to transactions with **no opinion about the profile**. One that carries a
profile is making a decision — leaving In-season clears the game day — and
"repairing" that back from the mirror would undo the athlete's own change.
`phaseShiftAtomicityTests` caught exactly that and is why the scope is there.

## The shape of the whole thing, for next time

Five faces of one law, each found only after the one before it was fixed:

1. The mirror publishes a whole object → it can un-answer questions.
2. The narrowing law was in the subscriber → the direct caller bypassed it.
3. The snapshot was minted before any acceptance existed → fabricated at
   revision 1 from the default.
4. Anything could write the profile → the writer was unnameable for four rounds.
5. The record could not be corrected by the traffic that kept publishing it →
   it stayed wrong after it stopped being harmful.

Every one of them was invisible until the tape covered the store it lived in.
That is the instrumentation rule paying for itself.
