/**
 * THE AWAY FLOW — SEAT_INBOX ITEM 28, RULED BY SAM ON 2026-08-13.
 *
 * **His words are the spec:** *"I think the away button should live on the
 * weekly screen, it should say 'when do you leave?' then 'when do you return'
 * thhe leave button should be limited to that week in dates, but the return
 * date can be any date in the future / then you are asked about the equipment
 * stuff"*, and before it: *"can't we just treat going away as a modifier for
 * equipment? the athlete just removes the equipment they don't have while on the
 * trip and it's kept that way until they turn the modifier off and say 'i'm back
 * now'"*.
 *
 * THE PROPERTY THIS SUITE HOLDS IS THAT AWAY DOES SOMETHING, AND THAT IT STOPS.
 * Three cells could each be green while the athlete gets nothing:
 *
 *   1. **The span survives the door.** The old away door wrote a `travel`
 *      SCHEDULE fact with the away dates marked unavailable — it took the
 *      sessions away. An equipment answer dated over days that no longer hold a
 *      session substitutes nothing, so it would have shipped green and empty.
 *      Cell [1] asserts what the door writes; cell [5] asserts what it must
 *      NEVER write again.
 *   2. **It crosses a week boundary.** This is the defect item 28 exists to
 *      fix: the replaced sheet toggled training days inside the VISIBLE WEEK,
 *      so "away for ten days" was unsayable. A cell whose trip fits inside one
 *      week cannot see that, so cell [2] runs a ten-day trip.
 *   3. **It lifts itself.** Sam: *"on the return date the modifier drops off
 *      and the program goes back to normal by itself"*. `until` is therefore the
 *      LAST DAY AWAY, never the return date — cell [3].
 *
 * Run: npm run test:away-flow
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const memory = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

const {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
} = require('../store/acceptedStateColdStart') as typeof import('../store/acceptedStateColdStart');
const {
  createEmptyReversibleAdjustmentLedger,
} = require('../rules/reversibleAdjustmentLedger') as typeof import('../rules/reversibleAdjustmentLedger');
const {
  useProgramStore,
} = require('../store/programStore') as typeof import('../store/programStore');
const {
  useProfileStore,
} = require('../store/profileStore') as typeof import('../store/profileStore');
const {
  useCoachUpdatesStore,
} = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
const {
  executeProgramControlActionDurably,
} = require('../utils/programControlActions') as typeof import('../utils/programControlActions');
const {
  composeTemporarySourceFactCompatibility,
} = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const {
  validateWorkoutAgainstActiveConstraints,
} = require('../utils/postGenerationConstraintValidation') as typeof import('../utils/postGenerationConstraintValidation');

armTotalsOrRed();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1;
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.log(`  FAIL ${name}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

console.log('\n-- The away flow (SEAT_INBOX item 28) --');

function profile() {
  return {
    trainingLocation: 'Commercial gym' as const,
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete' as const,
    seasonPhase: 'Off-season' as const,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as
      import('../types/domain').DayOfWeek[],
  };
}

function reset(): void {
  const now = '2026-08-10T09:00:00.000Z';
  const onboardingData = profile();
  const emptySurfaces = {
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
  };
  useProgramStore.setState({
    ...emptySurfaces,
    acceptedMaterialContext: {
      ...createEmptyAcceptedMaterialContext(),
      revision: 1,
      lastTransaction: 'test:seed',
      acceptedProfileSnapshot: {
        protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
        capturedAt: now,
        updatedAt: now,
        sourceRevision: 1,
        onboardingData,
      },
      acceptedCompositionBase: {
        protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
        capturedAt: now,
        updatedAt: now,
        sourceRevision: 1,
        provenance: 'accepted_pre_injury',
        surfaces: emptySurfaces,
      },
    },
  } as any);
  useProfileStore.setState({ onboardingData } as any);
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeConstraints: [],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  } as any);
}

// A TEN-DAY TRIP, ON PURPOSE. Monday 2026-08-17 to Thursday 2026-08-27, which
// crosses two Sundays — the shape the replaced sheet could not express at all.
const LEAVE = '2026-08-17';
const RETURN = '2026-08-27';
const LAST_DAY_AWAY = '2026-08-26';
const TODAY = '2026-08-13';

const awayAction = {
  type: 'set_equipment_modifier' as const,
  source: {
    screen: 'program_tab' as const,
    surface: 'away_this_week',
    initiatedBy: 'tap' as const,
  },
  scope: 'current_week' as const,
  payload: {
    decision: {
      kind: 'missing_for_span' as const,
      tags: ['barbell', 'machine'] as const,
      conditioningModalities: ['row'] as const,
      from: LEAVE,
      until: LAST_DAY_AWAY,
    },
    date: LEAVE,
    todayISO: TODAY,
  },
  requiresRebuild: false,
  createsActiveModifier: true,
  oneOffOnly: false,
};

function equipmentFacts() {
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return accepted.temporarySourceFacts.filter(
    (fact: any) => fact.factKind === 'equipment',
  ) as any[];
}

async function main(): Promise<void> {
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useProfileStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
  ]);

  // ── [1] THE AWAY ANSWER LANDS AS A DATED EQUIPMENT FACT ──────────────────
  reset();
  const result = await executeProgramControlActionDurably(awayAction as any, { todayISO: TODAY });
  const facts = equipmentFacts();
  const fact = facts[0];
  run('the away answer commits', result.ok === true, result.message);
  run('[1] the away answer is ONE equipment fact, marked as missing',
    facts.length === 1 && fact?.mode === 'without'
      && fact?.equipmentTags.includes('barbell')
      && fact?.equipmentTags.includes('machine')
      && fact?.conditioningModalities.includes('row'),
    facts.map((f) => ({ kind: f.factKind, mode: f.mode, tags: f.equipmentTags })));

  run('[1b] the fact carries the athlete\'s OWN span, not the calendar week',
    fact?.scope?.kind === 'window'
      && fact?.scope?.from === LEAVE
      && fact?.scope?.until === LAST_DAY_AWAY,
    fact?.scope);

  // ── [2] IT CROSSES THE WEEK BOUNDARY ─────────────────────────────────────
  // THE WHOLE REASON ITEM 28 EXISTS. `2026-08-17` is a Monday and `2026-08-24`
  // is the Monday AFTER it, so a week-scoped fact — which is what this path
  // wrote before `bfad51b7` — cannot reach the second date. If this cell ever
  // goes green with a week scope, the scope argument has been hard-coded back.
  // READ THROUGH THE SAME PROJECTION THE APP READS. `onDate` is how every
  // surface asks "what is active today", so a cell that re-read the dates by
  // hand would be asserting its own arithmetic instead of the app's.
  const equipmentConstraintsOn = (date: string) =>
    composeTemporarySourceFactCompatibility({
      temporarySourceFacts: normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      ).temporarySourceFacts as any,
      onDate: date,
    }).activeConstraints.filter((c: any) => c.type === 'equipment');
  const applies = (date: string): boolean => equipmentConstraintsOn(date).length === 1;
  run('[2] the restriction reaches the first day away', applies(LEAVE),
    equipmentConstraintsOn(LEAVE).map((c: any) => c.id));
  run('[2b] the restriction still reaches a day in the NEXT week',
    applies('2026-08-24'), { checked: '2026-08-24', scope: fact?.scope });
  run('[2c] the restriction reaches the last day away',
    applies(LAST_DAY_AWAY), { checked: LAST_DAY_AWAY });

  // ── [3] IT LIFTS ITSELF ON THE RETURN DATE ───────────────────────────────
  run('[3] the restriction is GONE on the day the athlete returns',
    !applies(RETURN), { returnDate: RETURN, scope: fact?.scope });

  // ── [4] "I'M BACK NOW" IS THE EARLY EXIT ─────────────────────────────────
  const cleared = await executeProgramControlActionDurably({
    ...awayAction,
    payload: { decision: { kind: 'available_again' }, date: TODAY, todayISO: TODAY },
  } as any, { todayISO: TODAY });
  run('[4] "equipment available again" resolves the away fact early',
    cleared.ok === true
      && equipmentFacts().every((f) => f.status !== 'active'),
    equipmentFacts().map((f) => f.status));

  // ── [5] THE DOOR NEVER TAKES THE SESSIONS AWAY AGAIN ─────────────────────
  // SOURCE-PINNED, because the regression is a single line returning to one
  // handler. The away door wrote `set_schedule_modifier` with
  // `planChange: { kind: 'clear_days' }` until 2026-08-13, and that fact marked
  // the away dates UNAVAILABLE. Sam ruled the opposite twice — *"if yes, follow
  // same program"* and *"the plan should change until their return date"* — and
  // the whole equipment answer above is vacuous if the sessions are not there.
  const hook = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8');
  const awayStart = hook.indexOf('const handleApplyAwayEquipment');
  const awayBody = awayStart >= 0
    ? hook.slice(awayStart, hook.indexOf('}, [weekDays, handleProgramControlResult]);', awayStart))
    : '';
  run('[5] the away door still exists and writes an equipment decision',
    awayStart >= 0 && /type: 'set_equipment_modifier'/.test(awayBody));
  run('[5b] the equipment half writes no schedule fact of its own',
    awayBody.length > 0 && !/set_schedule_modifier/.test(awayBody));

  // THE TRIP HALF WRITES A SCHEDULE FACT AND MUST NEVER CLEAR A DAY AGAIN.
  // Sam ruled BOTH things: the plan keeps running *"if yes, follow same
  // program"*, and *"yes clear team training and games while away"*. A
  // `clear_days` payload cannot express the second without breaking the first —
  // it takes the whole day, gym session and all — which is why this cell names
  // the payload rather than the behaviour.
  const spanStart = hook.indexOf('const handleApplyAwaySpan');
  const spanBody = spanStart >= 0
    ? hook.slice(spanStart, hook.indexOf('}, [weekDays, handleProgramControlResult]);', spanStart))
    : '';
  run('[5c] the trip is written as a SPAN, never as cleared days',
    spanStart >= 0
      && /type: 'set_schedule_modifier'/.test(spanBody)
      && /awaySpan: span/.test(spanBody)
      && !/clear_days/.test(spanBody)
      && !/unavailableDates/.test(spanBody));

  // AND THE EXECUTOR MUST NOT PUT THEM BACK. `unavailableDates` is what
  // `scheduleBlocksDate` reads, and a single date in that list collapses the
  // whole day to rest — the exact behaviour item 28 removed.
  const executor = fs.readFileSync(
    path.join(__dirname, '..', 'utils', 'programControlActions.ts'), 'utf8');
  run('[5d] a span-shaped trip marks no date unavailable',
    /unavailableDates: awaySpan \? \[\] : awayDates/.test(executor));

  // ── [6] THE SHEET HANDS THE SPAN OVER, AND ONLY WHEN IT HAS ONE ──────────
  // ONE MENU, NOT TWO (Sam: *"the athlete just removes the equipment they don't
  // have"*). `EquipmentLimitationSheet` is the same sheet the this-week answer
  // uses; the span is the only difference, so the cell that matters is that the
  // span DECIDES the kind rather than decorating it.
  const sheet = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'EquipmentLimitationSheet.tsx'), 'utf8');
  run('[6] the equipment sheet emits a SPAN decision when given a span',
    /void onApply\(span[\s\S]{0,400}kind: 'missing_for_span'[\s\S]{0,200}from: span\.from[\s\S]{0,120}until: span\.until/
      .test(sheet));
  run('[6b] and still emits the this-week decision when it is not given one',
    /kind: 'missing_this_week'/.test(sheet));

  // ── [7] THE RETURN DATE IS NOT A DAY AWAY ────────────────────────────────
  // The screen turns "when do you return" into `until` by subtracting a day.
  // Sam's build order: *"on the return date the modifier drops off and the
  // program goes back to normal by itself"*.
  const screen = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
  run('[7] the screen turns the return date into the last day away',
    /from: leaveISO, until: addDaysISO\(returnISO, -1\)/.test(screen));

  // ── [8] WHAT BEING AWAY DOES TO A DAY — Sam, 2026-08-13 ──────────────────
  // *"yes clear team training and games while away"*, answering the one
  // question item 28 left open. The rule has two halves and BOTH have to hold
  // or it is the wrong rule: the club's work comes off, and the athlete's OWN
  // work does not. A cell that only checked the first half would pass on the
  // door this flow replaced — the one that deleted the whole day.
  const travelConstraint = {
    id: 'source-fact:schedule:away-test',
    type: 'schedule' as const,
    scheduleKind: 'travel' as const,
    status: 'active' as const,
    severity: 7,
    startDate: LEAVE,
    expiresAt: LAST_DAY_AWAY,
    lastUpdatedAt: `${LEAVE}T09:00:00.000Z`,
    source: 'tap' as const,
    unavailableDates: [] as string[],
    unavailableWeekdays: [] as string[],
    modifierAffects: ['current_week'],
    rules: [], safeFocus: [], advice: [],
  };
  const validateOn = (date: string, workout: any) =>
    validateWorkoutAgainstActiveConstraints({
      workout,
      date,
      todayISO: TODAY,
      activeConstraints: [travelConstraint] as any,
    } as any);

  const combinedDay = () => ({
    id: 'w-combined',
    name: 'Strength + Team Training',
    workoutType: 'Strength',
    exercises: [
      { exercise: { name: 'Back Squat' }, sets: 3, reps: '5' },
      { exercise: { name: 'Team Training' } },
    ],
  });
  const combined = validateOn(LEAVE, combinedDay());
  const survivingNames = (combined.workout?.exercises ?? [])
    .map((row: any) => row?.exercise?.name ?? row?.name);
  run('[8] away takes the TEAM part off a combined day',
    combined.workout !== null
      && !survivingNames.some((n: string) => /team training/i.test(String(n))),
    survivingNames);
  run('[8b] and leaves the athlete\'s OWN session exactly where it was',
    survivingNames.includes('Back Squat'), survivingNames);

  // ── [9] A DAY THAT WAS ONLY THE CLUB BECOMES REST ────────────────────────
  const teamOnly = validateOn(LEAVE, {
    id: 'w-team',
    name: 'Team Training',
    workoutType: 'Team Training',
    exercises: [{ exercise: { name: 'Team Training' } }],
  });
  run('[9] a team-training-only day becomes rest while away',
    teamOnly.workout === null && teamOnly.collapsedToRest === true);

  // ── [10] AND SO DOES A GAME ──────────────────────────────────────────────
  const game = validateOn(LEAVE, {
    id: 'w-game', name: 'Game Day', workoutType: 'Game', exercises: [],
  });
  run('[10] a game is off while away', game.workout === null);

  // ── [11] NOTHING ELSE IS TOUCHED, and this is the half that matters most ─
  const solo = validateOn(LEAVE, {
    id: 'w-solo',
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    exercises: [
      { exercise: { name: 'Back Squat' }, sets: 3, reps: '5' },
      { exercise: { name: 'Romanian Deadlift' }, sets: 3, reps: '8' },
    ],
  });
  const soloNames = (solo.workout?.exercises ?? [])
    .map((row: any) => row?.exercise?.name);
  run('[11] a solo session is untouched by being away',
    solo.workout !== null && solo.collapsedToRest === false
      && soloNames.includes('Back Squat') && soloNames.includes('Romanian Deadlift'),
    soloNames);

  // ── [12] AND ALL OF IT STOPS ON THE RETURN DATE ──────────────────────────
  // The constraint is horizon-bounded, so the same team night on the day he is
  // home must survive. Without this cell the rule could be "team training is
  // gone forever" and every cell above would still be green.
  const homeAgain = validateOn(RETURN, combinedDay());
  const homeNames = (homeAgain.workout?.exercises ?? [])
    .map((row: any) => row?.exercise?.name ?? row?.name);
  run('[12] the team night is BACK on the day the athlete returns',
    homeAgain.workout !== null
      && homeNames.some((n: string) => /team training/i.test(String(n))),
    homeNames);

  console.log(`\naway flow: ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
  totalsPrinted(failures.length);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
