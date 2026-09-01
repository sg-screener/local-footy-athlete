/** Focused boundary for Sam's eleven-item 2026-09-01 programming correction. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} };

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  annualFootballPhaseForIndex, annualFootballPhaseWeek, ANNUAL_FOOTBALL_PHASE_WEEKS,
} from '../rules/annualFootballPhaseCalendar';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { formatExerciseDisplayName } from '../utils/exerciseDisplay';
import {
  formatLoadControlLabel, formatLoadLabel, resolveLoadAuthority, resolveLoadControlMode,
} from '../utils/loadEstimation';
import { resolveComposedDose } from '../rules/composedDose';
import { scheduleRefused, scheduleWeek } from '../rules/weeklyScheduler';
import { PURPOSE_IS_LOWER } from '../rules/weeklyProgrammingContract';
import {
  onboardingChristmasBreakClosesDate, onboardingChristmasBreakSpan,
} from '../rules/christmasBreakAsk';
import { canonicalWeeklyAvailabilityStateFrom } from '../rules/canonicalWeeklyAvailabilityState';
import { athleteAnswers } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { getTeamTrainingWorkoutState } from '../utils/teamTraining';
import { generateProgramLocally } from '../services/api/generateProgram';
import { slotDayKindForPatterns, slotsFilledByRow } from '../rules/sessionSlotCoverage';
import { sessionHasExerciseVariationCollision } from '../rules/exerciseVariationFamily';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function check(label: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${label}`); return; }
  failures.push(label);
  console.error(`  FAIL ${label}${detail === undefined ? '' : `\n    ${JSON.stringify(detail)}`}`);
}

const root = path.resolve(__dirname, '..', '..');

async function main(): Promise<void> {
  console.log('\n[1-5] Exact rule and display boundaries');
  check('1: all four opening weeks remain Off-season',
    [0, 1, 2, 3].every(index => annualFootballPhaseForIndex(index) === 'Off-season'));
  check('2: Crab Hold has neither a BW card label nor a BW load control',
    formatLoadLabel(resolveLoadAuthority('Crab Hold'), null) === '-'
      && formatLoadControlLabel(resolveLoadControlMode('Crab Hold'), null) === '');

  const yearDriver = fs.readFileSync(path.join(root, 'scripts', 'programming-remediation-year.cjs'), 'utf8');
  const pdfBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-full-year-pdfs.py'), 'utf8');
  check('3: full-year export carries metadata-backed main muscles and its PDF column',
    /mainMuscles:\[\.\.\./.test(yearDriver)
      && /kind==='team_training'.*mainMuscles:\[\]/.test(yearDriver)
      && /Main muscles/.test(pdfBuilder));

  check('4: Swiss Ball Hamstring Curl is automatic only through consistent experience',
    ['Complete beginner', '<1 year', '1-2 years'].every(experienceLevel =>
      exerciseProgrammingAllows('Swiss Ball Hamstring Curl', {
        route: 'automatic', experienceLevel: experienceLevel as never, daysToGame: null,
      }))
      && !exerciseProgrammingAllows('Swiss Ball Hamstring Curl', {
        route: 'automatic', experienceLevel: '5+ years', daysToGame: null,
      })
      && exerciseProgrammingAllows('Swiss Ball Hamstring Curl', {
        route: 'manual', experienceLevel: '5+ years', daysToGame: null,
      }));
  check('5: approved abbreviations stay fully capitalised together',
    formatExerciseDisplayName('sl ql db rdls iso hold') === 'SL QL DB RDLs ISO Hold');

  console.log('\n[6] Final automatic upper sessions');
  const upperProfile = athleteAnswers({
    id: 'eleven-upper', gender: 'male', days: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    experience: '5+ years', equipment: 'commercial', initialPhase: 'Pre-season',
    clubDays: [], gameDay: null, extraGame: false,
  });
  upperProfile.equipmentAnswer = presetEquipmentAnswer('commercial_gym', '2026-11-16');
  upperProfile.teamTrainingDays = [];
  upperProfile.teamTrainingDaysPerWeek = 0;
  upperProfile.teamTrainingStopsOverChristmas = false;
  const upperProgram = generateProgramLocally(upperProfile, {
    todayISO: '2026-11-16', blockNumber: 1, microcycleLimit: 1,
  });
  const upperDays = (upperProgram?.microcycles[0]?.workouts ?? []).filter(workout =>
    slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? [])?.startsWith('upper'));
  const upperEvidence = upperDays.map(workout => {
    const rows = workout.exercises ?? [];
    const support = rows.filter(row => row.section18Evidence?.role !== 'main_strength');
    return {
      name: workout.name,
      push: support.some(row => slotsFilledByRow(row).some(slot => slot.startsWith('push_accessory'))),
      pull: support.some(row => slotsFilledByRow(row).some(slot => slot.startsWith('pull_accessory'))),
      collision: sessionHasExerciseVariationCollision(rows.map(row => row.exercise?.name ?? '')),
      rows: rows.map(row => row.exercise?.name),
    };
  });
  check('6: every reached upper session has push/pull variety and no repeated family',
    upperEvidence.length > 0 && upperEvidence.every(day => day.push && day.pull && !day.collision),
    upperEvidence);

  console.log('\n[7-8,10] Calendar and four-session delivery');
  check('7: actual phase shifts are mid-November and late March',
    ANNUAL_FOOTBALL_PHASE_WEEKS['Off-season'] === 7
      && ANNUAL_FOOTBALL_PHASE_WEEKS['Pre-season'] === 19
      && annualFootballPhaseForIndex(7) === 'Pre-season'
      && annualFootballPhaseWeek(7) === 1
      && annualFootballPhaseForIndex(26) === 'In-season'
      && annualFootballPhaseWeek(26) === 1);
  for (const phase of ['Off-season', 'Pre-season'] as const) {
    const scheduled = scheduleWeek({
      weekStartISO: '2026-11-16', phase,
      offseasonBlock: phase === 'Off-season' ? 'normal_build' : null,
      gymAccessDays: [1, 2, 4, 5], clubNights: [], gameDay: null, gameDays: [],
      fixtureRecurrence: 'recurring',
      age: 24, readiness: { lowReadiness: false, highReadiness: true,
        lowFatigue: true, consistentlyCompletesThree: true }, unavailableDays: [],
    });
    const sequence = scheduleRefused(scheduled) ? [] : scheduled.days
      .filter(day => day.owner === 'strength')
      .map(day => PURPOSE_IS_LOWER[day.purpose!] ? 'Lower' : 'Upper');
    check(`8: ${phase} delivers Lower-Upper-Lower-Upper`,
      sequence.join('-') === 'Lower-Upper-Lower-Upper', sequence);
  }
  check('10: audit accepted club days change by phase',
    /phase==='Pre-season'\?\['Monday','Wednesday'\]:\['Tuesday','Thursday'\]/.test(yearDriver));

  console.log('\n[9] Pre-season setup, delivered week and restart');
  const breakProfile = athleteAnswers({
    id: 'eleven-christmas', gender: 'female',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    experience: '2-5 years', equipment: 'commercial', initialPhase: 'Pre-season',
    clubDays: ['Monday', 'Wednesday'], gameDay: null, extraGame: false,
  });
  Object.assign(breakProfile, {
    firstName: 'Christmas setup',
    equipmentAnswer: presetEquipmentAnswer('commercial_gym', '2026-12-21'),
    teamTrainingStopsOverChristmas: true,
    christmasLastTeamTrainingDate: '2026-12-18',
    christmasTeamTrainingReturnDate: '2027-01-12',
  });
  const breakSpan = onboardingChristmasBreakSpan(breakProfile);
  check('9: setup dates own the exact closed interval',
    breakSpan?.from === '2026-12-19' && breakSpan.until === '2027-01-11'
      && onboardingChristmasBreakClosesDate(breakProfile, '2027-01-05')
      && !onboardingChristmasBreakClosesDate(breakProfile, '2027-01-12'), breakSpan);
  const availability = canonicalWeeklyAvailabilityStateFrom({
    profile: breakProfile, weekStartISO: '2026-12-21', activeConstraints: [],
  });
  check('9: canonical weekly owner closes both accepted club weekdays',
    availability.clubClosedDayNumbers.includes(1)
      && availability.clubClosedDayNumbers.includes(3), availability.clubClosedDayNumbers);
  const install = await quietAsync(() => coldStartThroughOnboarding({
    profile: breakProfile, installDayISO: '2026-12-21',
  }));
  check('9: setup profile crosses real onboarding', !install.onboardingRefusal,
    install.onboardingRefusal);
  const installedTeamCounts = install.program.microcycles.slice(0, 4).map(microcycle =>
    microcycle.workouts.filter(workout => getTeamTrainingWorkoutState(workout).hasTeamTraining).length);
  check('9: Christmas weeks remove club sessions and the return week restores them',
    installedTeamCounts.slice(0, 3).every(count => count === 0)
      && installedTeamCounts[3] > 0, installedTeamCounts);
  const read = () => quiet(() => deriveVisibleWeekLive('2026-12-21', '2026-12-21'));
  const beforeRestart = visibleSignature(read());
  const restarted = await quietAsync(() => relaunchApp({ storage, todayISO: '2026-12-21' }));
  check('9: save/restart reconstructs the identical athlete-facing break week',
    restarted.ok && visibleSignature(read()) === beforeRestart, restarted.error);

  console.log('\n[11] Bible-owned in-season RDL dose');
  const inSeasonRdl = resolveComposedDose({
    identity: 'RDLs', isMainLift: false, poolSlot: 'hinge', selectionSlot: 'hinge',
    seasonPhase: 'In-season', offseasonSubphase: null, authoredFallback: [3, 6, 8],
  });
  const singleLegRdl = resolveComposedDose({
    identity: 'Single-Leg RDL', isMainLift: false, poolSlot: 'hinge',
    selectionSlot: 'single_leg_hip', seasonPhase: 'In-season', offseasonSubphase: null,
    authoredFallback: [3, 6, 8],
  });
  check('11: bilateral in-season RDLs use the Bible lower-main 2-4 rep band',
    inSeasonRdl.sets >= 2 && inSeasonRdl.sets <= 4
      && inSeasonRdl.repsMin === 2 && inSeasonRdl.repsMax === 4, inSeasonRdl);
  check('11: the separate Single-Leg RDL rule is not overwritten',
    singleLegRdl.repsMin === 6 && singleLegRdl.repsMax === 8, singleLegRdl);

  const total = passed + failures.length;
  console.log(`\nEleven-item focused boundary: passed=${passed}/${total} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length) process.exit(1);
}

main().catch(error => { console.error(error); totalsPrinted(1); process.exit(1); });
