/**
 * THE FEATURE REGISTRY — provenance for FEATURES, the way `lawRegistry` gave it
 * to rules and `signedCopy` gave it to words.
 *
 * ## WHY IT EXISTS
 *
 * `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md`, and SEAT_INBOX
 * item 11, whose instruction is the shape of this file: *"Two states, no third
 * — `held` (names the test that fails) or `UNPROVEN` (names what a proof would
 * take) — plus a `reachable` field laws do not need. **Copy `lawRegistry.ts`
 * exactly; do not design a second mechanism.** Seed it honestly and let the
 * number be ugly."*
 *
 * So this is `lawRegistry`'s shape, deliberately, down to the two-state union
 * and the `chainStatus` on the guard. A second mechanism would be a second
 * answer to *"is this thing real"*, which is the disease.
 *
 * ## THE ONE FIELD LAWS DO NOT NEED, AND WHY IT IS THE POINT
 *
 * `reachable`. A law is true or it is not; a FEATURE can be perfectly built,
 * perfectly tested, and **impossible for an athlete to get to** — and that is
 * the exact state this repo keeps discovering late. `canOverride` was written
 * nine times and read nowhere. Seven modifier controls sat on a screen behind a
 * caption pointing at a page that no longer showed them. `CLAUDE.md` names the
 * cure: **DONE MEANS THE ATHLETE CAN SEE IT.**
 *
 * So a row says three things and cannot dodge any of them: is it BUILT, is it
 * PROVEN, and can an athlete REACH it.
 *
 * ## THE THREE WORDS, AND ONLY THESE THREE
 *
 * `CLAUDE.md`: **WORKING** (name the test that fails if it breaks), **BUILT**
 * (the code exists, nothing checks it), **WRITTEN** (a doc says so, no code).
 * *Banned: done, shipped, wired, handled, sorted, passing.* A `held` row is
 * WORKING. An `UNPROVEN` row is BUILT or WRITTEN and says which.
 *
 * ## SEEDED HONESTLY, AND THE NUMBER IS UGLY ON PURPOSE
 *
 * Item 11 asks for exactly that. This is a first batch covering the features
 * this terminal touched or measured on 2026-08-12 and can therefore state a
 * receipt for. **It is not a census of the app** — claiming completeness here
 * would be the belief the registry exists to end, so the roster's own
 * incompleteness is declared in `FEATURE_REGISTRY_SCOPE` below and asserted by
 * the gate rather than left as a reassuring silence.
 */

export type FeatureProof =
  | {
      readonly state: 'held';
      /** The npm script or named cell that FAILS when the feature breaks. */
      readonly by: string;
      /** Whether that guard is reached by `npm run test:bible`. */
      readonly chainStatus: 'in_chain' | 'outside_chain';
      /** How this was verified, so the row is a receipt and not a belief. */
      readonly receipt: string;
    }
  | {
      readonly state: 'UNPROVEN';
      /**
       * Which of the three words this row honestly is. `WRITTEN` means a doc
       * says so and no code exists; `BUILT` means code exists and nothing
       * checks it. There is no word for "probably fine".
       */
      readonly claim: 'BUILT' | 'WRITTEN';
      /** One line: what a proof would actually take. */
      readonly wouldTake: string;
      /** How the absence of proof was verified. */
      readonly receipt: string;
    };

/**
 * CAN AN ATHLETE GET TO IT?
 *
 * - `athlete_reachable` — a real tap path exists on a screen they can open.
 * - `built_unreachable` — the code is there and nothing routes to it. **This is
 *   the state that reads as done and is not**, and the reason this field exists.
 * - `internal` — deliberately not athlete-facing (a gate, a store owner, a
 *   diagnostic). Not a lesser state; it is the honest answer for machinery.
 */
export type FeatureReach = 'athlete_reachable' | 'built_unreachable' | 'internal';

export interface FeatureRow {
  /** Stable id. Never renumbered — rows are retired, not reused. */
  readonly id: string;
  /** What it does, in ONE plain sentence. Sam must be able to read the list. */
  readonly feature: string;
  /** Where it was asked for: a file, a doc, or the date Sam said it. */
  readonly askedFor: string;
  readonly reachable: FeatureReach;
  readonly proof: FeatureProof;
}

/**
 * WHAT THIS ROSTER COVERS, STATED SO ITS SILENCE IS NOT READ AS COVERAGE.
 *
 * A registry that looks complete and is not would be worse than none — the
 * reader would take an absent feature for a non-existent one. The gate asserts
 * this string is non-empty and that the roster does not claim completeness.
 */
export const FEATURE_REGISTRY_SCOPE =
  'FIRST BATCH, 2026-08-12. Covers only features this terminal built, measured '
  + 'or read at source on that day, each with a receipt it can stand behind. It '
  + 'is NOT a census of the app: an absent feature means nobody has written its '
  + 'row yet, never that it does not exist. Growing this roster is the work; '
  + 'the number being ugly is the point (SEAT_INBOX item 11).';

export const FEATURE_REGISTRY: readonly FeatureRow[] = [
  {
    id: 'FEAT-my-status-owns-modifiers',
    feature: 'Coach / My Status lists what is currently changing the program and offers every control that changes it.',
    askedFor: 'docs/SEAT_INBOX.md item 8; Sam 2026-08-12: "we don\'t need this anymore - it shows up in the status bar and on the a simple thing shows on day screen and week screen"',
    reachable: 'athlete_reachable',
    proof: {
      state: 'held',
      by: 'test:my-status-modifiers',
      chainStatus: 'in_chain',
      receipt: 'All eight modifier action kinds reach a door; the router is TOTAL over `ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS` and reds on a kind it does not know. ON GLASS: `.maestro/golden/coach-my-status.yaml` green on LFA Explorer (iOS 26.3), `artifacts/ui-walk/coach-my-status-action-live.png` shows a previously-inert control opening its sheet. Commits `a0e293b3`, `8de98d3f`, `2e16fb9f`.',
    },
  },
  {
    id: 'FEAT-day-week-modifier-indicator',
    feature: 'The day and week screens show that SOMETHING is currently modifying the program, without the detail.',
    askedFor: 'Sam 2026-08-12, the second half of the same sentence: "a simple thing shows on day screen and week screen"',
    reachable: 'athlete_reachable',
    proof: {
      state: 'held',
      by: 'test:program-tab-read-only-modifiers',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 (SEAT_INBOX item 16), after Sam answered the item-8 stop report: "yes — one line on week, small card on day, read-only both". MOUNTED TWICE, in `HomeScreenV2.tsx`: `surface="day"` above the day card inside `styles.dayFirst`, and `surface="week"` above the seven rows inside `styles.dayList` — the SAME `ModifiersStrip` the Coach header mounts, not a second component. The count is `useHomeScreen`\'s `modifierCount`, which is `useActiveModifiers().count` — the duplicate inline `selectActiveCoachNotes` memo that sat beside it was COLLAPSED into that hook in the same commit, so the number and My Status\'s list cannot disagree. Read-only, in TWO hops since Sam ruled "add the popup" (2026-08-13): tapping opens `ModifiersSheet` — his own prototype\'s "Your session has been modified", listing each modifier\'s authored title and sentence, with "Go to my status" and "Not now" — and that sheet calls `navigation.navigate(\'CoachTab\', { status: \'open\' })`. **The sheet LISTS and does not ACT:** it never reads `note.actions`, and a cell pins it to exactly two buttons, so the eight modifier controls still live on My Status alone. Held by cells [6]-[8] of `test:program-tab-read-only-modifiers` (both surfaces, the one-hook count, the doorway), and cell [5] still forbids `ActiveModifiersSection` on Program. ON GLASS: `artifacts/ui-walk/day-modifier-notice.png` and `week-modifier-notice.png`. FOUR ABSENCE ASSERTIONS RESOLVED, not all by flipping: `coach-my-status.yaml`\'s populated one inverted to `assertVisible`; its ZERO-state one deliberately KEPT as `assertNotVisible`, because rule (e) is that zero shows nothing on Program; `standard-program-week.yaml`\'s two inverted only after its modifier door was re-routed off `equipment-preset-open`, an id no product source produces.',
    },
  },
  {
    id: 'FEAT-warn-then-allow',
    feature: 'When the app refuses a plan change it can be overridden, the athlete gets a way through and the override is recorded.',
    askedFor: 'docs/SEAT_INBOX.md item 9; Sam 2026-08-12: "should give warnings but allow them to do whatever they want"',
    reachable: 'athlete_reachable',
    proof: {
      state: 'held',
      by: 'test:block-override',
      chainStatus: 'in_chain',
      receipt: 'Commit `ca33206f`. `mayOverrideBlock` is `canOverride`\'s FIRST production reader after nine writes; the sheet assigns its way through directly from the rule and cell [3b] reds on `false && mayOverrideBlock(...)` — a mutation that left the earlier reader cell green. NOT PHOTOGRAPHED: the block path needs a change the assessment refuses, which no seeded flow reaches today.',
    },
  },
  {
    id: 'FEAT-status-update-answers',
    feature: 'The "how are you feeling now?" sheet offers Sam\'s five answers, in his words.',
    askedFor: 'Sam 2026-08-12, ruled twice: "Drop \'Worse\' … four options only … change \'Still sick\' to \'Still pretty sick\'", then "actually keep worse for now"',
    reachable: 'athlete_reachable',
    proof: {
      state: 'held',
      by: 'test:my-status-modifiers',
      chainStatus: 'in_chain',
      receipt: 'Commit `cbc36bcf`. All five are SIGNED copy read through the branded type, not inline literals; the set AND its size are asserted, mutation-checked both ways ("Worse"->"Worst" reds the wording cell, a literal in the sheet reds the signedCopy cell). ON GLASS: `artifacts/ui-walk/coach-my-status-action-live.png`.',
    },
  },
  {
    id: 'FEAT-rehydration-never-un-finishes',
    feature: 'Reading the saved profile back can restore your setup but can never un-finish it.',
    askedFor: 'docs/SEAT_INBOX.md item 2, the "NOT PAID, NOT INVESTIGATED" line',
    reachable: 'internal',
    proof: {
      state: 'held',
      by: 'test:profile-rehydration-cannot-unfinish',
      chainStatus: 'in_chain',
      receipt: 'Commit `a3fe3ad6`. A bare envelope used to flip `isOnboardingComplete` true->false in memory, sending a finished athlete to the first-run flow with their program intact in other stores. Mutation-checked both ways: trusting the disk reds the bare-envelope cell, ignoring it reds the restore cell.',
    },
  },
  {
    id: 'FEAT-experienced-load',
    feature: 'The app shows what training the athlete actually EXPERIENCED, not only what was planned.',
    askedFor: 'docs/SEAT_INBOX.md item 6; docs/HOW_THE_ATHLETE_TELLS_US_2026-08-12.md',
    reachable: 'built_unreachable',
    proof: {
      state: 'UNPROVEN',
      claim: 'WRITTEN',
      wouldTake: 'A strength sRPE of stored `difficulty` x `Workout.durationMinutes`, carrying a flag that the DURATION was assumed, and a surface to show it on.',
      receipt: 'RE-MEASURED 2026-08-12 (`docs/EXPERIENCED_LOAD_REMEASURED_2026-08-12.md`): `conditioningSRPE` is built and correct but its only importers are journal files behind a hidden surface. Strength now HAS an rpe (Sam\'s effort-scale unit, `7a6281ce`), so what is missing is actual minutes only — the item\'s "three missing things" is one.',
    },
  },
  {
    id: 'FEAT-computed-must-be-consumed-gate',
    feature: 'A value the engine computes on every assessment and nothing reads is caught automatically.',
    askedFor: 'docs/SEAT_INBOX.md item 10; docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md §4',
    reachable: 'internal',
    proof: {
      state: 'held',
      by: 'test:computed-must-be-consumed',
      chainStatus: 'in_chain',
      receipt: 'Commit `70e3509c`. First run found SIXTEEN unread `contract.*` fields where the doc named two. Ratchets in both directions and is mutation-checked three ways with a liveness arm. Covers the `contract.*` family ONLY — six of the doc\'s nine are other shapes.',
    },
  },
  {
    id: 'FEAT-coach-note-action-provenance',
    feature: 'A modifier the athlete changes records WHICH screen they changed it on.',
    askedFor: 'docs/SEAT_INBOX.md item 8, finding (2)',
    reachable: 'internal',
    proof: {
      state: 'held',
      by: 'test:coach-note-action-source',
      chainStatus: 'in_chain',
      receipt: 'Commit `a0e293b3`. The durable door was DROPPING the screen (`program_control_durable:<surface ?? screen>`), so the lift would have lost the provenance rather than forged it. Mutation-checked: hard-coding the source back reds only the My Status cell.',
    },
  },
  {
    id: 'FEAT-legacy-program-migration',
    feature: 'A program saved in an older format is migrated when the app opens it.',
    askedFor: 'programStore.canonicaliseHydratedState / Section 18 Contract v2 migration',
    reachable: 'built_unreachable',
    proof: {
      state: 'held',
      by: 'test:legacy-migration-unreachable',
      chainStatus: 'in_chain',
      receipt: 'Commit `ae4bea88`, and the row is `built_unreachable` ON PURPOSE — this is a feature proven NOT to run. `canonicaliseHydratedState` has no production caller and `programStore.partialize` persists inputs only, so no launch reads a stored program back. That is what keeps a measured 20.4s canonicalisation off the athlete\'s launch; the cell reds if either protection goes.',
    },
  },
];
