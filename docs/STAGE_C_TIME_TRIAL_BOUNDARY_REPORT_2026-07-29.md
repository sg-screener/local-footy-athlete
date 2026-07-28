# Stage C — 2km time trial + MAS: boundary report

**Date:** 2026-07-29
**Branch:** `feat/stage-c-time-trial-mas`
**Gates:** `npm run test:bible` **EXIT=0** (includes `test:compile`, which PASSED
against baseline — product errors 37, unchanged). New suite `test:time-trial`
98/98, registered in the bible chain.

---

## 1. SHIPPED

| Thing | Where |
|---|---|
| Single owner: range, MAS multiplier, four skip defaults, derivation, ingress | `src/data/twoKmTimeTrial.ts` |
| Bound mechanism, split so the layering stays acyclic | `src/data/numericBound.ts` |
| The range, listed in the one bounds registry | `src/data/onboardingNumericBounds.ts` |
| Stored answer type (`seconds: number \| null`) | `src/types/domain.ts` |
| Onboarding screen | `src/screens/onboarding/TwoKmTimeTrialScreen.tsx` |
| Step registration + both entry routes | `onboardingSteps.ts`, `OnboardingNavigator`, `BenchStrengthScreen`, `GymExperienceScreen` |
| Change-it-later | `ProfileScreen` player-details sheet, step `playerTimeTrial` |
| Duplicate derivation retired | `src/utils/masCopy.ts` |
| Sam's seven rulings, verbatim + anchored | `docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md` |

Store the time, derive MAS, never store MAS. `deriveMas` returns
`{ masKmh, source: 'measured' | 'experience_default', seconds }` so a consumer
can say "your MAS" or "our estimate" honestly. Defaults are applied at
derivation and never written into storage, so a later experience-level change
moves the estimate.

## 2. WHAT THE ATHLETE SEES — for the device pass

### Onboarding, new screen between Bench Strength and Conditioning

- **Title:** "What's your recent 2km time?"
- **Subtitle:** "Sets your running paces. Skip it and we'll estimate."
- **Two keypad boxes**, side by side: `Minutes` (placeholder 7, timer icon) and
  `Seconds` (placeholder 15). Same shell, focus ring and keyboard behaviour as
  the height/weight screen.
- **A blank seconds box means `:00`.** A blank minutes box is not a time and is
  refused.
- **Refusal, inline under the boxes, red:** "That time looks off. Enter a time
  between 5:00 and 15:00." Continue stays disabled while it shows. No suggested
  value is ever offered.
- **Below that, a full-width tile: "I haven't tested it"** — wording is an
  answer, not an escape. Tapping it records `seconds: null` and advances.
- **Continue** in the standard footer.

**Reachable by two routes.** Bench Strength → here for most athletes; Gym
Experience → here for complete beginners, who skip squat and bench entirely.
Worth checking both on device — wiring only the first would have sent every
beginner straight past the screen their default pace is chosen for.

### Change it later — Profile → Update setup → Edit player details

Name → Position → Experience → **2km time** → saves. Same two boxes, same
refusal sentence, same ingress. Offers **"I haven't tested it"** as well, so an
athlete who mistyped a time months ago can clear it rather than being stuck
with it.

**Note:** this is the first numeric onboarding answer revisable without
re-onboarding. Bodyweight and height still have no post-onboarding door.

## 3. STOPPED — the time-trial SESSION needs authored data (§5)

The session half of Stage C is **not shipped**, and I did not fabricate it. Both
routes to a renderable 2km time-trial session run through data you have signed:

1. **The exercise vocabulary is locked and build-failing.** A renderable session
   needs an exercise row, and `hardcodedExerciseNameLockTests` fails the build on
   any `name:` literal in an exercise-identity position that is not in the locked
   vocabulary or carrying a typed exemption. `EXERCISE_MASTER_SHEET_2026-07-28.xlsx`
   has `Long Run`, `Tempo Run`, `Long Nasal Run`, `Flush Run` — and **no
   time-trial entry**. Adding one means authoring a name, a cue, muscle metadata
   and possibly a demo video on your sheet.

2. **The conditioning templates sheet is signed at 55 rows**, held in lockstep
   with the xlsx in both directions, and its own residue section says the three
   framework sessions with no row are *"listed, not invented"*. A 56th row for
   the time trial would be me inventing on your document.

Everything else about the session needs **no** new authoring: a
`hard_conditioning` unit with `running` modality already counts as a running
exposure in `countWeeklyExposures` with no change to the cap owner, so the 4-run
cap, team-training-day and off-feet gates all apply the moment the session
exists.

**What I need from you:** a name for the exercise row (`2km Time Trial`?), its
cue, and whether it earns a row in the conditioning sheet or sits outside the 55
as a *test* rather than a dose. My read is the latter — its dose is fully
specified by D14 (run 2km, time it) and nothing about it is a conditioning
prescription to be authored — but that is your call, not mine.

## 4. STAGE B REQUIREMENTS — recorded, as ruled

1. **The 1–3 times pre-season frequency policy.** A frequency rule the weekly
   assembler owns.
2. **The D15 time-trial-day exercise-selection filter.** Your ruling: *filter
   exercise selection on a time-trial day, not a pairing ban.* A design decision
   from the D15 weekly-assembler session, not existing code.
3. **Rendering per-athlete paces into the fifteen `%MAS` template rows.** MAS is
   a real number now; turning `'90–100% MAS'` into "run 340 m" is the consumer.
4. **Day-one question: range vs binary `%MAS`.** The fifteen rows carry RANGES
   (`'90–100% MAS'`, `'65–80% MAS'`); `masIntensityForWorkSeconds` carries a
   BINARY (≤30 s → 110%, >30 s → 100%). For `Classic 4×4` they disagree — the
   row says 90–100%, the function says exactly 100. Nothing breaks while both
   are only rendered as text. The moment MAS is a real number they are two
   representations of one intensity. The rows' authored ranges presumably win
   over the unauthored binary — **Stage B must seek that ruling, not assume it.**
   Recorded in `masCopy.ts` where a reader will hit it.
5. **`MAS_FALLBACK_NOTE` is now partly untrue.** Every `%MAS` session still
   renders "Don't know MAS? Send your 2km or 3km time trial." to an athlete who
   has just entered their 2km time. Athlete-facing copy, so I did not change it
   without a ruling — but it is wrong for anyone who answered the new screen.

## 5. NOT COVERED

- **No device pass.** Simulator not run. Everything above about what the athlete
  sees is read from the code I wrote, which is an argument, not evidence.
- **The time-trial session** — see §3. Not built, not stubbed.
- **Coach chat as a producer.** `recordTwoKmTime` accepts `source:
  'profile_edit'` from coach chat and the bound applies, but no coach intent
  parses "my 2km is 7:20" yet. The ingress is ready; the door is not cut.
- **The retired distance calculator is not replaced.** `masDistancePerRep` and
  its invented ±3m/±5m tolerance bands are deleted, not reauthored. Stage B owns
  rendering paces, and those tolerances were never ruled.
- **`deriveMas` has no consumers yet.** By design — Stage C is the input, Stage B
  is the engine — but it means the derivation is proven by tests, not by a
  rendered card an athlete has seen.
- **No migration for existing profiles.** An athlete mid-onboarding on the old
  build resumes onto the new step, which is correct. An athlete who already
  finished onboarding has no `twoKmTimeTrial` and will derive from their
  experience default until they visit the profile editor. That is the intended
  behaviour, but nothing prompts them.
- **Height/bodyweight still have no change-it-later door.** Noticed while
  building this one; out of scope, not fixed.

## 6. PROCESS NOTES

- **The bounds registry's generic provenance loop picked up the new bound for
  free.** `onboardingNumericBoundsTests` iterates every entry and asserts the
  anchor states the shipped floor and ceiling — so the 2km range was gated the
  moment it was listed, without a line of new test code. It also forced the
  anchor sentence to state `300–900 seconds` and not only `5:00–15:00`, because
  the shipped numbers are seconds.
- **A gate that reads code is coupled to the code's shape — twice, in one
  sitting.** My "no MAS field" assertion used an unbounded lazy `[\s\S]*?` and
  matched the legitimate `masKmh` on `DerivedMas` further down the file. Then
  the masCopy assertions failed on masCopy's own documentation, because a
  well-written module quotes what it retired — the exact trap
  `support/sourceText` was written for. Both fixed by scoping: bound the regex
  to the interface body, and strip comments before scanning.
- **Six mutations, six kills.** Multiplier 1.00→1.03, floor 300→240, two
  defaults transposed, default written into storage on skip, clamp instead of
  refuse, and `source` hardcoded to `'measured'`. The transposition mutant is
  the one that matters: every individual value assertion still passed, and only
  the "defaults get slower as experience drops" ladder assertion caught it.
- **Four failures in `onboardingReliabilityTests` were the gate working**, not
  collateral: a profile missing the 2km step is no longer complete. Fixtures
  updated rather than assertions relaxed.
