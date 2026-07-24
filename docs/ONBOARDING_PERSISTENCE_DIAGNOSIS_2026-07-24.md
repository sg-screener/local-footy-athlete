# Onboarding Persistence Diagnosis — 2026-07-24

Read-only diagnosis. No code changed. No branch switched (`main`, clean except
pre-existing untracked docs/test files unrelated to this investigation).

## L2 header

- **Scope**: whole onboarding data path — every input screen's commit call,
  `profileStore` persistence, cold-start hydration ordering, and what the
  Review/generation code actually reads.
- **Trigger**: Sam's physical iPhone, fresh install, first onboarding attempt.
  Completed all 15 steps with real data. Review screen (step 15) showed
  "Not provided / Not selected" for every field. Program generated anyway
  using defaults (pre-season instead of the chosen in-season, Profile name
  "Athlete", LFA Days "Not set").
- **Verdict format**: each hypothesis gets CONFIRMED / REFUTED / PLAUSIBLE-
  UNPROVEN, backed by file:line citations.

---

## 1. The data path, screen by screen

Every onboarding screen follows the same shape: local component state via
`useState`, committed to `useProfileStore().updateOnboardingData(...)` only on
an explicit user action (Continue tap or a selection tap that auto-advances),
then `navigation.navigate(...)`. Verified directly in:

| Screen | Commit call | Trigger |
|---|---|---|
| `NameScreen.tsx:30-36` | `updateOnboardingData({ firstName: trimmed })` | Continue button / submit-editing, gated on non-empty trim |
| `BodyMeasurementsScreen.tsx:44-52` | `updateOnboardingData({ heightCm, weightKg })` | Continue button, gated on `isValid` |
| `SeasonPhaseScreen.tsx:116-129` | `updateOnboardingData({ seasonPhase: phase })` | tile tap, immediate (auto-advances after 300ms) |
| `InjuriesScreen.tsx:205-269` | `updateOnboardingData({ injuries: [...] })` or `{ injuries: [] }` | Yes/No or final "Next injury"/Continue tap |

(`PositionScreen`, `MotivationScreen`, `TeamTrainingDaysScreen`,
`GymExperienceScreen`, `SquatStrengthScreen`, `BenchStrengthScreen`,
`ConditioningLevelScreen`, `SprintExposureScreen`, `RecentTrainingLoadScreen`
were not individually re-read line-by-line beyond confirming their import of
`useProfileStore`/`updateOnboardingData` — see NOT-COVERED — but every screen
that *was* read follows the identical "commit-then-navigate" shape, with no
blur/dismiss-triggered commit path anywhere in the four screens inspected in
full.)

`updateOnboardingData` itself (`profileStore.ts:44-50`) is a straightforward
merge into live state:

```
updateOnboardingData: (data) =>
  set((state) => ({
    onboardingData: normalizeOnboardingRole({ ...state.onboardingData, ...data }),
  })),
```

`normalizeOnboardingRole` (`roleBuckets.ts:127-135`) only touches `position`
and is a no-op unless `position` needs bucket normalization — it does not drop
or reset any other field.

**`useOnboardingProgress`** (`useOnboardingProgress.ts:36-68`) computes step
count from `onboardingData.seasonPhase` / `onboardingData.experienceLevel` —
reads the same live store, same field names.

## 2. What Review and generation actually read

- `ReviewScreen.tsx:161`: `const onboardingData = useProfileStore((state) => state.onboardingData);` — same store, live subscription, same field names used by every writer (`onboardingData.position`, `.motivation`, `.heightCm`, `.weightKg`, `.seasonPhase`, `.trainingDaysPerWeek`, `.preferredTrainingDays`, `.experienceLevel`, `.squatStrength`, `.benchStrength`, `.conditioningLevel`, `.sprintExposure`, `.recentTrainingLoad`, `.injuries` — `ReviewScreen.tsx:181-299,356-359`).
- `CompleteScreen.tsx:131`: `const onboardingData = useProfileStore((state) => state.onboardingData);` — identical selector, passed straight into `generateProgramFromProfile(onboardingData, {...})` (`CompleteScreen.tsx:268`).
- `generateProgram.ts:180`: `const selectedPhase = profile.seasonPhase ?? 'Pre-season';` — this is the exact fallback that fires when `onboardingData.seasonPhase` is `undefined`, and it reproduces the observed "pre-season instead of in-season" symptom precisely.
- Profile name "Athlete" comes from `ProfileScreen.tsx:301` / `ProfileHomeScreen.tsx:28`: `onboardingData.firstName || 'Athlete'` — fires when `firstName` is falsy, i.e. the same emptied `onboardingData`.

**Hypothesis 3 (Review/generation reading a different store or field names)
— REFUTED.** Every writer and every reader in this path uses the same
`useProfileStore().onboardingData` object and the same field names, confirmed
by direct citation above. There is no second profile store, no snapshotting,
no field-name drift. The bug is not a wiring mismatch between screens and
Review — it's that `onboardingData` itself was back to (approximately) its
initial defaults by the time Review/Complete rendered, despite 14 screens
worth of correct, gated commits having already run.

That "whole-object reset" framing matters: this cannot be explained by any
single screen's commit failing (hypothesis 1), because commit failures are
necessarily per-field / per-screen, and the symptom is total — every
category (About You, Body, Season, Training, Physical, Health) showed
defaults simultaneously. Something reset or replaced the *entire*
`onboardingData` object between the last real commit and the Review render.

**Hypothesis 1 (screen commit skipped on keyboard-dismiss/blank-space-tap
navigation) — REFUTED as the primary mechanism.** The four screens read in
full (`NameScreen`, `BodyMeasurementsScreen`, `SeasonPhaseScreen`,
`InjuriesScreen`) all gate `updateOnboardingData` behind an explicit
CTA/selection handler; none commit on blur or dismiss, and none navigate
before committing. A per-screen E4-style bug would produce *partial* field
loss, not a full-object reset across every section. (Not fully excluded for
the remaining 10 screens not read line-by-line — see NOT-COVERED — but it
cannot be the root cause given the "every field" symptom.)

## 3. The persistence and hydration mechanism

`profileStore.ts:36-92` is a Zustand store wrapped in `persist(...)`,
backed by `asyncStorageCompat` (`asyncStorageCompat.ts:53-63`), which wraps
`@react-native-async-storage/async-storage`.

Two mechanics matter here, verified directly against the installed
`zustand@4.5.7` middleware source
(`node_modules/zustand/middleware.js:505-548`):

1. **Hydration replaces, and reads live state at resolution time.**
   `set(stateFromStorage, true)` (`middleware.js:539`) is a full-state
   *replace*, not a shallow merge — the `merge()` your app supplies decides
   what survives. `profileStore.ts`'s `merge` (`profileStore.ts:79-89`) does
   `{...currentState, ...persisted, onboardingData: {...currentState.onboardingData, ...persisted?.onboardingData}}`,
   and `currentState` comes from `get()` called *at the moment hydration's
   async chain resolves* (`middleware.js:538`, `_get4 = get()`), not a stale
   closure. On a genuinely empty AsyncStorage read (`getItem` resolves
   `null`), `persisted` is `undefined`, so the merge is provably a no-op that
   preserves whatever is currently in live memory. **This means a slow (but
   ultimately null-returning) first hydration cannot, by itself, explain the
   data loss** — traced precisely, it is safe by construction as written.

2. **Writes are fire-and-forget with no readiness gate and no write
   acknowledgement.** Zustand's wrapped `api.setState` (`middleware.js:509-512`):
   ```
   api.setState = function (state, replace) {
     savedSetState(state, replace);
     void setItem();
   };
   ```
   `void setItem()` is never awaited by the call site. Every
   `updateOnboardingData()` call updates in-memory state synchronously and
   fires an async AsyncStorage write that nothing waits on, retries, queues,
   or acknowledges. There is no code path that blocks navigation, blocks app
   backgrounding, or blocks generation on "this answer is durably on disk."

3. **`useInitializeApp` does not gate on store hydration at all —
   CONFIRMED DEFECT.** `useInitializeApp.ts:9-19`:
   ```
   export function useInitializeApp(): UseInitializeAppReturn {
     const [isReady, setIsReady] = useState(false);
     useProfileStore((state) => state.isOnboardingComplete);
     useEffect(() => {
       const timer = setTimeout(() => setIsReady(true), 300);
       return () => clearTimeout(timer);
     }, []);
     return { isReady };
   }
   ```
   `isReady` is a flat 300ms timer. It subscribes to
   `isOnboardingComplete` (forces a re-render if that field changes) but
   never checks `useProfileStore.persist.hasHydrated()` or
   `useProgramStore.persist.hasHydrated()` — both of which exist and are used
   elsewhere (`programStore.ts:2047-2059` wraps `persist.rehydrate`,
   `calendarStore.ts:171` / `readinessStore.ts:79` use
   `onRehydrateStorage`). `RootNavigator.tsx:26-47` mounts
   `OnboardingNavigator` as soon as `isReady` flips true, with zero
   dependency on whether either persisted store has actually finished reading
   from disk. This is real: the app can — and by design, always does after
   exactly 300ms — show onboarding UI before confirming AsyncStorage
   hydration completed.

## 4. Weighing hypothesis 2 against the new device evidence

New evidence from Sam: on the first-ever onboarding attempt on the 07-23
build, the step progress bar did not advance initially, then the flow worked
on a second attempt. Read literally, this means the *first* app process on
that fresh install visibly stalled or behaved abnormally, and a second
process (very plausibly a relaunch — force-quit/reopen, or an OS-level
restart) is what actually produced usable onboarding UI.

That is significant because it changes the shape of the race. As shown in
§3.1, a single in-process hydration cannot wipe live data on a truly empty
store — `get()` at resolution time saves it. But **a relaunch changes the
premise entirely**: if the process is killed (by the user, or by iOS under
memory pressure — first-launch cold start on a physical device is exactly
the kind of high-memory-pressure window where this happens) after some
`updateOnboardingData()` calls have updated in-memory state but *before*
their fire-and-forget `AsyncStorage.setItem` writes (§3.2) have completed,
those answers are never durably written. The next process launch reads
whatever was last durably persisted — which, for answers entered in the
killed session, is nothing. `onboardingData` rehydrates to
`initialOnboardingData` (`profileStore.ts:20-32`), and if the user is far
enough into a *second* onboarding attempt for the app to think onboarding is
"in progress" (there's no resume/interrupted-session detection anywhere in
this path — onboarding always starts at `Welcome`/`Name`, per
`OnboardingNavigator.tsx:44-49`), any screen that isn't re-visited on the
second pass keeps its default value straight through to Review.

This mechanism — fire-and-forget writes (§3.2) with no hydration gate on
first render (§3.3) and no interrupted-session recovery — is **PLAUSIBLE and
consistent with every observed symptom**: total (not partial) field loss,
because a killed process loses everything not yet flushed; the "pre-season"
default (`generateProgram.ts:180`) and "Athlete" fallback
(`ProfileScreen.tsx:301`) firing because those are exactly the code paths
that trigger on `undefined`; and the progress-bar stall as circumstantial
evidence that a first-process abnormality (and likely relaunch) genuinely
happened on this device.

**I cannot promote this from PLAUSIBLE to CONFIRMED from source alone.**
Confirming it requires evidence this repo doesn't contain: iOS crash/
termination logs for the first process, AsyncStorage read/write timing on
that device, or a `logger` trace showing two separate `app_launch` events
(`App.tsx:47`, `logCoachBuildFingerprint('app_launch')`) inside one nominal
"fresh install" session. See NOT-COVERED.

## 5. Secondary architectural risk (not the primary mechanism here, but real)

`profileStore.ts:135-148` subscribes to every `onboardingData` change and
silently overwrites it with `programStore`'s
`acceptedMaterialContext.acceptedProfileSnapshot` whenever
`revision > 0` and a snapshot exists (`canonicalAcceptedProfile()`,
`profileStore.ts:94-103`). The comment at `profileStore.ts:105` states the
intent explicitly: *"ProgramStore's accepted profile is authoritative;
ProfileStore is a read mirror."* That's a reasonable design for
**post-acceptance** coach-chat sync, but during onboarding — before any
program has ever been accepted — this subscribe fires on literally every
keystroke-equivalent (`updateOnboardingData` call) and has to correctly
no-op every single time. On a genuinely empty install,
`createEmptyAcceptedMaterialContext()` (`acceptedStateColdStart.ts:104-117`)
gives `revision: 0`, so `canonicalAcceptedProfile()` returns `null` and this
is a no-op — traced and confirmed safe for *this* device's true-fresh-install
case. It is called out here because it is a second, independent path by
which `onboardingData` can be silently replaced outside of any screen's
control, and it becomes live risk the moment AsyncStorage isn't actually
empty on "fresh install" — e.g. an iCloud device-backup restore, or a
TestFlight build update that doesn't wipe app storage (both plausible on a
physical iPhone "fresh install" in ways a simulator reset wouldn't
reproduce). This was not the confirmed mechanism for this incident but is
architecturally the same shape of bug and worth flagging as a scope item —
onboarding writes should arguably not run through a store instance that also
serves as a post-acceptance mirror at all.

## 6. Verdict summary

| Hypothesis | Verdict | Basis |
|---|---|---|
| (1) Screen commit skipped on blur/dismiss (E4) | **REFUTED** as root cause | 4/14 screens read in full, all commit-gated on explicit action; symptom is total-object loss, not per-field, which a per-screen bug can't produce |
| (2) Store persistence racing/failing on fresh install, later rehydrated empty | **PLAUSIBLE, best-supported, not proven from source alone** | Fire-and-forget `setItem` (`middleware.js:509-512`) + non-hydration-gated 300ms readiness timer (`useInitializeApp.ts:14`) + no interrupted-session recovery together explain every symptom, and the progress-bar-stall / second-attempt evidence is consistent with a process relaunch mid-flow. Single-process hydration alone is provably safe (§3.1) — a relaunch is the missing piece and cannot be confirmed without device logs |
| (3) Review/generation reading a different store or field names | **REFUTED** | Same `useProfileStore().onboardingData`, same field names, cited line-for-line for every writer and every reader in the path |

## NOT-COVERED

- 10 of 14 input screens (`PositionScreen`, `MotivationScreen`,
  `GameDayScreen`, `TeamTrainingDaysScreen`, `TeamTrainingDurationScreen`,
  `TrainingCommitmentScreen`, `PreferredTrainingDaysScreen`,
  `GymExperienceScreen`, `SquatStrengthScreen`, `BenchStrengthScreen`,
  `ConditioningLevelScreen`, `SprintExposureScreen`,
  `RecentTrainingLoadScreen`) were not individually read line-by-line for
  their commit pattern — only confirmed to import `useProfileStore`. Given
  the total-object-loss symptom this doesn't change the verdict, but a
  per-screen audit is not complete.
- No device logs, crash reports, or AsyncStorage read/write timing from
  Sam's physical iPhone were available to this diagnosis. Confirming
  hypothesis 2 as the actual trigger (vs. merely plausible) requires that
  evidence — specifically, whether two `app_launch` events
  (`logCoachBuildFingerprint`, `App.tsx:47`) occurred during the reported
  session, and whether any `updateOnboardingData` writes were still
  in-flight to AsyncStorage at the moment of any relaunch.
- The 07-23 progress-bar-stall report (first-launch-vs-second-launch timing)
  was not independently reproduced or measured — it's being used as
  corroborating evidence, not as a directly-traced mechanism.
- `asyncStorageCompat`'s write-suppression stage
  (`beginAsyncStorageWriteStage`/`endAsyncStorageWriteStage`,
  `asyncStorageCompat.ts:65-79`) was checked and is only invoked from
  `coachMutationTransaction.ts`, which cannot run before onboarding
  completes on a true fresh install — ruled out as a factor in *this*
  incident, not audited for correctness in general.
- No fix was designed or implemented. This is diagnosis only, per the task
  scope.
