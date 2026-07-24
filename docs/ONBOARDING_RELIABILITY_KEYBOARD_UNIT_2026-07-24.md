# Onboarding Reliability + Keyboard Unit — 2026-07-24

Branch: `feat/onboarding-reliability-keyboard` (off `main`). Tests-first
throughout. **Gates green, awaiting Sam device acceptance.**

## L2 header

- **Scope**: the whole onboarding data path (every step's commit, persistence,
  cold-start hydration ordering, interrupted-flow recovery, and what Review and
  generation are allowed to do with a gap), plus one keyboard convention applied
  to **every** input surface in the app — not only onboarding.
- **Trigger**: `docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md` (Sam's
  physical iPhone, fresh install: 15 steps answered, Review showed "Not provided"
  for every field, program generated as pre-season with the profile name
  "Athlete"), plus dogfood findings E3/E4/E7.
- **Verdict format**: every claim below is backed by a named test or a stated
  measurement. Anything unverified is in NOT-COVERED.

---

## The headline: the diagnosis was wrong about the cause, and this unit found it

The diagnosis ranked hypothesis 2 (a relaunch landing between the in-memory
write and its fire-and-forget disk write) as PLAUSIBLE-but-unproven, and
recorded the profile mirror in §5 as a *risk* that was "traced and confirmed
safe for this device's true-fresh-install case".

Building the hydration gate disproved that. On a **truly empty disk**, with
`__DEV__` off and every store fully hydrated:

```
disk keys at boot: []
post-hydration revision = 1 | snapshot present = true
snapshot profile = {"trainingLocation":"Commercial gym","equipment":[...]}   ← empty

after Name:        {"trainingLocation":"Commercial gym","equipment":[...]}   ← firstName gone
after Body:        {...}                                                    ← height/weight gone
after SeasonPhase: {...}                                                    ← seasonPhase gone
```

`programStore`'s `onRehydrateStorage` committed an accepted-state transaction on
every cold start, taking the store to revision 1 with an `acceptedProfileSnapshot`
of the empty profile. `profileStore`'s subscribe fence then reverted every
onboarding answer **synchronously, in memory**, before persistence was even
attempted. No relaunch, no crash, no memory pressure — deterministic.

That explains every reported symptom, including the two the diagnosis could not:
total (not partial) loss across all six Review sections, and the progress bar not
advancing (it derives its step count from `seasonPhase`/`experienceLevel`, both
of which the mirror kept reverting).

**It also means the hydration gate could not ship alone.** The gate removes the
timing race that previously let athletes sometimes win, so shipping it without
this fix would have made an intermittent bug a permanent one.

Per the CLAUDE.md / AGENTS.md escalation rule ("a later layer changes, blocks,
downgrades, or reinterprets that intent"), implementation stopped and the
seven-question reassessment was written before any code touched the mirror:
`docs/PROFILE_MIRROR_OWNERSHIP_REASSESSMENT_2026-07-24.md`. Sam approved
**option 3 — both A and B, sequenced, tests-first**, with a STOP-on-B fallback.
B did not exceed its blast radius, so the fallback was not needed.

---

## What shipped

### 0. Mirror ownership (Sam-approved, tests-first)

- **Load-bearing repro first** — `onboardingReliabilityTests` case `0`: fresh
  empty disk → hydration completes → all 17 steps answered → every answer
  survives, is durably persisted, Review finds nothing missing, and generation
  receives the athlete's own phase. RED before the fix.
- **(A)** `profileStore.ts` — the subscribe fence is inert while
  `isOnboardingComplete` is false. The mirror mirrors *accepted* state, which
  cannot exist before an acceptance. A alone turned case `0` green, as required.
- **(B)** `programStore.ts` — hydration skips the acceptance commit when there is
  no `currentProgram` **and** `revision === 0`. Pinned by case `0b`. The guard is
  narrow by construction: it can only affect a device that never had a program,
  so no existing athlete's accepted state can change.
- Residual (retiring the mirror rather than scoping it) logged **with its
  trigger** in the §18 retirement ledger — item 6 of the brief.

### 1. Step commits are awaited and flushed before navigation

- `asyncStorageCompat.ts` now tracks in-flight durable writes and exposes
  `flushPendingStorageWrites()`. This makes zustand's `void setItem()` queue
  *observable* without duplicating its serialisation, and surfaces write
  rejections that were previously swallowed.
- `onboardingStepCommit.ts` — `commitOnboardingStep(patch)` updates live state,
  then resolves only once the answer is on disk. A failed write throws.
- `useOnboardingStepCommit.ts` — the screens' single door: owns the awaited
  shape, the in-flight state, and the failure copy, so no screen has to remember
  any of it. `OnboardingLayout` shows "Saving…", disables Continue, and surfaces
  the error.
- **All 19 committing screens swept.** `TrainingCommitmentScreen` also changed
  shape: it used to commit on tap but navigate from Continue, so its answer was
  never tied to the advance; it now commits once, on Continue, like every other
  step.
- Pinned by cases `A1–A3`, `B1–B2`, and `C4` (no screen may call
  `updateOnboardingData` or leave a commit unawaited).

### 2. Boot gated on hydration, not a timer

- `appHydrationGate.ts` — a registry of **all 12** persisted stores, with
  `hydrating` / `ready` / `failed`. `useInitializeApp`'s 300ms timer is gone.
- The gate polls each store's own `hasHydrated()` rather than trusting
  `onFinishHydration`, because `programStore` wraps that flag to mean "raw
  hydration AND acceptance" and the acceptance lands later. Trusting the listener
  released boot early — caught by case `D2` during development.
- On failure, `RootNavigator` shows an honest, retryable boot error instead of
  quietly entering onboarding on storage that is not working.
- Case `D1` fails the build if a new persisted store is added without registering
  it.

### 3. Interrupted-onboarding recovery

- `onboardingSteps.ts` is now **the** step registry — order, visibility,
  what each step collects, and whether it has been answered. It replaced
  `useOnboardingProgress`'s private copy, and `generateProgram`'s required-field
  list is derived from it, so the flow and the generator cannot disagree.
- `resolveOnboardingResumeStep` + `OnboardingNavigator`'s `initialRouteName`
  resume an interrupted flow at the first unanswered step. A profile with nothing
  answered still gets Welcome.
- Headless relaunch repro: case `C1` characterises the *original* loss (legacy
  fire-and-forget commit + process kill = answers gone) so it can never regress
  silently; `C2`/`C3` prove the awaited commit survives the same kill and resumes
  correctly.

### 4. Refusal instead of silent defaults

- `onboardingCompleteness.ts` — one owner, plain-language copy naming the missing
  answers.
- `generateProgram.ts` — `seasonPhase ?? 'Pre-season'` is gone;
  `generationSeasonPhaseOrThrow` refuses with a `missing_required_profile`
  `ProgramGenError`.
- Review's CTA becomes "Add \<missing answer\>" with the reason above it, and
  navigates to the owning step. Complete refuses before generating (it is
  reachable by back-stack jump) and offers "Finish that step".

### 5. ONE keyboard convention (E3/E4/E7 as a class)

Built on `react-native-keyboard-controller`, which was **already a dependency
with `KeyboardProvider` mounted in App.tsx** and already used by `CoachScreen`.
It tracks the keyboard frame natively on both platforms, which RN's own
`KeyboardAvoidingView` cannot do reliably on Android.

- `KeyboardSafeArea` — avoidance, scroll-into-view (`bottomOffset` clears the
  keypad *and* the Done bar), `keyboardShouldPersistTaps="handled"`, tap-to-
  dismiss, and it renders the Done bar exactly once.
- `KeyboardDoneAccessory` — a `KeyboardToolbar`, which attaches itself to the
  focused input on both platforms, so no input needs per-call wiring and none can
  be forgotten (this is what differed between the name and height/weight screens).
- `AppTextInput` — the app's only text input; owns the submit defaults that were
  previously copied inconsistently per screen.
- `OnboardingLayout`'s opt-in `keyboardAvoiding` prop is **deleted**. E3 happened
  precisely because Name and BodyMeasurements never opted in; there is no opt-in
  to forget any more, and the Continue footer now sits *inside* the avoided region.
- **Swept every input surface, not just onboarding**: 15 files off raw
  `TextInput`, and the 5 remaining per-screen `KeyboardAvoidingView`s (3 auth
  screens, ChatScreen, AddExerciseModal) onto the convention.
- `keyboardConventionContractTests` scans **every `.tsx` under src** and fails the
  build if a raw `TextInput`, a per-screen `KeyboardAvoidingView`/
  `KeyboardAwareScrollView`, or a second dismiss affordance reappears anywhere.

---

## Gates

| Gate | Result |
|---|---|
| `test:onboarding-reliability` (new, 23 cases) | **23/23** |
| `test:keyboard-convention` (new, 26 contracts) | **26/26** |
| `test:bible` (now includes both new suites) | **exit 0** |
| `test:onboarding-cold-start` | exit 0 |
| `test:program-hydration-ownership` | exit 0 |
| `test:dev-e2e-reset-hydration`, `-seeds`, `-entry` | exit 0 |
| `test:dev-onboarding-skip`, `test:welcome-dev-skip-contract` | exit 0 |
| `test:profile-reset-ui`, `test:reset-coach` | exit 0 |
| `test:accessibility-contracts` | exit 0 |
| `npm run typecheck` | exit 0 |
| Full-`src` typecheck vs `main` baseline | **0 new errors** (326 pre-existing both sides) |

### Pre-existing failures — do not attribute these to this unit

- **`test:dev-e2e-default-installation`** fails with
  `ExplorerCampaignBootstrapError: campaign-missing`. Verified by stashing this
  branch and re-running on `main`: **fails identically there**.
- **`npm run lint` cannot run at all** — ESLint 8.57.1 finds no configuration
  file anywhere in the tree. Pre-existing; not introduced here, and not fixed
  here (out of scope, and picking a config is a project decision).

---

## Two gate gaps found while verifying (worth Sam's attention)

1. **`npm run typecheck` does not check `src/`.** `tsconfig.json` sets
   `"files": ["App.tsx"]`, and App.tsx does not import the navigator tree at the
   top level, so the entire `src/` tree is outside the program. Demonstrated by
   appending `const x: number = "not a number";` to `NameScreen.tsx` — `tsc`
   still exits 0. Every type claim in this report therefore comes from a
   **separate full-`src` typecheck diffed against `main`**, not from
   `npm run typecheck`. Worth fixing, but changing the project's tsconfig is not
   this unit's call — the 326-error baseline would need triage first.
2. **`SessionDurationScreen` is unreachable.** It is registered in the navigator
   and rendered in Review, but nothing has ever navigated to it (the flow runs
   PreferredTrainingDays → GymExperience), so `sessionDurationMinutes` has never
   been collected in onboarding — since the initial commit. It was listed as
   *required* for generation, which meant a completeness gate keyed on the old
   list would have refused **every genuine onboarding**.

   **Already ruled: KILLED** — `PROGRAMMING_DESIGN_SESSION_2026-07-23.md` §D6b
   (Sam, 2026-07-23): the orphaned gym-session-duration question is *removed,
   not wired in*. `SessionDurationScreen` and the `sessionDurationMinutes` field
   are to be deleted from onboarding data **and both sides of the generation
   contract** (client + edge function stop expecting it; it currently ships
   blank). Team-training duration — the wired question — is untouched. That
   deletion rides the **Phase 1.6 dead-affordance/orphan sweep**, tests-first,
   pairing with the G6 fix.

   Demoting the field required→recommended here is the correct **interim**
   state: it unblocks the completeness gate without pre-empting the Phase 1.6
   deletion. This unit does not delete the screen.

---

## Device pass owed (L3)

Per L3 this must be a **real fresh install — delete the app, reboot the phone,
reinstall** — not a simulator reset and not a TestFlight update over an existing
install. That is the only state that reproduces the original bug, and it is the
state both mirror fixes target.

What to check:
1. Onboard end-to-end. Every answer must appear correctly on Review, and the
   generated program must be **in-season** if in-season was chosen.
2. Force-quit mid-flow and reopen: it should resume at the step you were on,
   with earlier answers intact.
3. Name and height/weight screens: Continue must be visible and tappable with the
   keyboard up (E3), the numeric keypad must offer Done (E4), and the weight
   field must stay visible while typing (E7).
4. The same keyboard behaviour on the auth screens, coach chat, day-workout
   notes, session feedback and Add Exercise — these were swept too and none has
   been seen on a device.

---

## NOT-COVERED

- **No device run of any kind.** Nothing here has been on hardware or a
  simulator. Every claim is headless. Per L10 this is not a PASS.
- **The keyboard convention is verified only by source contract.** The repo ships
  no native renderer, so nothing proves the Done bar renders, that
  `bottomOffset: 64` is the right clearance on every device size, or that
  `KeyboardAvoidingView` from `react-native-keyboard-controller` behaves in the
  Modal that `AddExerciseModal` lives in. E3/E4/E7 are *addressed*, not
  *confirmed fixed*.
- **The chat and modal surfaces changed shape.** `ChatScreen` and
  `AddExerciseModal` moved from a bespoke `KeyboardAvoidingView` with tuned
  `keyboardVerticalOffset` to the shared convention. Their previous offsets were
  hand-fitted; the new behaviour is untested on a device and is the most likely
  place for a visual regression.
- **`profileStore`/`ProfileHomeScreen`'s `firstName || 'Athlete'` fallbacks are
  still there.** The brief called them "generation-time" fallbacks; they are not —
  there is no `firstName` fallback at generation time, only these two display
  sites. With generation now refusing on a missing `firstName` they are
  unreachable by construction, so they were left alone rather than converted into
  a display-time refusal that has nowhere to redirect to. Flagging rather than
  silently reinterpreting the brief.
- **The other two `publishAcceptedProfileCompatibilityMirror` call sites**
  (`acceptedStateTransaction.ts:689`, `programStore.ts:1880`) were read but not
  audited for the same fresh-install assumption.
- **iCloud-restore / TestFlight-update shapes** (storage non-empty on a nominal
  "fresh install") are protected by fix A but were not reproduced or exercised.
- **The `HYDRATION_TIMEOUT_MS = 10_000` boot ceiling is unmeasured.** It is a
  guess at "a storage layer that will never answer". On a slow device with a
  large program store, real hydration time is unknown — if it ever exceeded 10s
  the athlete would see the boot error screen instead of their program. Worth a
  measurement on Sam's device during the pass.
- **`test:bible` now runs both new suites**, which lengthens the gate. Not
  benchmarked.
