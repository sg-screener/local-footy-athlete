# Final QA Checklist — Release Candidate

Drafted 2026-07-23. This is the release-gate script referenced as v1
blocker #9 in `docs/V1_LAUNCH_DEFINITION.md` ("Final full QA pass — re-run
the screen audits + Maestro smoke on the release candidate; `test:bible`
green is a merge gate for every item above"). Run this in full against the
actual release-candidate build/commit — not against arbitrary `main` — once
every other v1 blocker is checked off.

Structured, checkable, no code. Follow `docs/QA_RUNBOOK.md`'s session rules
throughout (one area per session, tap-record-move-on, no diagnosis during
audit, group failures after).

---

## 0. Preconditions

- [ ] Release-candidate commit is tagged/identified and this checklist is
      run against that exact commit, not a moving branch tip.
- [ ] `docs/V1_LAUNCH_DEFINITION.md` blockers 1-8 are checked off (readiness
      fix, Group C, Group D, stack-primitive stage, anchor-day swap
      regression verified, `SUPPORTED_ATHLETE_ACTIONS.md` game-day contract
      text, ship logistics). This checklist is blocker #9 — the last one.
- [ ] `bash scripts/qa-start.sh` boots cleanly (simulator boots or is
      already running, `.env` present with `EXPO_PUBLIC_SUPABASE_URL`,
      Metro serving on the resolved port). Note: this script is currently
      untracked (`??` in `git status`) — confirm it's been committed before
      relying on it as a release-gate step for anyone other than the
      current checkout.
- [ ] Seed reset succeeds:
      `E2E_METRO_URL=http://127.0.0.1:8081 scripts/dev-e2e/run-maestro-ios.sh .maestro/common/reset-seed.yaml -e SEED_ID=standard-in-season-week`

---

## 1. Automated gate — `test:bible`

- [ ] `npm run test:bible` is green on the release candidate. This composite
      chains: `bibleConformance/runSlice1.ts`, `test:section18-planner`,
      `test:section18-v2`, `test:section18-safety`, `test:section18-gateway`,
      `test:whole-week-repair`, `test:accepted-state-transactions`,
      `test:athlete-session-deletion`, `test:athlete-session-move`,
      `test:athlete-move-occupied-content-loss`, `test:phase-clock`,
      `test:section18-ownership`, `test:readiness-ownership`,
      `test:illness-recovery-mode`.
- [ ] `npm run test:compile` (`tsc --noEmit`) is clean.
- [ ] If Group D lands per `docs/GROUPD_EXECUTION_PLAN_2026-07-23.md`, its
      new/extended test files pass:
      `envConfigTests.ts`, `profileResetUITests.ts`, `feedbackFormTests.ts`
      (new), `planChangeProducerTests.ts`, `coachActionsTests.ts`.

### Known pre-existing reds — confirm signature matches, do not re-diagnose

Per `docs/QA_RUNBOOK.md`'s "Known pre-existing reds" section:

- [ ] **`coachBehaviourScenarioTests`** (`npm run test:coach-behaviour-scenarios`)
      — expected to fail on the "fridays" scenarios only if run on a
      Saturday/Sunday (weekend date-rot, not fixed, not blocking). Confirm
      the run date; if run on a weekday, this suite should be fully green —
      if it isn't, that's a new regression, not the known issue.
- [ ] **`programControlActionsTests`**
      (`TZ=Australia/Melbourne npx sucrase-node src/__tests__/programControlActionsTests.ts`)
      — expected failure signature: scenarios `[1]`/`[2]`/`[3]` fail on
      missing recovery-mode Coach Notes/constraints; scenario `[5]` crashes
      with `TypeError: Cannot read properties of undefined (reading 'id')`
      at line 369. If the signature differs from this, treat it as a new
      regression, not the known baseline issue.

---

## 2. Maestro golden smoke suite

Run every flow in `.maestro/golden/` against the release-candidate build.

- [ ] `explorer-all-nine.yaml` — runs all 9 registered Explorer smoke
      scenarios (`smoke-whole-session-deletion`,
      `smoke-stacked-upper-pull-component-deletion`, `smoke-fixture-move`,
      `smoke-multi-reload-fixture-session-restoration-chain`,
      `smoke-injury-update-and-resolution`,
      `smoke-readiness-set-and-clear`,
      `smoke-equipment-clear-and-reapply`,
      `smoke-session-feedback-receipt`,
      `smoke-repeat-week-phase-transition-and-restore`). All 9 pass within
      their individual budgets.
- [ ] `fixture-move.yaml` — Sat fixture moves to Sun, state confirmed.
- [ ] `lower-body-deletion.yaml` — Monday session deletion confirmed,
      Monday becomes rest.
- [ ] `one-set-feedback.yaml` — full session-completion feedback flow
      (completion/support/recovery-addon/feeling-good/no-soreness) saves.
- [ ] `reload-standard-week.yaml` — checkpoint + reload preserves
      `program-screen` state and the Saturday fixture.
- [ ] `standard-program-week.yaml` — previous/current/next week markers and
      all 7 day rows visible.

### Reload/persistence trace suite (`.maestro/action-trace-v2/`)

- [ ] `component-deletion-reload.yaml` — exercise removal survives a
      checkpoint+reload.
- [ ] `fixture-mutation-reload.yaml` — fixture move survives a
      checkpoint+reload.
- [ ] `restoration-reload.yaml` — a restored (undone) fixture move survives
      a checkpoint+reload.

If any golden or reload-trace flow fails, stop and treat as a release
blocker — this suite exists specifically to be the automated proxy for "does
the release candidate actually work," per its own tag convention
(`e2e, golden`).

---

## 3. Screen-by-screen manual audit

Follow `docs/QA_RUNBOOK.md`'s audit order. One findings file per area:
`docs/audits/AREA_YYYY-MM-DD.md` (screen, action, expected, actual,
PASS/FAIL/BLOCKED, screenshot path for failures only). Use seed
`standard-in-season-week` unless a specific seed is called for.

- [ ] **1. Program** — full week view, day rows, phase badge, repeat-week
      overlay, busy/away entry, add-game CTA. Cross-check against
      `docs/audits/PROGRAM_2026-07-21.md` and
      `docs/audits/GROUPCD_WORKLIST_2026-07-22.md` — every finding in those
      docs should now be either fixed (re-verify) or still correctly
      tracked as out-of-scope/backlog (don't re-log it as new).
- [ ] **2. Workout** — day workout screen, exercise sheet (swap/add/remove/
      guided-injury paths), superset display, finish-session flow. Cross-
      check against `docs/audits/WORKOUT_2026-07-21.md`.
- [ ] **3. Home V2** — readiness cards, equipment card, coach notes section,
      game-day sheet, missed-session prompt (if built), lighter-day offer.
      Cross-check against `docs/audits/HOMEV2_2026-07-21.md`.
- [ ] **4. Onboarding** — full fresh-install sequence, Welcome through
      Complete. Needs a genuinely fresh install path (Full reset or a clean
      simulator), not just a mid-session reset. Confirm the divergent
      `TeamTrainingDurationScreen`/`TeamTrainingIntensityScreen` copy
      question from `docs/audits/COPY_AUDIT_2026-07-23.md` (P3-3) — note
      which screen the live onboarding flow actually renders.
- [ ] **5. Profile/Settings** — every section (Program Setup, Coach
      Adjustments, Learn/FAQ, Developer Tools, Support, Legal, Danger Zone).
      Confirm Support section reflects Group D's outcome: if D1 shipped, the
      in-app feedback form opens (not a mailto link) for both "Leave
      Feedback" and "Ask a Human"; if D1 has not shipped, treat the
      pre-existing silent-failure mailto bug as still open, not
      re-discovered. Cross-check against `docs/audits/PROFILE_2026-07-21.md`.
- [ ] **6. Journal** — re-confirm it remains genuinely unreachable from all
      three tabs (per `docs/audits/JOURNAL_2026-07-22.md`) — this is an
      intentional v1 exclusion, not a regression to fix. A PASS here means
      "still correctly absent," not "found and tested."
- [ ] **7. Auth** — re-confirm it remains genuinely unreachable from app
      launch, Profile, and the post-Full-reset onboarding landing screen
      (per `docs/audits/AUTH_2026-07-22.md`) — decided out-of-v1
      2026-07-22. A PASS here means "still correctly absent."
- [ ] **8. Coach** — questions and compound cases only, per
      `SUPPORTED_ATHLETE_ACTIONS.md` Group 6. Coach-driven program
      mutations remain untested/blocked pending the architecture
      reassessment CLAUDE.md requires — do not test mutation paths here even
      if they appear to work; that's explicitly out of scope until the
      reassessment is done.

---

## 4. Supported Athlete Actions contract sweep

Every row below is from `docs/SUPPORTED_ATHLETE_ACTIONS.md` — this document
**is** the test surface; nothing not listed here should be invented as a
test. Pass criteria for every action (the five-point product loop): tap a
visible control → app previews/applies the change → rules engine repairs
the week where needed → visible plan matches, same session/day, no silent
side effects elsewhere → change survives relaunch.

### Group 1 — day tap → sheet

- [ ] 1.1 Swap → Conditioning (Light/Hard)
- [ ] 1.2 Swap → Strength (Upper/Lower/Full/Accessories)
- [ ] 1.3 Swap → Recovery
- [ ] 1.4 Swap → Rest day — **if Group D5 has shipped, verify this is now a
      non-destructive Swap-To option, not only reachable via "Bin this
      session"; if D5 hasn't shipped, this row is still a known gap, not a
      new finding.**
- [ ] 1.5 Move session to another day (only legal days offered; occupied
      destination = atomic swap) — cross-check against the move
      content-conservation fix (`MEMORY.md`'s "Move conservation + readiness
      unify" entry) and confirm the "Done" message now shows weekday names,
      not raw ISO dates, if Group D3 has shipped.
- [ ] 1.6 Bin session (incl. one of a multi-session day; incl. team
      training single-date) — recurring team schedule untouched.
- [ ] 1.7 Add session to rest day
- [ ] 1.8 Add conditioning onto occupied day (combined S+C day, one block
      per day)

### Group 2 — how I'm going

- [ ] 2.1 Session feedback (done/partial/skipped + feel + soreness)
      persists and feeds readiness bias.
- [ ] 2.2 "Too easy / too hard lately" — **NOT BUILT, do not test.**

### Group 3 — my body

- [ ] 3.1 Tired → readiness signal for today, self-heals tomorrow.
- [ ] 3.2 Sick: sniffle → today becomes Recovery Flow.
- [ ] 3.3 Sick: bed-ridden → confirm → recovery-only week, games untouched.
- [ ] 3.4 Injured → body area → plan adapts + clean undo; murky cases open
      coach pre-loaded, never re-asks.

### Group 4 — games

- [ ] 4.1 Add/move/remove a game — G−1/G+1 re-derive automatically.
- [ ] 4.2 Bye this week — unlocks hard-conditioning menu.
- [ ] **Game day lock** — tap-door menu on game day offers only "Log Game"
      and "Move or remove game day," no Swap/Add affordance at all. If a
      locked change is somehow attempted, refusal is the exact plain-
      language string "It's game day — sessions can't be changed or added
      here." — never a raw code. Coach-chat game-day refusal wording is
      explicitly out of scope per Group 6 (still generic "couldn't safely
      preview/validate" copy, not the specific game-day wording) — confirm
      it's still safe (no raw code, nothing applies) even though the wording
      itself isn't under test yet.

### Group 5 — my schedule

- [ ] 5.1 Season phase change — off-season removing team-training days is
      intended behavior, not a bug.
- [ ] 5.2 Available days / team nights changed — setup regeneration.
- [ ] 5.3 Away/holiday date range — **PARTIAL**, rest marks exist, travel
      template is future work; test only what's built.
- [ ] 5.4 Busy this week → pick which days are out — **DECIDED, NOT BUILT,
      do not test.** Do not test the old vague "make training lighter" busy
      route either — it's being replaced, not maintained.
- [ ] 5.5 Missed session → past un-logged day card — **DECIDED, NOT BUILT,
      do not test.** Depends on Group B visible-persistence landing first.

### Group 6 — ask the coach

- [ ] Questions and compound cases only — confirm no mutation path is
      reachable/tested per the CLAUDE.md escalation rule.

### Override principle (cross-cutting)

- [ ] For every risky-but-legal action tested above: the advisory warning
      shows, and proceeding works. Free-form content rejection is correct
      behavior, not a bug — don't log it as a finding.

### Explicitly NOT product — confirm absence, don't test presence

- [ ] Session duration editing — no athlete control exists; confirm it's
      still absent, don't build a test around it appearing.
- [ ] Individual sets/reps/loads via chat phrases — not a supported path.
- [ ] Any free-text mutation path as primary interface.
- [ ] Journal, Auth — covered in section 3 above as "confirm still
      unreachable."

---

## 5. Device matrix

The repo has no device/OS support matrix documented beyond a single iOS
deployment target (`ios/Podfile`, `ios/*.pbxproj`: `15.1`) and the simulator
used for prior audits (iPhone 17 Pro, iOS 26.3). `app.json` sets
`supportsTablet: false` — this is a phone-only, portrait-only app
(`TESTFLIGHT_CHECKLIST.md`). Cover the following before release, since no
existing doc specifies a matrix to copy from:

- [ ] **Minimum supported iOS** (15.1) on the smallest currently-relevant
      screen class Apple still ships (iPhone SE 3rd-gen class, or the
      closest available simulator) — confirms no layout overlap/clipping at
      the small end, matching the smoke test's explicit
      "no tab bar overlap" check.
- [ ] **Current-generation device/OS** (iPhone 17 Pro or newer, latest
      shipping iOS) — the configuration all prior audits actually used;
      confirm it still passes as a baseline, not just a small-screen edge
      case.
- [ ] **One mid-size device** (e.g. standard iPhone, non-Pro, non-Max) if
      available, to catch anything that only reproduces at the Pro's larger
      canvas or the SE's smaller one.
- [ ] Portrait-only is enforced — rotating the device does not produce a
      broken landscape layout (there should be no landscape layout at all;
      confirm the app simply doesn't rotate, per `app.json`'s
      `orientation: portrait` / `Info.plist`).
- [ ] A real physical device, not only simulators — `V1_LAUNCH_DEFINITION.md`'s
      own "Definition of done" requires "a TestFlight build on a phone that
      isn't Sam's," which by definition can't be satisfied by simulator
      testing alone.

---

## 6. TestFlight / App Store sanity checks

`docs/TESTFLIGHT_CHECKLIST.md` (last updated 2026-05-03) and
`docs/APP_STORE_PRIVACY_NOTES.md` (same date) are the existing release-config
references — **both predate the current App Store draft docs
(`docs/appstore/APP_STORE_LISTING_DRAFT.md`,
`docs/appstore/PRIVACY_POLICY_DRAFT.md`, both 2026-07-22/23) and are stale in
specific, checkable ways.** Reconcile rather than blindly follow the older
doc:

- [ ] **Support/feedback email.** `APP_STORE_PRIVACY_NOTES.md` line 147
      says "The support email currently used in app code is
      `one22gym@gmail.com`" and lists it as a founder decision still open.
      The current App Store listing/privacy drafts (2026-07-22/23) already
      commit to `hello@localfootyathlete.app`. Confirm Group D item D2 has
      landed (`env.ts` `DEFAULT_SUPPORT_EMAIL` updated) before treating this
      as resolved — if D2 hasn't shipped, the app is still wired to the old
      address regardless of what the App Store copy promises.
- [ ] **External Privacy Policy / Support URLs.** `TESTFLIGHT_CHECKLIST.md`
      line 194-195 and `APP_STORE_PRIVACY_NOTES.md` "Current Gaps" both list
      these as "still needed." `APP_STORE_LISTING_DRAFT.md` (newer) already
      shows both as set: Support URL `https://localfootyathlete.app`,
      Privacy Policy URL `https://localfootyathlete.app/#privacy`. Confirm
      both URLs are actually live and resolve correctly before submission —
      don't trust either doc's claim without opening the URLs.
- [ ] **App Privacy nutrition label answers.** Use
      `APP_STORE_LISTING_DRAFT.md`'s "App Privacy nutrition label answers"
      section (2026-07-23, resolved-against-code) as the authoritative
      source over the older `APP_STORE_PRIVACY_NOTES.md`'s "Suggested...
      Answers" section, which predates the feedback-form/table decision and
      still frames email collection as "if users email support" (mailto
      framing) rather than an in-app stored form. If Group D1 ships (in-app
      form + Supabase table), the nutrition-label answer for Contact
      Info/Email and User Content/Customer Support must reflect
      "collected via in-app form, stored," not "sent via the user's own
      mail client, not stored" — these are materially different disclosures.
- [ ] **Config audit** (from `TESTFLIGHT_CHECKLIST.md`'s existing table —
      re-verify each value hasn't drifted): app name, bundle id
      `com.localfootyathlete.app`, version/build number (confirm build
      number is incremented beyond the last uploaded TestFlight build —
      `eas.json`'s `production` profile has `autoIncrement: true`, confirm
      it actually fired), iOS deployment target 15.1, portrait-only, no
      tablet, app icon 1024×1024, splash present, privacy manifest present,
      entitlements empty, Expo updates disabled.
- [ ] **Unused permission strings.** `Info.plist` still declares
      `NSFaceIDUsageDescription` and `NSMicrophoneUsageDescription` with no
      live flow requesting either. Confirm on a real device (not simulator)
      that neither prompt ever fires during a full walkthrough — if
      confirmed dead, file the removal as a follow-up (removing them isn't
      a release blocker per the existing doc, but leaving stale usage
      strings does raise Apple review questions if the reviewer probes).
- [ ] **EAS/Supabase production config.** Required EAS production env vars
      set (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
      `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_FEEDBACK_EMAIL` — confirm
      these two reflect the D2 fix, or confirm they've been retired if D1
      makes them dead per the execution plan's note — `EXPO_PUBLIC_ENABLE_DEBUG_LOGS=false`).
      Supabase secrets set server-side (`OPENAI_API_KEY`,
      `COACH_LLM_PROVIDER`, `COACH_LLM_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`).
      `coach-chat`/`coach-intent` functions deployed. If Group D1 shipped,
      the new `007_feedback_table.sql` migration has been applied to the
      production Supabase project, and its RLS policy has been verified
      live (anon insert succeeds, anon select returns nothing) — not just
      unit-tested against a mock.
- [ ] **Local preflight** (from `TESTFLIGHT_CHECKLIST.md`): `npm run
      typecheck`, `npm run test:env-config`, `npm run test:logger`, `npm run
      test:coach-live-path-v2`, `npm run test:coach-live-wiring`, `npm run
      test:weekly-coach-update`, `npm run test:coach-update-card-ui`, `npm
      run test:profile-reset-ui`, `npx expo config --type public`, `plutil
      -lint ios/LocalFootyAthlete/Info.plist`, `plutil -lint
      ios/LocalFootyAthlete/PrivacyInfo.xcprivacy`. Run `npx expo-doctor` if
      available.

### Fresh Install Smoke Test — updated for current build

`TESTFLIGHT_CHECKLIST.md`'s existing 15-item smoke test is reused below with
one item updated to reflect the Group D feedback-form change (its original
item 12 assumed mailto links, which D1 replaces):

- [ ] 1. App starts at onboarding.
- [ ] 2. Complete onboarding with a realistic local football profile.
- [ ] 3. Program generation completes without config errors.
- [ ] 4. App lands on Program tab.
- [ ] 5. Program tab shows the generated week with no tab bar overlap.
- [ ] 6. Open a day workout and verify it matches Program tab.
- [ ] 7. Calendar/fixture context (game/team-training) visible where
        expected.
- [ ] 8. Coach tab sends a normal message.
- [ ] 9. Coach injury/fatigue update visibly affects Program tab and Coach
        Update card.
- [ ] 10. Profile tab opens.
- [ ] 11. Privacy Policy and Terms open from Profile.
- [ ] 12. **(Updated from mailto to in-app form, pending Group D1.)** "Leave
        Feedback" and "Ask a Human" open the in-app feedback form (not a
        mailto compose sheet); submitting with a message and email succeeds
        with visible confirmation. If D1 has not shipped by the time this
        checklist runs, fall back to the original assertion (mailto links
        open) and log that as a known gap, not a new failure.
- [ ] 13. Clear active changes clears Coach Update state without wiping
        base program — and (per Group D's copy fix, if landed) the
        confirmation reads as a plain sentence, not a "Key: Value" debug
        dump.
- [ ] 14. Clear coach chat clears only conversation.
- [ ] 15. Full reset returns to onboarding after confirmation.

---

## 7. Sign-off

Per `docs/V1_LAUNCH_DEFINITION.md`'s "Definition of done for v1":

- [ ] Every v1 blocker (1-9) is checked off.
- [ ] `test:bible` green on the release candidate (section 1 above).
- [ ] Final Maestro golden smoke pass clean (section 2 above).
- [ ] A TestFlight build installed and sanity-checked on a phone that isn't
      Sam's.

When all four are true, this checklist is complete and the release
candidate is ready to submit for App Store review.
