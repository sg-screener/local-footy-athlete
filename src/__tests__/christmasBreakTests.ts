/**
 * THE CHRISTMAS BREAK — SEAT_INBOX ITEM 31 PART 5, RULED BY SAM ON 2026-08-13.
 *
 * **His words are the spec:** *"off season means NO team training, the christmas
 * break is essentially an off season inside pre season - there is never team
 * trainings here"*, and the build order: *"it may be helpful to add a button for
 * Christmas break and removing team training sessions from the app - maybe
 * around the 10th of December. That way an athlete can select when their last
 * team training is, and then around the 3rd of Jan they should be ask when does
 * team training go back? that way the app isn't guessing"*.
 *
 * THE PROPERTY THIS SUITE HOLDS IS THAT THE BREAK TAKES THE CLUB OFF, TAKES
 * NOTHING ELSE, AND ENDS. Four cells could each be green while the athlete gets
 * the wrong thing:
 *
 *   1. **It is asked at all.** The whole item is two QUESTIONS; a fact nobody is
 *      ever prompted for is a control the athlete has to know exists in
 *      December. Cells [1]-[3] walk the calendar, including the days the app
 *      must stay silent.
 *   2. **It is not `travel`.** Away deletes the club night AND the fixture —
 *      *"OBVIOUSLY YOU'RE NOT GOING TO BE THERE"*. Over Christmas the athlete is
 *      home, so a game he entered himself must survive. Cell [8] runs the two
 *      facts over the SAME week and fails if they agree.
 *   3. **The second answer replaces the first.** The December fact is
 *      open-ended; the January answer carries the same start. If the two landed
 *      as separate facts the club would come back on one of them and stay off on
 *      the other. Cell [5] counts facts, not effects.
 *   4. **It ends.** An open span with no way to close it is worse than no
 *      control at all — the club would be gone for good. Cells [6c] and [3] hold
 *      the end and the silence after it.
 *
 * Run: npm run test:christmas-break
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
const { useProgramStore } = require('../store/programStore') as typeof import('../store/programStore');
const { useProfileStore } = require('../store/profileStore') as typeof import('../store/profileStore');
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
  generateProgramLocally,
} = require('../services/api/generateProgram') as typeof import('../services/api/generateProgram');
const {
  getTeamTrainingWorkoutState,
} = require('../utils/teamTraining') as typeof import('../utils/teamTraining');
const {
  onboardingToCoachingInputs,
} = require('../utils/coachingEngine') as typeof import('../utils/coachingEngine');
const {
  codDecelPermitted,
} = require('../rules/conditioningSelection') as typeof import('../rules/conditioningSelection');
const {
  weekIdentityForWeekForTest,
} = require('../rules/derivedWeekContract') as any;
const {
  createTemporaryScheduleFact,
  temporaryFactScope: factScope,
} = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const {
  decideChristmasBreakAsk,
  christmasBreakDismissId,
  christmasBreakSeasonKey,
} = require('../rules/christmasBreakAsk') as typeof import('../rules/christmasBreakAsk');

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

console.log('\n-- The Christmas break (SEAT_INBOX item 31 part 5) --');

// ── THE ATHLETE THIS ITEM IS WRITTEN FOR ─────────────────────────────────────
// A pre-season club athlete with two team nights. Off-season derivation reads no
// team days at all, so an off-season athlete cannot see this control and cannot
// see this suite fail either — which is exactly what cell [1d] asserts.
const CLUB_ATHLETE = {
  todayISO: '2026-12-10',
  seasonPhase: 'Pre-season' as const,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  openBreakFromISO: null,
  answeredBreakFromISOs: [] as string[],
  dismissedIds: [] as string[],
};

// ── [1] THE DECEMBER QUESTION ────────────────────────────────────────────────
// NON-VACUITY FIRST: the same athlete on the same profile is asked on the 10th
// and not on the 9th, so "nothing is asked" below can never be true of an input
// this module simply does not understand.
run('[1] the December question is live on the 10th',
  decideChristmasBreakAsk(CLUB_ATHLETE)?.kind === 'last_team_training',
  decideChristmasBreakAsk(CLUB_ATHLETE));
run('[1b] and NOT on the 9th — the app is silent until Sam\'s date',
  decideChristmasBreakAsk({ ...CLUB_ATHLETE, todayISO: '2026-12-09' }) === null);
run('[1c] and not in August, which is eleven months of this control\'s life',
  decideChristmasBreakAsk({ ...CLUB_ATHLETE, todayISO: '2026-08-13' }) === null);

// AN OFF-SEASON ATHLETE HAS NO CLUB TO STOP. `phaseHasClubTraining` already
// decides that off-season derivation reads no team days, so asking when his club
// stops is asking about something the app has ruled does not exist.
run('[1d] an off-season athlete is never asked',
  decideChristmasBreakAsk({ ...CLUB_ATHLETE, seasonPhase: 'Off-season' }) === null);
run('[1d-ii] and neither is a pre-season athlete with no club at all',
  decideChristmasBreakAsk({ ...CLUB_ATHLETE, teamTrainingDays: [] }) === null);

// ── [1e] "WE TRAIN THROUGH CHRISTMAS" IS AN ANSWER, AND IT STICKS ────────────
// A question with no NO runs for three weeks. The negative answer is stored on
// the dismissed-id shelf this app already keeps, so it survives a relaunch
// without a new stored field.
const dismissId = christmasBreakDismissId(christmasBreakSeasonKey('2026-12-10'));
run('[1e] answering "we train through Christmas" stops the asking',
  decideChristmasBreakAsk({ ...CLUB_ATHLETE, dismissedIds: [dismissId] }) === null,
  dismissId);
run('[1e-ii] and it is keyed to THIS break, so next December asks again',
  decideChristmasBreakAsk({
    ...CLUB_ATHLETE, todayISO: '2027-12-10', dismissedIds: [dismissId],
  })?.kind === 'last_team_training');

// ── [2] THE JANUARY QUESTION ─────────────────────────────────────────────────
const OPEN_BREAK = { ...CLUB_ATHLETE, openBreakFromISO: '2026-12-19' };
run('[2] an open break is not asked about on the 21st of December',
  decideChristmasBreakAsk({ ...OPEN_BREAK, todayISO: '2026-12-21' }) === null);
run('[2b] and IS asked about on the 3rd of January — Sam\'s date',
  decideChristmasBreakAsk({ ...OPEN_BREAK, todayISO: '2027-01-03' })?.kind
    === 'team_training_returns');
// IT DOES NOT GO AWAY. An athlete who ignored it in January still has a program
// with no club in it; the question is the only thing that can end that.
run('[2c] it is STILL asked in March if it was never answered',
  decideChristmasBreakAsk({ ...OPEN_BREAK, todayISO: '2027-03-01' })?.kind
    === 'team_training_returns');
// AND IT CANNOT BE DISMISSED. The December id must not silence it, or the shelf
// that holds one decision would quietly cancel the other.
run('[2d] the December dismissal does NOT silence the January question',
  decideChristmasBreakAsk({
    ...OPEN_BREAK, todayISO: '2027-01-03', dismissedIds: [dismissId],
  })?.kind === 'team_training_returns');

// ── [3] AND WHEN BOTH HALVES ARE ANSWERED, NOTHING IS ASKED ─────────────────
run('[3] a break with an end asks nothing in January',
  decideChristmasBreakAsk({
    ...CLUB_ATHLETE, todayISO: '2027-01-03', answeredBreakFromISOs: ['2026-12-19'],
  }) === null);
run('[3b] and nothing again in December, because this season is settled',
  decideChristmasBreakAsk({
    ...CLUB_ATHLETE, todayISO: '2026-12-20', answeredBreakFromISOs: ['2026-12-19'],
  }) === null);

// ── THE STORE HALF ───────────────────────────────────────────────────────────
function profile() {
  return {
    trainingLocation: 'Commercial gym' as const,
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete' as const,
    seasonPhase: 'Pre-season' as const,
    trainingDaysPerWeek: 5,
    teamTrainingDays: ['Tuesday', 'Thursday'] as import('../types/domain').DayOfWeek[],
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as
      import('../types/domain').DayOfWeek[],
  };
}

function reset(): void {
  const now = '2026-12-10T09:00:00.000Z';
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

// Last team training Friday 2026-12-18, so the break starts Saturday the 19th;
// the club is back Monday 2027-01-12, so the last day without it is the 11th.
const LAST_TRAINING = '2026-12-18';
const BREAK_FROM = '2026-12-19';
const CLUB_BACK = '2027-01-12';
const BREAK_UNTIL = '2027-01-11';
const DECEMBER_TODAY = '2026-12-10';

const breakAction = (span: { from: string; until: string | null }, todayISO: string) => ({
  type: 'set_schedule_modifier' as const,
  source: {
    screen: 'program_tab' as const,
    surface: 'christmas_break',
    initiatedBy: 'tap' as const,
  },
  scope: 'current_week' as const,
  payload: { date: span.from, todayISO, noTeamTrainingSpan: span },
  requiresRebuild: false,
  createsActiveModifier: true,
  oneOffOnly: false,
});

function breakFacts(): any[] {
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return accepted.temporarySourceFacts.filter((fact: any) =>
    fact.factKind === 'schedule' && fact.scheduleKind === 'no_team_training');
}

async function main(): Promise<void> {
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useProfileStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
  ]);

  // ── [4] THE DECEMBER ANSWER LANDS AS ONE OPEN-ENDED FACT ──────────────────
  reset();
  const opened = await executeProgramControlActionDurably(
    breakAction({ from: BREAK_FROM, until: null }, DECEMBER_TODAY) as any,
    { todayISO: DECEMBER_TODAY },
  );
  run('the December answer commits', opened.ok === true, opened.message);
  const openFact = breakFacts()[0];
  run('[4] it is ONE no-team-training fact starting the day AFTER his last session',
    breakFacts().length === 1 && openFact?.effectiveFrom === BREAK_FROM,
    breakFacts().map((f) => ({ kind: f.scheduleKind, from: f.effectiveFrom })));
  // THE OPEN END IS THE ANSWER, NOT A GAP. Sam: *"that way the app isn't
  // guessing"*. A placeholder date here would be the guess, and it would be
  // invisible — the athlete would never learn the app had picked one.
  run('[4b] its end is OPEN, because nobody has been asked when the club is back',
    openFact?.effectiveUntil === null && openFact?.scope?.kind === 'open',
    { until: openFact?.effectiveUntil, scope: openFact?.scope });
  // AND IT TAKES NO DAY AWAY. This is the defect the away flow removed and it
  // would be just as wrong here: a day marked unavailable loses the athlete's
  // own gym session, and he trains through Christmas — only his club does not.
  run('[4c] it marks NO date unavailable — his own sessions are untouched',
    (openFact?.unavailableDates ?? []).length === 0 &&
    (openFact?.unavailableWeekdays ?? []).length === 0,
    { dates: openFact?.unavailableDates, weekdays: openFact?.unavailableWeekdays });

  // ── [5] THE JANUARY ANSWER REPLACES IT — IT DOES NOT ADD A SECOND ─────────
  // COUNTED, NOT OBSERVED. Two overlapping breaks would still LOOK right on the
  // days they agree; the number of facts is the only thing that catches it.
  const closed = await executeProgramControlActionDurably(
    breakAction({ from: BREAK_FROM, until: BREAK_UNTIL }, '2027-01-03') as any,
    { todayISO: '2027-01-03' },
  );
  run('the January answer commits', closed.ok === true, closed.message);
  run('[5] there is STILL exactly one break, now with an end',
    breakFacts().length === 1 && breakFacts()[0]?.effectiveUntil === BREAK_UNTIL,
    breakFacts().map((f) => ({ from: f.effectiveFrom, until: f.effectiveUntil })));

  // ── [6] WHAT THE SPAN COVERS, READ THROUGH THE APP'S OWN PROJECTION ───────
  // `onDate` is how every surface asks "what is active today", so reading the
  // dates back by hand would be asserting this suite's arithmetic instead of the
  // app's.
  const breakConstraintsOn = (date: string) =>
    composeTemporarySourceFactCompatibility({
      temporarySourceFacts: normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      ).temporarySourceFacts as any,
      onDate: date,
    }).activeConstraints.filter((c: any) => c.scheduleKind === 'no_team_training');
  const covers = (date: string) => breakConstraintsOn(date).length === 1;
  run('[6] the break reaches its first day', covers(BREAK_FROM));
  run('[6b] and reaches across the new year, three weeks later',
    covers('2027-01-05'), { checked: '2027-01-05' });
  run('[6c] and is GONE on the day the club is back',
    !covers(CLUB_BACK), { returnDate: CLUB_BACK });
  run('[6d] and was never live on the day of his last session',
    !covers(LAST_TRAINING), { lastTraining: LAST_TRAINING });

  // ── [7] THE ATHLETE'S WEEK — where the break has to bite ──────────────────
  //
  // A day is a team day because the PLAN says `isTeamDay`, and the plan's team
  // days are re-derived after post-generation validation runs — so the club has
  // to come off at the plan or not at all. That is the lesson item 28 paid for;
  // this suite starts where it ended.
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
  // Monday 2026-12-28 — a week wholly inside the break, with a Saturday fixture.
  const GEN_WEEK = '2026-12-28';
  const constraintOfKind = (scheduleKind: string, expiresAt: string | undefined) => [{
    id: `source-fact:schedule:gen-${scheduleKind}`,
    type: 'schedule',
    scheduleKind,
    status: 'active',
    severity: scheduleKind === 'travel' ? 7 : 5,
    startDate: BREAK_FROM,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    lastUpdatedAt: `${BREAK_FROM}T09:00:00.000Z`,
    source: 'tap',
    unavailableDates: [] as string[],
    unavailableWeekdays: [] as string[],
    modifierAffects: ['current_week'],
    rules: [], safeFocus: [], advice: [],
  }];
  const workoutsOf = (program: any): any[] => program?.microcycles?.[0]?.workouts ?? [];
  const teamDaysIn = (program: any): string[] => workoutsOf(program)
    .filter((workout: any) => getTeamTrainingWorkoutState(workout).hasTeamTraining)
    .map((workout: any) => String(workout.name));
  const rowsIn = (program: any): number => workoutsOf(program)
    .reduce((total: number, workout: any) => total + (workout.exercises ?? []).length, 0);

  const normalWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
  });
  const breakWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: constraintOfKind('no_team_training', BREAK_UNTIL) as any,
  });
  // NON-VACUITY FIRST, ALWAYS. "No team day" is trivially true of a week that
  // never had one, and that trap has already been sprung once on the away item.
  run('[7] the normal week HAS team days, so the cells below can fail',
    teamDaysIn(normalWeek).length === 2, teamDaysIn(normalWeek));
  run('[7b] a week inside the break has NO team day at all',
    teamDaysIn(breakWeek).length === 0, teamDaysIn(breakWeek));
  // AND HE STILL TRAINS. Rows, not days: two club nights leaving means fewer
  // DAYS, and counting days would make "he lost a session" the law when what he
  // lost was two nights at a club that is shut.
  //
  // **NOT EQUALITY, AND THE FIRST VERSION OF THIS CELL GOT THAT WRONG.** It
  // asserted the row count was IDENTICAL, borrowed from the away suite, and
  // reddened on correct behaviour: 21 rows normally, 23 over the break. A day
  // that was "Strength + Team Training" becomes a full standalone strength day
  // once the club half is gone, and a full day carries more work than the
  // truncated one beside a team night — the Bible's own reason team training
  // displaces gym volume. **Away measured equal only because it ALSO deletes the
  // fixture, which reshapes the week the other way.** The honest property is
  // that nothing of his is LOST.
  run('[7c] and not one row of his own training is lost to the break',
    rowsIn(breakWeek) >= rowsIn(normalWeek),
    { normal: rowsIn(normalWeek), broken: rowsIn(breakWeek) });

  // ── [8] AND THE GAME SURVIVES — THE ONE THING AWAY DOES NOT DO ───────────
  //
  // THE CELL THAT MAKES THIS A DIFFERENT FACT AND NOT A SECOND SPELLING OF
  // `travel`. Sam ruled the fixture off for a TRIP — ***"yes it should disappear
  // OBVIOUSLY YOU'RE NOT GOING TO BE THERE"*** — and the reason he gave is
  // absence, not the club's calendar. Over Christmas he is at home, and a game
  // he typed in himself is his own fact. If this suite ever agrees with the
  // travel arm below, the break has been folded back into away.
  // ⚠ MEASURED AT THE WEEK-IDENTITY SEAM, AND THE FIRST VERSION OF THIS CELL WAS
  // NOT. It compared `workoutType: 'Game'` rows out of `generateProgramLocally`,
  // and the non-vacuity control caught it immediately: the NORMAL week has none
  // either. A profile's `gameDay` is an anchor, not a fixture — a fixture is a
  // day the athlete MARKED, and `weekIdentityForWeek` is the owner that reads
  // marked days against the live facts. That is where away drops a fixture
  // (`derivedWeekContract` reads travel spans and only travel spans), so it is
  // the only place the difference can be seen. **Without the control cell, "a
  // trip deletes the game" would have shipped green over a week that never had
  // one.**
  const identity = (facts: any[]) => weekIdentityForWeekForTest({
    profile: genProfile,
    weekStart: GEN_WEEK,
    markedDays: { '2027-01-02': 'game' },
    storedMode: 'in_season_game_week',
    temporarySourceFacts: facts,
  });
  const travelFact = createTemporaryScheduleFact({
    observedDate: BREAK_FROM,
    scope: factScope({ kind: 'window', from: BREAK_FROM, until: BREAK_UNTIL }),
    scheduleKind: 'travel',
    unavailableDates: [],
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
  });
  const christmasFact = createTemporaryScheduleFact({
    observedDate: BREAK_FROM,
    scope: factScope({ kind: 'window', from: BREAK_FROM, until: BREAK_UNTIL }),
    scheduleKind: 'no_team_training',
    unavailableDates: [],
    sourceActor: 'athlete',
    sourceSurface: 'christmas_break',
  });
  run('[8] the week HAS a fixture before either fact exists',
    identity([]).anchorState === 'game', identity([]));
  run('[8b] a trip takes it away — the behaviour item 28 ruled',
    identity([travelFact]).anchorState === 'bye', identity([travelFact]));
  run('[8c] the Christmas break KEEPS it — he is home, it is his fixture',
    identity([christmasFact]).anchorState === 'game', identity([christmasFact]));

  // ── [9] AN OPEN BREAK STILL REACHES THE WEEK ─────────────────────────────
  // `awaySpansFromConstraints` SKIPS a constraint with no end, on purpose — an
  // endless trip would take the club off forever. The break's reader must not
  // copy that rule, or every week between the December answer and the January
  // one would still have team training in it, which is the whole month the
  // control exists for.
  const openBreakWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: constraintOfKind('no_team_training', undefined) as any,
  });
  run('[9] a break with no end yet still takes the club off this week',
    teamDaysIn(openBreakWeek).length === 0, teamDaysIn(openBreakWeek));

  // ── [9b] THE WHOLE CHAIN, FROM THE ATHLETE'S TAP TO HIS WEEK ─────────────
  //
  // EVERY CELL ABOVE HOLDS ONE LINK AND NONE HOLDS THE JOIN. [4]-[6] go from the
  // executor to the projection; [7]-[9] go from a HAND-BUILT constraint to the
  // week. A break that committed correctly and generated correctly could still
  // give the athlete nothing if the projection's output does not match the shape
  // the generator's reader looks for — green cells either side of a seam nobody
  // walks. So this one starts at the stored fact, takes the constraints the app
  // itself publishes, and hands exactly those to generation.
  reset();
  const chainCommit = await executeProgramControlActionDurably(
    breakAction({ from: BREAK_FROM, until: BREAK_UNTIL }, DECEMBER_TODAY) as any,
    { todayISO: DECEMBER_TODAY },
  );
  run('the chain\'s answer commits', chainCommit.ok === true, chainCommit.message);
  const publishedConstraints = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext,
    ).temporarySourceFacts as any,
    onDate: GEN_WEEK,
  }).activeConstraints;
  // NON-VACUITY: an empty constraint list would make the cell below trivially
  // true of a world with no break in it at all.
  run('[9b] the app publishes a no-team-training constraint from the stored fact',
    publishedConstraints.some((c: any) => c.scheduleKind === 'no_team_training'),
    publishedConstraints.map((c: any) => c.scheduleKind));
  const chainWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: publishedConstraints as any,
  });
  run('[9c] and a week built from THOSE constraints has no team day',
    teamDaysIn(chainWeek).length === 0, teamDaysIn(chainWeek));

  // ── [10e] ITEM 30's OPEN DEFECT, ASKED OF THIS UNIT ──────────────────────
  //
  // **THE ONE OPEN DEFECT ON THE AWAY HALF IS SESSION REUSE**, found on a phone
  // and archived in `docs/AWAY_FLOW_BOUNDARY_2026-08-13.md`: a REGENERATED week
  // is built with `previousProgram`, and a carried-over session keeps its old
  // name — *"+ Team Training"* included — so a team night appears on a day the
  // plan never marked.
  //
  // **EVERY CELL ABOVE GENERATES A FRESH WEEK, SO NONE OF THEM COULD SEE IT.**
  // That is exactly the shape of a suite that is green about a defect it cannot
  // reach, so the question is asked here rather than assumed away: does the
  // Christmas break inherit item 30's leak?
  const reusedWeek = generateProgramLocally(genProfile, {
    todayISO: GEN_WEEK, blockNumber: 1, microcycleLimit: 1,
    activeConstraints: constraintOfKind('no_team_training', BREAK_UNTIL) as any,
    previousProgram: normalWeek as any,
  });
  const namesIn = (program: any): string[] => workoutsOf(program)
    .map((workout: any) => String(workout.name ?? ''));
  // NON-VACUITY: the week it is rebuilt FROM must actually carry the words, or
  // "no team training in the names" is true of a program that never had them.
  run('[10e] the week being rebuilt from DOES name team training',
    namesIn(normalWeek).some((name) => /team training/i.test(name)),
    namesIn(normalWeek));
  run('[10f] and a break week rebuilt from it carries no team night forward',
    !namesIn(reusedWeek).some((name) => /team training/i.test(name)),
    namesIn(reusedWeek));
  run('[10g] and no reused session claims a team day the plan did not mark',
    teamDaysIn(reusedWeek).length === 0, teamDaysIn(reusedWeek));
  // ⚠ **WHAT THESE THREE CELLS DO NOT SAY.** They exercise FULL generation with
  // `previousProgram`, and item 30's leak was seen on a PHONE through the SCOPED
  // REGEN path. The away boundary report already measured why no node harness
  // reaches it: *"the scoped regen never fires there, because that harness has
  // no microcycles to regen into (`canScopedRegen`)"*. **So the honest reading
  // is "the break does not leak on the path this suite can reach", NOT "the
  // break is immune."** The scoped-regen path is UNMEASURED for both facts, and
  // it belongs to item 30, which owns the leak for away and now for this too.

  // ── [11] IT REACHES THE COD GATE — ITEM 31's LAST OPEN LINE ──────────────
  //
  // The terminal built parts 1-4 and left one sentence: ***"STILL OPEN: the week
  // fact itself is profile-derived until part 5's dated span exists (desktop
  // agent)"***. Part 5 exists. **THIS IS THE MEASUREMENT OF WHETHER THAT CLOSED
  // IT, not a claim that it did** — the span could exist and still not reach
  // either reader, which is the whole "built and disconnected" shape.
  //
  // BOTH READERS, because part 4's own finding was ***"THE WRONG INPUT WAS IN
  // TWO PLACES"***. They read different things and both have to be right:
  //   · the engine asks `inputs.teamTrainingDays.length > 0`
  //   · the plan asks `weeklyPlan.some((entry) => entry.isTeamDay)`
  // A cell on one of them would pass while the other stayed profile-derived.
  const inputsFor = (spans: { from: string; until: string | null }[] | undefined) =>
    onboardingToCoachingInputs({ ...genProfile, seasonPhase: 'Pre-season' } as any, {
      availabilityDateISO: GEN_WEEK,
      noTeamTrainingSpans: spans,
    } as any);
  const codPermittedFor = (spans: { from: string; until: string | null }[] | undefined) =>
    codDecelPermitted({
      weekHasTeamTraining: (inputsFor(spans).teamTrainingDays?.length ?? 0) > 0,
      seasonPhase: 'Pre-season',
      offseasonSubphase: null,
    });
  // NON-VACUITY: the club athlete with no break is REFUSED COD, so "permitted"
  // below is the break's doing and not this phase's.
  run('[11] a pre-season club athlete with no break is refused COD',
    codPermittedFor(undefined) === false,
    { teamDays: inputsFor(undefined).teamTrainingDays });
  run('[11b] and the SAME athlete inside the break is permitted it',
    codPermittedFor([{ from: BREAK_FROM, until: BREAK_UNTIL }]) === true,
    { teamDays: inputsFor([{ from: BREAK_FROM, until: BREAK_UNTIL }]).teamTrainingDays });
  // THE OTHER READER — the plan's own team days, which is what `defaultProgram`
  // asks. `breakWeek` and `normalWeek` are the generated weeks from [7].
  run('[11c] and the PLAN reader agrees — no team day for the gate to see',
    teamDaysIn(normalWeek).length > 0 && teamDaysIn(breakWeek).length === 0,
    { normal: teamDaysIn(normalWeek), broken: teamDaysIn(breakWeek) });

  // ── [10] THE TWO QUESTIONS ARE ON GLASS ──────────────────────────────────
  // SOURCE-PINNED, because a rule module that decides which question is live is
  // worth nothing if no screen mounts it. These are the same shape as the away
  // flow's [5]: they name the wiring, not the behaviour, and they exist because
  // the behaviour above is all reachable without a single pixel.
  const screen = fs.readFileSync(
    path.join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
  run('[10] the Program screen mounts the ask',
    /testID="home-christmas-break-ask"/.test(screen) &&
    /christmasBreakAsk && \(/.test(screen));
  run('[10b] it asks Sam\'s two questions in his words',
    /When is your last team training\?/.test(screen) &&
    /When does team training go back\?/.test(screen));
  // THE DISMISSAL IS ON THE DECEMBER HALF ONLY. Dismissing the January question
  // would strand a break the athlete already declared, with nothing left in the
  // app able to end it.
  const dismissAt = screen.indexOf('home-christmas-break-dismiss');
  const dismissGate = dismissAt >= 0
    ? screen.slice(Math.max(0, dismissAt - 400), dismissAt)
    : '';
  run('[10c] only the December question can be dismissed',
    dismissAt >= 0 && /christmasBreakAsk\.kind === 'last_team_training'/.test(dismissGate));
  // AND THE SHEET DOES THE OFF-BY-ONE, both directions, in one place.
  run('[10d] the sheet turns his two dates into the days with no club',
    /from: addDaysISO\(dateISO, 1\), until: null/.test(screen) &&
    /until: addDaysISO\(dateISO, -1\)/.test(screen));

  console.log(`\nchristmas break: ${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
  totalsPrinted(failures.length);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
