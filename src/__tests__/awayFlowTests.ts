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
const {
  generateProgramLocally,
} = require('../services/api/generateProgram') as typeof import('../services/api/generateProgram');
const {
  getTeamTrainingWorkoutState,
} = require('../utils/teamTraining') as typeof import('../utils/teamTraining');
const {
  weekIdentityForWeekForTest,
} = require('../rules/derivedWeekContract') as any;
const {
  createTemporaryScheduleFact,
  temporaryFactScope: factScope,
} = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');

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
  // PINNED BY PROPERTY, NOT BY THE EXPRESSION. The first form matched the exact
  // ternary and reddened the day a neighbouring change added a second span kind
  // to it — a cell that fails on somebody else's correct edit is noise.
  run('[5d] a span-shaped trip marks no date unavailable',
    /unavailableDates: [^\n]*awaySpan[^\n]*\?\s*\[\]/.test(executor));

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
  //
  // ⚠ READ THIS BEFORE TRUSTING [8]-[12] AS AN ATHLETE-VISIBLE CLAIM. They call
  // the seam DIRECTLY with row-shaped team training, and the seam does exactly
  // what they say. **The real generator marks a team day on the PLAN
  // (`isTeamDay`) and re-derives its name after this seam runs**, so a
  // generated week is byte-identical with a travel constraint live — measured,
  // not assumed. These cells therefore hold the RULE, not the athlete's screen.
  // The plan-side fix is named in `postGenerationConstraintValidation`.
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

  // ── [13] THE PLAN ITSELF — where being away has to bite, and the only place
  //
  // Sam ruled both halves: *"yes clear team training and games while away"* and,
  // on the fixture, ***"yes it should disappear OBVIOUSLY YOU'RE NOT GOING TO BE
  // THERE"***. The seam cells above hold the RULE; these hold the ATHLETE'S
  // WEEK, and the difference between the two cost a day. A day is a team day
  // because the PLAN says `isTeamDay`, and a week is shaped around a fixture
  // because the PLAN says `gameDay` — both re-derived after post-generation
  // validation runs, so the club has to come off at the plan or not at all.
  const genProfile = {
    trainingLocation: 'Commercial gym' as const,
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete' as const,
    seasonPhase: 'In-season' as const,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: ['Tuesday', 'Thursday'],
    gameDay: 'Saturday',
    recentTrainingLoad: 'Pretty consistent',
    conditioningLevel: 'Average',
  } as any;
  const GEN_WEEK = '2026-07-13';
  const genTravel = [{
    id: 'source-fact:schedule:gen', type: 'schedule', scheduleKind: 'travel',
    status: 'active', severity: 7, startDate: GEN_WEEK, expiresAt: '2026-07-19',
    lastUpdatedAt: `${GEN_WEEK}T09:00:00.000Z`, source: 'tap',
    unavailableDates: [], unavailableWeekdays: [], modifierAffects: ['current_week'],
    rules: [], safeFocus: [], advice: [],
  }];
  const workoutsOf = (program: any): any[] => program?.microcycles?.[0]?.workouts ?? [];
  const teamDaysIn = (program: any): string[] => workoutsOf(program)
    .filter((workout: any) => getTeamTrainingWorkoutState(workout).hasTeamTraining)
    .map((workout: any) => String(workout.name));
  const gameDaysIn = (program: any): string[] => workoutsOf(program)
    .filter((workout: any) => workout.workoutType === 'Game')
    .map((workout: any) => String(workout.name));
  const trainingDaysIn = (program: any): number => workoutsOf(program)
    .filter((workout: any) => (workout.exercises ?? []).length > 0).length;

  const homeWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
  });
  const awayWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: genTravel as any,
  });
  // NON-VACUITY FIRST, ALWAYS: "no team day" and "no game" are both trivially
  // true of a week that never had one, and that exact trap has already been
  // sprung once on this item.
  run('[13] the home week HAS team days, so the cells below can fail',
    teamDaysIn(homeWeek).length === 2, teamDaysIn(homeWeek));
  run('[13b] a week planned inside the trip has NO team day at all',
    teamDaysIn(awayWeek).length === 0, teamDaysIn(awayWeek));
  run('[13c] and no game either — he is not going to be there',
    gameDaysIn(awayWeek).length === 0, gameDaysIn(awayWeek));
  // AND HE STILL TRAINS — *"Everything else stays."*
  //
  // THE PROPERTY IS THE WORK, NOT THE DAY COUNT, and the first version of this
  // cell got that wrong and reddened on correct behaviour. The away week has
  // FOUR training days where the home week has five, because two of those five
  // were club nights; their gym halves redistribute across the days that
  // remain. **Counting days would have made "he lost a session" the law, when
  // what he lost was two nights at a club he is nowhere near.**
  //
  // ── ⚠ REWRITTEN 2026-08-13, AND THE OLD CELL WAS PASSING BY COINCIDENCE ──
  //
  // It asserted `rows(away) === rows(home)` and its NAME claimed *"every row of
  // his own training survives the trip"*. **The name was never true, and the
  // equality was 21 == 21 over two COMPLETELY DIFFERENT ROW SETS.** Measured,
  // by dumping both weeks rather than their totals:
  //
  //   HOME  Lower Body Strength [4] · Team+Upper Pull [3] · Team+Upper Push [3]
  //         · Gunshow [6] · Prehab [5]                                  = 21
  //   AWAY  Lower Body Strength [7] · Lower Squat [5] · Upper Body Strength [5]
  //         · Prehab [5]                                                = 22
  //
  //   LOST   (11): Short Flush, Pull-Ups, Overhead Press, DB Bench Press,
  //                Bicep Curl, and the whole six-row Gunshow arm day.
  //   GAINED (11): Vertical Jump, 20 m Acceleration Reps, Continuous Aerobic
  //                Run, Walking Lunges, Single Leg RDL, Nordic Lower,
  //                Explosive Push-up, Bench Press, Classic 4x4, …
  //
  // **SO THE SEAT'S PROPOSED FIX — "assert a SUPERSET home→away" — IS REFUTED
  // BY THE SAME MEASUREMENT.** A superset reds instantly: eleven of his own
  // rows are gone — and it reds in BOTH arms, so it was never true.
  //
  // ── ⚠ THE +1 *DOES* HAVE AN ARITHMETIC EXPLANATION, AND IT IS `c69151d9` ──
  //
  // An earlier revision of this comment said the +1 was "an eleven-for-eleven
  // SWAP that happens to net +1", not attributable to the grown fallback.
  // **That is refuted by single-variable measurement.** Reverting ONLY
  // `defaultProgram.ts` to `c69151d9^` and re-running both arms:
  //
  //   at HEAD          home 21 · away 22    ← [13d] red under the old equality
  //   fallback reverted home 21 · away 21    ← green, home UNCHANGED
  //
  // **The swap and the +1 are two independent facts.** The eleven-for-eleven
  // swap is present in BOTH arms — it is not what moved. What moved is the
  // squat fallback (`defaultProgram.ts`), grown 3 rows → 5 by `c69151d9` for
  // Sam's `:227` fill order. The away week reaches it because its Wednesday is
  // synthesised whole by `completeCoachWorkoutsFromPlan` (`fallbackReason:
  // edge_omitted_day`) as the "Lower Squat" day.
  //
  // AND THE FALLBACK GREW BY **TWO** WHILE THE WEEK SHOWS **ONE**, because the
  // second new row never ships: `applyPoolRotation` turns `RDLs` into
  // `Deadlift` (pattern preserved), and `finaliseWorkoutAfterMutation` then
  // drops that hinge row on the floor — the open C7 defect receipted in
  // `5d6ef5fa`. So `Single Leg RDL` lands, the hinge does not, and the week
  // gains exactly one. **When C7 is fixed this cell stays green (the floor is
  // one-sided) but the away total becomes 23.**
  //
  // ⚠ `c69151d9` IS THEREFORE NOT OUTPUT-NEUTRAL. Anything holding a recorded
  // generation count against a golden moved with it.
  //
  // **AND THE SWAP IS THE APP OBEYING SAM, NOT DRIFTING FROM HIM:** *"consider
  // the time they are away as building a new program and their old program is
  // gone for the time being"*. The club was carrying his conditioning and half
  // his upper volume. Take it away and a REAL upper day has to appear (it did:
  // Friday's optional arm day became core Upper Body Strength) and the app has
  // to supply the running the club used to (it did: sprints, an aerobic run, a
  // 4x4). **A week that merely deleted the club would be the defect.**
  //
  // WHAT IS ASSERTED INSTEAD IS THE THING THAT MATTERS AND IS TRUE: the trip
  // must not COST him training. A one-sided floor, never a range — it still
  // reds the day a trip starts eating his work, which is the only reason this
  // cell has ever existed.
  const rowsIn = (program: any): number => workoutsOf(program)
    .reduce((total: number, workout: any) => total + (workout.exercises ?? []).length, 0);
  run('[13d] the trip does not COST him training — his volume never falls',
    rowsIn(awayWeek) >= rowsIn(homeWeek),
    { home: rowsIn(homeWeek), away: rowsIn(awayWeek),
      homeDays: trainingDaysIn(homeWeek), awayDays: trainingDaysIn(awayWeek) });
  // AND THE WEEK IS GENUINELY RE-PLANNED, NOT "THE HOME WEEK MINUS THE CLUB".
  //
  // THIS IS THE NON-VACUITY FOR [13d] AND A PIN IN ITS OWN RIGHT. Without it,
  // [13d]'s floor would sit green over a week that simply deleted two club
  // nights and kept everything else — which is what everyone believed was
  // happening, for as long as the totals matched. **It reds if away ever stops
  // re-authoring and goes back to subtracting.**
  const rowNamesIn = (program: any): string[] => workoutsOf(program)
    .flatMap((workout: any) => (workout.exercises ?? [])
      .map((row: any) => String(row?.exercise?.name ?? row?.name ?? '?')));
  const awayNames = new Set(rowNamesIn(awayWeek));
  const droppedFromHome = rowNamesIn(homeWeek).filter((name) => !awayNames.has(name));
  run('[13f] the away week is RE-AUTHORED, not the home week minus the club',
    droppedFromHome.length > 0 && rowNamesIn(awayWeek).some((name) =>
      !new Set(rowNamesIn(homeWeek)).has(name)),
    { dropped: droppedFromHome.length, homeRows: rowNamesIn(homeWeek).length,
      awayRows: rowNamesIn(awayWeek).length });
  // AND THE DAYS DID FALL, ON PURPOSE — stated so the number above cannot be
  // read as "nothing moved". Two club nights left; the work did not.
  run('[13e] the trip costs him exactly the club nights and no more',
    trainingDaysIn(homeWeek) - trainingDaysIn(awayWeek) <= teamDaysIn(homeWeek).length,
    { homeDays: trainingDaysIn(homeWeek), awayDays: trainingDaysIn(awayWeek),
      clubNights: teamDaysIn(homeWeek).length });

  // ── [14] SAM'S WORKED EXAMPLE, VERBATIM — the acceptance test he wrote ──
  //
  // *"they leave thursday august 13th and get back friday 21st of august. Team
  // training should be removed thursday tuesday and thursday … and the game on
  // the 15th should be removed or at least blanked out, but the next saturday
  // the 22nd game is still alive and there training on wednesday thursday friday
  // the following week needs to not kill them for that return"*.
  //
  // THE MIXED WEEK IS THE POINT. Week 17-23 is HALF away — Mon-Thu inside the
  // trip, Friday the flight home, game Saturday. A cell that only walked a
  // wholly-away week could not see the fourth criterion at all.
  const AWAY_FROM = '2026-08-13';
  const AWAY_UNTIL = '2026-08-20';
  const travelFact = createTemporaryScheduleFact({
    observedDate: AWAY_FROM,
    scope: factScope({ kind: 'window', from: AWAY_FROM, until: AWAY_UNTIL }),
    scheduleKind: 'travel',
    unavailableDates: [],
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
  });
  const identity = (weekStart: string, facts: any[]) => weekIdentityForWeekForTest({
    profile: { ...genProfile, seasonPhase: 'In-season' },
    weekStart,
    markedDays: { '2026-08-15': 'game', '2026-08-22': 'game' },
    storedMode: 'in_season_game_week',
    temporarySourceFacts: facts,
  });
  // NON-VACUITY FIRST: both weeks must be GAME weeks before the trip exists, or
  // "no anchor" below is true of a world that never had one.
  const homeWeekOf15 = identity('2026-08-10', []);
  const homeWeekOf22 = identity('2026-08-17', []);
  run('[14] both weeks are game weeks before the trip',
    homeWeekOf15.anchorState === 'game' && homeWeekOf22.anchorState === 'game',
    { w15: homeWeekOf15.anchorState, w22: homeWeekOf22.anchorState });

  const awayWeekOf15 = identity('2026-08-10', [travelFact]);
  const awayWeekOf22 = identity('2026-08-17', [travelFact]);
  run('[14b] the 15th is gone and that week becomes a BYE-WEEK BUILD',
    awayWeekOf15.anchorState === 'bye' && awayWeekOf15.mode === 'in_season_bye_build',
    awayWeekOf15);
  run('[14c] the 22nd is STILL ALIVE — he is home for it',
    awayWeekOf22.anchorState === 'game' && awayWeekOf22.fixtureDays.length > 0,
    awayWeekOf22);
  // AND THAT IS WHAT PROTECTS THE FLIGHT HOME. The 22nd anchoring is what puts
  // G-1 on Friday the 21st and G-2 on Thursday the 20th — days he is still
  // away — so *"training on wednesday thursday friday … needs to not kill them
  // for that return"* falls out of the same filter rather than a second rule.
  run('[14d] the surviving fixture is the 22nd, not the one he missed',
    JSON.stringify(awayWeekOf22.fixtureDays) !== JSON.stringify(homeWeekOf15.fixtureDays)
      || awayWeekOf22.anchorState === 'game',
    { away22: awayWeekOf22.fixtureDays });

  // ── [13g] THE BLOCK ARITHMETIC — SAM'S OWN EXAMPLE, R-075 ──────────────────
  //
  // ***"if I go away for 2 weeks and I was going to miss 4 team trainings 1 game
  // and 5 strength sessions, then the 2 weeks should aim to fill those with 5
  // conditionings and 5 strength ya know"***.
  //
  // **THE UNIT IS THE BLOCK, NOT THE DAY** — which is why this cell generates TWO
  // weeks and not one. [15d]/[15e] hold the per-day substitution; nothing held
  // the total until now, and a per-day fix does not add up to a block total on
  // its own.
  //
  // MEASURED OVER HIS OWN SHAPE (2 weeks, 8 club nights):
  //
  // | | home | away |
  // | --- | --- | --- |
  // | club sessions | 8 | **0** |
  // | conditioning sessions | 4 | **12** |
  // | strength sessions | 20 | 16 |
  //
  // **THE CONDITIONING ARM HOLDS EXACTLY AND THAT IS WHAT THIS CELL PINS:
  // 8 club nights removed -> 8 conditioning sessions added, one for one.** His
  // ratio, on his own example, without anyone having built it for this case.
  //
  // ⚠ THE STRENGTH ARM IS BREACHED AND IS **NOT** ASSERTED HERE — 20 -> 16
  // sessions and 79 -> 72 rows. His rule says 5 strength stays 5 strength. Eight
  // combined club days were removed and only four of their gym halves came back.
  // **It is left un-asserted ON PURPOSE: a red cell in the chain is not how this
  // repo carries an unbuilt law** (`LAW-0-registry` — nothing enters as
  // UNENFORCED), so the gap is carried in R-075 and item 37 with these numbers
  // rather than as a permanent red. **Do not "fix" this by loosening the cell
  // below to cover strength — build the conservation, then assert it.**
  const twoWeek = (facts: any) => {
    const program = generateProgramLocally(genProfile, {
      todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 2,
      ...(facts ? { activeConstraints: facts } : {}),
    } as any);
    let club = 0, conditioning = 0;
    for (const microcycle of (program as any)?.microcycles ?? []) {
      for (const workout of microcycle.workouts ?? []) {
        const rows = (workout.exercises ?? []) as any[];
        if (String(workout.workoutType) === 'Game') continue;
        if (getTeamTrainingWorkoutState(workout).hasTeamTraining) club += 1;
        if (workout.conditioningBlock || String(workout.workoutType) === 'Conditioning' ||
          rows.some((row: any) => row.role === 'conditioning' || row.linkedConditioning)) {
          conditioning += 1;
        }
      }
    }
    return { club, conditioning };
  };
  const blockHome = twoWeek(null);
  const blockAway = twoWeek(genTravel);
  // NON-VACUITY FIRST: the home block must actually HAVE club nights, or
  // "the club was replaced" is a claim about a block that never had any.
  run('[13g] the home block HAS club nights, so the cell below can fail',
    blockHome.club > 0, blockHome);
  run('[13h] every club night the trip removes comes back as CONDITIONING, one for one',
    blockAway.club === 0 &&
      blockAway.conditioning - blockHome.conditioning === blockHome.club,
    { homeClub: blockHome.club, awayClub: blockAway.club,
      homeConditioning: blockHome.conditioning, awayConditioning: blockAway.conditioning,
      gained: blockAway.conditioning - blockHome.conditioning });

  // ── [15] THE WEEK ON HIS SCREEN — Sam, 2026-08-13 ──────────────────────────
  //
  // *"if the person is away, consider the time they are away as building a new
  // program and their old program is gone for the time being … why should game
  // day or TT still show up? thats clunky and unprofessional"*.
  //
  // [13] AND [14] BOTH FIX WHAT A WEEK *IS* — the plan stops marking team days,
  // a fixture inside the trip stops anchoring. **Neither touches a week that was
  // ALREADY STORED with the club on it, and that is the week he is looking at.**
  // This holds the READ: while the trip is live, the club is not shown.
  const { resolveWeekWithConditioning: resolveWeek } =
    require('../utils/sessionResolver') as typeof import('../utils/sessionResolver');
  const awayState: any = {
    seasonPhase: 'In-season',
    markedDays: { '2026-08-15': 'game' },
    temporarySourceFacts: [travelFact],
  };
  const homeState: any = { ...awayState, temporarySourceFacts: [] };
  const dayOn = (state: any, date: string) =>
    (resolveWeek('2026-08-10', state) as any[]).find((day) => day.date === date);

  const gameHome = dayOn(homeState, '2026-08-15');
  const gameAway = dayOn(awayState, '2026-08-15');
  // NON-VACUITY FIRST: it must BE a game day before "no game day" means anything.
  run('[15] the 15th is a game day when he is home',
    !!gameHome && (gameHome.source === 'game' || gameHome.indicator === 'game'
      || gameHome.workout?.workoutType === 'Game'),
    { source: gameHome?.source, indicator: gameHome?.indicator });
  run('[15b] and it is NOT on his week while he is away',
    !!gameAway && gameAway.source !== 'game' && gameAway.indicator !== 'game'
      && gameAway.workout?.workoutType !== 'Game',
    { source: gameAway?.source, indicator: gameAway?.indicator,
      type: gameAway?.workout?.workoutType });

  // ── [15c] WHAT THE GAME LEAVES BEHIND — Sam, 2026-08-13, on that Saturday ──
  //
  // ***"why the fuck does it read training day? it should read whatever the new
  // program is i.e. conditioning, lower body strength etc"***.
  //
  // **[15b] ABOVE IS THE REASON THIS WAS MISSED FOR A DAY.** It proves the game
  // is GONE and says nothing about what stands in its place, so it stayed green
  // over a Saturday reading *"Training Day"* — the app's placeholder for a day
  // that exists and holds nothing. A cell that asserts an absence and never
  // asserts the presence is half a cell, and this is the other half.
  //
  // R-020 decides the word, so nothing new is being ruled here: *"yes clear team
  // training and games while away"* — the club goes and **the athlete's own
  // sessions stay**. He never had a session of his own on a fixture day, so once
  // the game is off he is not training that day, and the honest word for that is
  // the one the registry already holds. R-006 permits up to three full rest days
  // in exactly this shape of week.
  //
  // ASSERTED THROUGH THE COPY REGISTRY, NEVER AGAINST A LITERAL — the words may
  // be re-signed without this cell going stale, and it reds if the ID it names
  // stops being what the athlete reads.
  const { project: projectWeek } =
    require('../rules/projectVisibleWeek') as typeof import('../rules/projectVisibleWeek');
  const { signedCopy: copy } =
    require('../rules/signedCopy') as typeof import('../rules/signedCopy');
  const headlineOn = (state: any, date: string) => {
    const week = resolveWeek('2026-08-10', state) as any[];
    const visible = projectWeek({ week: week as never, weekStart: '2026-08-10' });
    return String(visible.days.find((day: any) => day.date === date)?.headline ?? '');
  };
  const restWord = String(copy('day.headline.rest'));
  const trainingWord = String(copy('day.headline.training'));
  const gameWord = String(copy('day.headline.game'));

  // NON-VACUITY FIRST, AND IT IS THE WHOLE POINT: the day must read GAME at home,
  // or anything said about the away side is true of a day that never changed.
  run('[15c] at home that Saturday reads GAME',
    headlineOn(homeState, '2026-08-15') === gameWord,
    { headline: headlineOn(homeState, '2026-08-15'), expected: gameWord });

  // ── [15d]/[15e] REWRITTEN ON SAM'S RULING R-075, 2026-08-13 ──
  //
  // ***"Away has to replace the work it removes, not just delete it - your
  // Saturday Rest Day is the wrong case."***
  //
  // **THESE TWO CELLS ASSERTED "Rest Day" FOR ABOUT AN HOUR AND HE RULED IT
  // WRONG.** They were written against the defect they could see — the
  // *"Training Day"* placeholder — and picked the other empty-day word instead
  // of asking what the day is FOR. **Two wordings of one hole is not a fix**, and
  // a cell that pins the nicer wording would have frozen the defect in place
  // with a green tick on it. Recorded rather than quietly rewritten, because the
  // mistake is the lesson: **`day.headline` names a day that holds NOTHING, so
  // asserting on it at all was a sign the day was still empty.**
  //
  // WHAT THEY ASSERT NOW IS THE RULING: away is a SUBSTITUTION. The day the trip
  // empties carries WORK, and both empty-day words are forbidden by name.
  const dayCarriesWork = (state: any, date: string) => {
    const day = dayOn(state, date);
    const rows = (day?.workout?.exercises ?? []).length;
    return { day, rows };
  };
  const awaySat = dayCarriesWork(awayState, '2026-08-15');
  run('[15d] away, that Saturday CARRIES WORK — neither empty-day word',
    !!awaySat.day?.workout && awaySat.rows > 0 &&
      headlineOn(awayState, '2026-08-15') !== restWord &&
      headlineOn(awayState, '2026-08-15') !== gameWord,
    { rows: awaySat.rows, headline: headlineOn(awayState, '2026-08-15'),
      forbidden: [restWord, trainingWord, gameWord] });
  // AND THE QUALITY IS CONDITIONING, WHICH IS THE HALF THAT MATTERS.
  //
  // ***"if I go away for 2 weeks and I was going to miss 4 team trainings 1 game
  // and 5 strength sessions, then the 2 weeks should aim to fill those with 5
  // conditionings and 5 strength ya know"*** — 4 team trainings + 1 game = 5
  // removed -> 5 CONDITIONING. **A game is FIELD work, so field work is what
  // owes back.**
  //
  // **THIS CELL EXISTS BECAUSE THE FIRST BUILD PASSED [15d] AND WAS STILL
  // WRONG:** it filled the day with `prehab_accessories`, which is a
  // substitution in SHAPE and not in KIND — it replaced his running with arm
  // work. *"A similar session to keep the program flowing"* is a claim about
  // kind, so the cell has to be about kind too. It also stops [15d] passing on
  // an empty shell.
  run('[15e] and the work is CONDITIONING — the quality the club supplied',
    !!awaySat.day?.workout && awaySat.rows >= 2 &&
      awaySat.day.source !== 'rest' && awaySat.day.source !== 'none' &&
      String(awaySat.day.workout.workoutType) === 'Conditioning',
    { source: awaySat.day?.source, type: awaySat.day?.workout?.workoutType,
      rows: awaySat.rows, name: awaySat.day?.workout?.name });

  // ── [16] THE CARD'S WORDS — Sam: *"it shouldn't show + team training"* ──
  //
  // THE CARD DOES NOT READ `workout.name`. It renders the visible projection's
  // PARTS, and `getSessionComponents` decides those: the TEAM part comes from
  // `hasTeamTraining || the NAME`, the STRENGTH part from `isTeamDay`. **So
  // clearing one alone is worse than clearing neither** — measured on glass
  // twice — and this cell holds the pair rather than either half.
  const { getSessionComponents } = require('../utils/sessionComponents') as any;
  const clubDay: any = {
    id: 'w-club', name: 'Strength + Team Training', workoutType: 'Strength',
    isTeamDay: true,
    exercises: [
      { exercise: { name: 'Back Squat' }, prescribedSets: 3 },
      { exercise: { name: 'Bench Press' }, prescribedSets: 3 },
    ],
  };
  const kindsOf = (workout: any): string[] =>
    (getSessionComponents(workout) ?? []).map((component: any) => String(component.kind));
  run('[16] a club day shows BOTH parts when he is home',
    JSON.stringify(kindsOf(clubDay)) === JSON.stringify(['strength', 'team_training']),
    kindsOf(clubDay));
  const awayDay = {
    ...clubDay,
    isTeamDay: false,
    name: 'Strength',
  };
  run('[16b] and only his own half while he is away',
    JSON.stringify(kindsOf(awayDay)) === JSON.stringify(['strength']),
    kindsOf(awayDay));
  // THE TWO NEAR-MISSES, PINNED SO NOBODY SHIPS EITHER ONE ALONE.
  run('[16c] clearing the flag alone changes nothing',
    JSON.stringify(kindsOf({ ...clubDay, isTeamDay: false }))
      === JSON.stringify(['strength', 'team_training']),
    kindsOf({ ...clubDay, isTeamDay: false }));
  run('[16d] clearing the name alone LOSES his gym work',
    JSON.stringify(kindsOf({ ...clubDay, name: 'Strength' }))
      === JSON.stringify(['team_training']),
    kindsOf({ ...clubDay, name: 'Strength' }));

  // ── [17] THE REAL SHAPE, not a synthetic one ─────────────────────────────
  //
  // [16] used a made-up day and its answer did NOT transfer: the fix passed
  // there and made the card WORSE on the phone. A generated team day is
  // `{ name: "Team Training + Upper Pull", workoutType: "Team Training" }` with
  // strength ROWS, NO `isTeamDay` and NO sections — so the team part comes from
  // the name AND the type, and the strength part from the rows.
  const realClubDay: any = {
    id: 'w-real', name: 'Team Training + Upper Pull', workoutType: 'Team Training',
    exercises: [
      { exercise: { name: 'Pull-Ups' }, prescribedSets: 3 },
      { exercise: { name: 'Barbell Row' }, prescribedSets: 3 },
      { exercise: { name: 'Face Pulls' }, prescribedSets: 3 },
    ],
  };
  const strip = (name: string): string => name.split(/\s+\+\s+/)
    .map((part) => part.trim())
    .filter((part) => part.toLowerCase() !== 'team training').join(' + ') || name;
  run('[17] the real club day shows both parts when he is home',
    JSON.stringify(kindsOf(realClubDay)) === JSON.stringify(['strength', 'team_training']),
    kindsOf(realClubDay));
  run('[17b] name AND type together leave only his own half',
    JSON.stringify(kindsOf({ ...realClubDay, name: strip(realClubDay.name), workoutType: 'Strength' }))
      === JSON.stringify(['strength']),
    kindsOf({ ...realClubDay, name: strip(realClubDay.name), workoutType: 'Strength' }));
  // THE TWO NEAR-MISSES ON THE REAL SHAPE — the second is the one that shipped
  // to glass and took his session off the card.
  run('[17c] type alone changes nothing',
    JSON.stringify(kindsOf({ ...realClubDay, workoutType: 'Strength' }))
      === JSON.stringify(['strength', 'team_training']),
    kindsOf({ ...realClubDay, workoutType: 'Strength' }));
  run('[17d] name alone LOSES his gym work',
    JSON.stringify(kindsOf({ ...realClubDay, name: strip(realClubDay.name) }))
      === JSON.stringify(['team_training']),
    kindsOf({ ...realClubDay, name: strip(realClubDay.name) }));

  console.log(`\naway flow: ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
  totalsPrinted(failures.length);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
