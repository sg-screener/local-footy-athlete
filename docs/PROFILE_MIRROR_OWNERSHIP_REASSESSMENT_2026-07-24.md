# Profile Mirror Ownership Reassessment — 2026-07-24

**Status: APPROVED AND SHIPPED — Sam approved option 3 (both A and B, sequenced,
tests-first) on 2026-07-24. Both are implemented; the repro test is green.**

**This document supersedes §5 of `ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md`
and its "traced and confirmed safe for this device's true-fresh-install case"
conclusion.** That conclusion checked `createEmptyAcceptedMaterialContext()`
(revision 0) but did not trace that hydration *itself* immediately commits an
acceptance taking the store to revision 1. On a genuinely empty disk it does.
The mechanism therefore needs no relaunch, no crash and no memory pressure, and
hypothesis 2 (the fire-and-forget write race) is a real but *secondary* defect —
fixed in the same unit, and pinned by its own characterisation test — not the
cause of the reported symptom.

Triggered by the AGENTS.md / CLAUDE.md escalation rule: *"the AI/semantic layer
understands the user correctly, but a later layer changes, blocks, downgrades,
or reinterprets that intent."* Here the onboarding layer captures the athlete's
answer correctly and a later layer reverts it.

This supersedes §5 of `ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md`, which
called this path a *risk* and recorded it as "traced and confirmed safe for this
device's true-fresh-install case". That conclusion is **wrong**, and the
correction promotes hypothesis 2 from PLAUSIBLE to superseded: the real
mechanism needs no relaunch, no crash, and no memory pressure.

---

## 1. The reproduction

Headless, `__DEV__ = false`, **AsyncStorage completely empty** (a true fresh
install), all persisted stores hydrated to completion:

```
disk keys at boot: []
post-hydration revision = 1 | snapshot present = true
snapshot profile = {"trainingLocation":"Commercial gym","equipment":[...]}    ← empty profile

after Name:        {"trainingLocation":"Commercial gym","equipment":[...]}    ← firstName gone
after Body:        {"trainingLocation":"Commercial gym","equipment":[...]}    ← height/weight gone
after SeasonPhase: {"trainingLocation":"Commercial gym","equipment":[...]}    ← seasonPhase gone
```

Every `updateOnboardingData()` is reverted **synchronously, in memory**, before
any persistence is even attempted.

### Why

1. `programStore.ts:1835` `onRehydrateStorage`'s success path runs on *every*
   cold start — zustand invokes the post-rehydration callback even when storage
   returned nothing.
2. That path reaches `commitAcceptedStateTransaction({ reason:
   'program:hydration_acceptance', … })` (`programStore.ts:1960`), which raises
   `acceptedMaterialContext.revision` to **1** and stores an
   `acceptedProfileSnapshot` built from whatever profile existed at that moment
   — on a fresh install, `initialOnboardingData` (`profileStore.ts:20-32`).
3. `profileStore.ts:135-148` subscribes to every `onboardingData` change and
   overwrites it with `canonicalAcceptedProfile()` whenever `revision > 0 &&
   acceptedProfileSnapshot` (`profileStore.ts:94-103`). Both are now true.
4. Therefore every onboarding answer differs from the empty snapshot, and every
   one is replaced by it.

### Why this explains the device report exactly

| Symptom (07-24 device report) | Explained by |
|---|---|
| Review showed "Not provided / Not selected" for **every** field | The whole object is reverted, not individual fields — this is the total-object reset §2 of the diagnosis could not otherwise account for |
| Program generated as Pre-season despite In-season chosen | `seasonPhase` reverted → `seasonPhase ?? 'Pre-season'` fired |
| Profile name "Athlete", LFA Days "Not set" | `firstName` / `trainingDaysPerWeek` reverted → display fallbacks fired |
| Step progress bar did not advance on the first attempt | `useOnboardingProgress` derives its step count from `seasonPhase` / `experienceLevel`, both of which the mirror keeps reverting |
| Worked on a second attempt | Once an accepted program exists, the snapshot carries real data, so the revert is no longer visible in the same way — timing-dependent, which is exactly what "worked the second time" looks like |

### The interaction that makes this urgent now

Before this branch, `useInitializeApp` released the UI after a flat 300ms timer
that checked nothing. Onboarding screens could therefore mount and commit
answers *before* the asynchronous hydration acceptance completed — a race the
athlete sometimes won.

**The hydration gate built in this unit removes that race in the wrong
direction**: boot now waits for `programStore.persist.hasHydrated()`, which is
wrapped to mean "raw hydration AND acceptance" (`programStore.ts:2070`). The
mirror is therefore *always* armed before the first onboarding screen mounts.
Shipping the gate without resolving this would make an intermittent bug a
deterministic one. The two changes cannot ship independently.

---

## 2. The seven questions

**1. What is the current source of truth?**
Ambiguous, and that is the defect. `programStore.acceptedMaterialContext
.acceptedProfileSnapshot` claims authority unconditionally
(`profileStore.ts:105`: *"ProgramStore's accepted profile is authoritative;
ProfileStore is a read mirror"*), but during onboarding no program has been
accepted and the snapshot is a fabrication of hydration, not a record of
anything the athlete said.

**2. How many representations of the athlete's profile exist?**
Three: `profileStore.onboardingData` (what the athlete is typing),
`acceptedMaterialContext.acceptedProfileSnapshot.onboardingData` (what the last
accepted program was built from), and the accepted-profile constraints derived
from it (`composeAcceptedProfileConstraints`).

**3. Where can the athlete's answer be reinterpreted?**
At the `useProfileStore.subscribe` fence (`profileStore.ts:135-148`) — a
synchronous, silent, whole-object replacement with no logging, no event, and no
athlete-visible signal.

**4. Which layer should own the decision?**
Onboarding owns the profile until onboarding completes and produces an accepted
program. After that, the accepted snapshot owns it. There is a single, sharp
transition — `isOnboardingComplete` — and today nothing encodes it.

**5. What simpler architecture removes representations instead of adding
guards?**
Two candidates, in preference order:

- **(A) Scope the mirror to its stated contract.** The mirror is a
  *post-acceptance* compatibility mirror; make it inert while
  `isOnboardingComplete === false`. This removes no representation but makes the
  existing ownership claim true instead of aspirational. One line of policy in
  the owner; no new resolver, no per-screen branch.
- **(B) Do not snapshot a profile that was never accepted.** Hydration should
  not mint an `acceptedProfileSnapshot` when there is no accepted program —
  `revision` should stay 0 through a fresh install. This removes a *fabricated*
  representation, which is the stronger fix, but it touches the accepted-state
  transaction that §18 ownership work depends on and needs its own invariant
  review.

(A) and (B) are not exclusive; (B) is the deeper correction and (A) is the
boundary that should hold regardless.

**6. Which legacy paths should be retired rather than patched?**
The compatibility mirror itself. It exists so that pre-§18 readers of
`profileStore.onboardingData` keep working after a coach edit changes the
accepted profile. Every such reader that migrates to the accepted context
shrinks it; when the last one migrates, the subscribe fence and both
`publish…`/`restore…CompatibilityMirror` entry points can be deleted outright.
That is the retirement, not another condition on the fence.

**7. What tests prove the new ownership boundary?**
Written and currently RED in `src/__tests__/onboardingReliabilityTests.ts`:

- The full fresh-install walk above, asserting each answer survives its commit.
- `C1` — the relaunch-with-unflushed-writes characterisation, so the *other*
  mechanism cannot regress unnoticed.
- `C3` — relaunch mid-flow resumes at the first unanswered step with the
  earlier answers intact.
- A new invariant is owed either way: **no store may replace
  `profileStore.onboardingData` while `isOnboardingComplete` is false.**

---

## 3. Recommendation, and what was done

The reassessment recommended taking (A) now and scheduling (B). **Sam took
both, sequenced, tests-first**, on the grounds that A alone guards against
stale snapshots the mirror might read, while B stops manufacturing them — and
the iCloud-restore / TestFlight-update shapes (storage non-empty on a nominal
"fresh install") need both. An acceptance record nobody made is a false record,
the same L6 class as a false "Done".

### Shipped

1. **The load-bearing repro test first** — `onboardingReliabilityTests` case
   `0`: fresh empty disk → hydration completes → the athlete answers all 17
   steps → every answer survives, the profile is durably persisted, Review finds
   nothing missing, and generation receives the athlete's own season phase. RED
   before A, green after.
2. **(A) the mirror scoped to post-acceptance** — `profileStore.ts`: the
   subscribe fence returns early while `isOnboardingComplete` is false. This
   alone turned case `0` green, as required.
3. **(B) hydration stops fabricating an acceptance** — `programStore.ts`
   `onRehydrateStorage`: when there is no `currentProgram` **and**
   `acceptedBefore.revision === 0`, the acceptance commit is skipped entirely
   and the trace records `hydration_no_accepted_state_to_project`. Pinned by
   case `0b`. The guard is deliberately narrow — it can only affect a device
   that has never had a program — so it cannot change any existing athlete's
   accepted state.

**B did not surface dependencies beyond the unit's blast radius**, so the
STOP-on-B fallback was not needed: `test:bible` is green (including the §18
ownership, accepted-state-transaction and hydration-ownership suites), as are
`test:onboarding-cold-start`, `test:program-hydration-ownership`,
`test:dev-e2e-reset-hydration` and `test:dev-onboarding-skip`.

The residual — retiring the mirror rather than scoping it — is logged with its
trigger in `SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`'s retirement ledger.

## NOT-COVERED

- Whether the hydration acceptance at `programStore.ts:1960` is *needed* on a
  fresh install at all, or is only meaningful when a program already exists.
  That is option (B) and was not traced.
- The other `publishAcceptedProfileCompatibilityMirror` call sites
  (`acceptedStateTransaction.ts:689`, `programStore.ts:1880`) were read but not
  audited for the same fresh-install assumption.
- No device evidence was gathered for this reassessment; the reproduction is
  headless and deterministic, which is stronger for this particular claim, but
  the device pass is still owed — and per L3 it must be a real fresh install
  (delete, reboot, reinstall), because that is the only state that reproduces
  the original bug.
- The iCloud-restore and TestFlight-update shapes (storage non-empty on a
  nominal "fresh install") are protected by A but were not exercised on a
  device.
