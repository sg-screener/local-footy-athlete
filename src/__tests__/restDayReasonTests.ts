/**
 * R-379 — WHY AN EMPTY DAY IS EMPTY, AS THE ATHLETE READS IT.
 *
 * **Sam, 2026-09-05:** *"put it on the day … it should replace fresh up, adapt
 * go again - when it's needed"*, and *"it should not include any fuckign M
 * dashes"*.
 *
 * These cells hold the four things that make it true rather than merely built:
 * the sentence REPLACES the standing line instead of stacking with it, an
 * ordinary rest day is untouched, a day that got filled after the fact stops
 * explaining itself as empty, and the copy carries no em dash.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} };
(global as unknown as { fetch: () => never }).fetch = () => { throw Error('No network in rest-day journeys'); };
process.env.TZ = 'Australia/Melbourne';

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { transform } from 'sucrase';
import { sourceMutation } from './support/sourceMutation';
import { finalProgramSignature } from './compilerYear/finalRows';
import { coldStartThroughOnboarding, setJourneyClock, quiet, quietAsync, relaunchApp, recordDay } from './support/athleteJourney';
import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { buildProgramTabProjectedWeek, buildDayWorkoutProjectedDay } from '../utils/visibleProgramReadModel';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { snapshotSemanticWorkout } from '../utils/programSemanticSnapshot';
import {
  ALL_REST_DAY_REASONS,
  REST_DAY_REASON_COPY_ID,
  restDayReasonsForWeek,
  type RestDayReason,
} from '../rules/restDayReason';
import { signedCopy } from '../rules/signedCopy';
import { registerProjectionCopy } from '../rules/projectionCopy';

// The sheet is registered on demand, the same way every production reader
// gets it. Without this the ids are genuinely absent and cell [1] would red
// for the harness's reason rather than the app's.
registerProjectionCopy();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`);
}

console.log('\n── R-379: the empty day says why ──');

// ── 1. EVERY REASON HAS A SENTENCE, AND IT IS A REAL ONE. ────────────────────
// A copy id that resolves to nothing would render an empty line in place of the
// standing one, which is worse than not shipping the feature at all.
for (const reason of ALL_REST_DAY_REASONS) {
  const text = signedCopy(REST_DAY_REASON_COPY_ID[reason]);
  ok(`[1] "${reason}" resolves to a real sentence`,
    typeof text === 'string' && text.trim().length > 0 && !text.includes('.reason.'),
    `got ${JSON.stringify(text)}`);
}

// ── 2. NO EM DASHES. Sam's rule, held against the character itself. ──────────
// The en dash and the double hyphen he also called out are refused with it: he
// objected to the punctuation, not to one codepoint.
for (const reason of ALL_REST_DAY_REASONS) {
  const text = String(signedCopy(REST_DAY_REASON_COPY_ID[reason]));
  ok(`[2] "${reason}" carries no em dash`,
    !text.includes('—') && !text.includes('–') && !text.includes('--'),
    `got ${JSON.stringify(text)}`);
}
ok('[2] the standing rest line carries no em dash either',
  !String(signedCopy('day.rest.default')).includes('—'));

// ── 3. THE LOOKUP READS THE STORED WEEK AND INVENTS NOTHING. ─────────────────
const program = {
  microcycles: [
    { startDate: '2026-09-28T12:00:00.000Z', restDayReasonByDay: { 4: 'injury' as RestDayReason } },
    { startDate: '2026-10-05T12:00:00.000Z', restDayReasonByDay: {} },
  ],
};
ok('[3] the week\'s own reasons are found by its Monday',
  restDayReasonsForWeek(program, '2026-09-28')[4] === 'injury');
ok('[3] a different week does not inherit them',
  restDayReasonsForWeek(program, '2026-10-05')[4] === undefined);
ok('[3] an unknown week answers empty, never undefined',
  JSON.stringify(restDayReasonsForWeek(program, '2026-11-30')) === '{}');
ok('[3] no program answers empty rather than throwing',
  JSON.stringify(restDayReasonsForWeek(null, '2026-09-28')) === '{}');

// The reason and workout have the same sparse date ownership.
const sparse = { workoutsByDate: { '2026-10-02': null }, restDayReasonByDay: { 5: 'away' as RestDayReason } };
ok('a sparse overlay preserves the earlier base cause and supplies its own date',
  restDayReasonsForWeek(program, '2026-09-28', sparse)[4] === 'injury'
    && restDayReasonsForWeek(program, '2026-09-28', sparse)[5] === 'away');
ok('an owned date with no cause clears its old explanation',
  restDayReasonsForWeek(program, '2026-09-28', { workoutsByDate: { '2026-10-01': null } })[4] === undefined);

// The actual leaf rendered by HomeScreenV2, with only the native Text host
// substituted. No replica of its copy selection and no screenshots.
const componentFile = join(__dirname, '../screens/home/HomeRestDayReason.tsx');
function renderLine(reason?: RestDayReason): string {
  const Module = require('module');
  const loaded = new Module(componentFile, module);
  loaded.filename = componentFile;
  loaded.paths = Module._nodeModulePaths(dirname(componentFile));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name: string) => name === 'react-native' ? { Text: 'Text' } : originalRequire(name);
  loaded._compile(transform(readFileSync(componentFile, 'utf8'), {
    transforms: ['typescript', 'imports', 'jsx'], filePath: componentFile,
  }).code, componentFile);
  const element = loaded.exports.HomeRestDayReason({ reason });
  ok('the actual screen component supplies its accessible test identity',
    element.props.testID === 'home-rest-day-reason');
  return element.props.children;
}
const card = readFileSync(join(__dirname, '../screens/home/HomeScreenV2.tsx'), 'utf8');
const branch = card.indexOf('{dayShape && isSelected && !hasWorkout && normal && (');
const component = card.indexOf('<HomeRestDayReason reason={day.restReason}');
const addButton = card.indexOf("label={signedCopy('day.add_session.action')}", component);
ok('the expanded empty-day branch mounts the real explanation before Add',
  branch >= 0 && component > branch && addButton > component);
ok('ordinary rest renders the standing line', renderLine() === signedCopy('day.rest.default'));
ok('the injury line uses the exact approved body-neutral wording',
  renderLine('injury') === 'No session today while you recover from injury.');
ok('the game line uses the exact approved date-neutral wording',
  renderLine('game_proximity') === 'Kept clear to help you stay fresh for your game.');
ok('the fatigue line uses the exact approved recovery wording',
  renderLine('fatigue') === 'No session today. Take the day to recover.');
for (const reason of ALL_REST_DAY_REASONS) {
  ok(`the actual screen renders only the ${reason} explanation`,
    renderLine(reason) === signedCopy(REST_DAY_REASON_COPY_ID[reason]));
}

async function journey(check: typeof ok = ok): Promise<void> {
  storage.clear();
  const monday = '2026-07-13';
  const wednesday = '2026-07-15';
  await quietAsync(() => coldStartThroughOnboarding({
    profile: profileForDevE2ESeed('empty-day-reason-showcase'), installDayISO: monday,
  }));
  const screen = (today: string) => quiet(() => buildProgramTabProjectedWeek({
    mondayISO: monday, todayISO: today, state: buildScheduleStateImperative(),
  }));
  const injuryIds: string[] = [];
  const report = async (area: 'shoulder' | 'hamstring', date: string) => {
    setJourneyClock(date);
    const constraint = buildGuidedInjuryConstraint({
      region: area === 'shoulder' ? 'upper_body' : 'lower_body', area, severity: 9,
      severityBand: 'avoid', adjustmentLevel: 'training_paused', seriousSymptoms: false,
      triggers: area === 'shoulder' ? ['Pressing'] : ['Sprinting', 'Running'],
    }, { todayISO: date });
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_injury_modifier', source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint }, requiresRebuild: false,
      createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: date }));
    check(`${area} accepted through the screen's injury door`, result.ok);
    injuryIds.push(...(result.createdModifierIds ?? []));
  };
  await report('shoulder', monday);
  await quietAsync(() => recordDay(monday, { record: true, completion: 'full', feeling: 'good', soreness: 'mild', difficulty: 6, logWeights: true }));
  const past = JSON.stringify(screen(monday).filter(day => day.date < wednesday)
    .map(day => snapshotSemanticWorkout(day.date, day.workout)));
  await report('hamstring', wednesday);
  const before = screen(wednesday);
  const empty = before.filter(day => !day.workout && day.restReason === 'injury');
  check('the real reported injuries reach an empty Thursday, not a surviving session',
    empty.some(day => day.date === '2026-07-16'), JSON.stringify(before.map(day =>
      [day.date, day.workout?.name, day.restReason])));
  check('filled and ordinary rest days do not claim injury emptiness',
    before.every(day => !day.workout || day.restReason === undefined)
      && before.find(day => day.date === '2026-07-19')?.restReason === undefined);
  check('completed and earlier days survive the forward-only report',
    past === JSON.stringify(before.filter(day => day.date < wednesday)
      .map(day => snapshotSemanticWorkout(day.date, day.workout))));
  const signature = (days: typeof before) => finalProgramSignature(days.map(day =>
    [day.date, snapshotSemanticWorkout(day.date, day.workout), day.restReason, !day.workout ? renderLine(day.restReason) : null]));
  check('the Program screen and shared live week agree',
    signature(before) === signature(quiet(() => deriveVisibleWeekLive(monday, wednesday))));
  const single = quiet(() => buildDayWorkoutProjectedDay({ date: '2026-07-16', todayISO: wednesday,
    state: buildScheduleStateImperative() }));
  check('the opened date reads the same empty-day explanation', single.restReason === 'injury' && !single.workout);
  const expected = signature(before);
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: wednesday }));
  check('reopening reconstructs the same dates, work and rendered explanation',
    boot.ok && expected === signature(screen(wednesday)));
  check('both injury facts have an identity for the real Clear door', injuryIds.length === 2);
  for (const episodeId of injuryIds) {
    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_injury_modifier', source: { screen: 'program_tab', surface: 'my_status', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId }, requiresRebuild: false,
      createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: wednesday }));
    check('the injury Clear answer commits', cleared.ok);
  }
  const restored = screen(wednesday).find(day => day.date === '2026-07-16');
  check('clearing the injuries fills the affected day and removes its stale reason',
    !!restored?.workout && restored.restReason === undefined);
  const clearedSignature = signature(screen(wednesday));
  const clearedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: wednesday }));
  check('the filled day remains free of an empty-day explanation after another reopen',
    clearedBoot.ok && clearedSignature === signature(screen(wednesday)));
}

async function fatigueJourney(gender: 'male' | 'female', check: typeof ok = ok): Promise<void> {
  storage.clear();
  const monday = '2026-07-13';
  await quietAsync(() => coldStartThroughOnboarding({
    profile: { ...profileForDevE2ESeed('empty-day-reason-showcase'), gender }, installDayISO: monday,
  }));
  await quietAsync(() => recordDay(monday, { record: true, completion: 'full', feeling: 'good', soreness: 'mild', difficulty: 6, logWeights: true }));
  const screen = (today: string) => quiet(() => buildProgramTabProjectedWeek({
    mondayISO: monday, todayISO: today, state: buildScheduleStateImperative(),
  }));
  const before = screen(monday);
  const target = before.find(day => day.date >= '2026-07-15' && (day.workout?.exercises.length ?? 0) > 0);
  check(`${gender}: fatigue reaches an actual later session after recorded Monday`, !!target);
  if (!target) return;
  const date = target.date;
  setJourneyClock(date);
  const ids: string[] = [];
  for (const level of ['not_right', 'cooked'] as const) {
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_fatigue_status', source: { screen: 'program_tab', surface: 'how_are_you_feeling', initiatedBy: 'tap' },
      scope: 'today_only', payload: { date, todayISO: date, level }, requiresRebuild: false,
      createsActiveModifier: true, oneOffOnly: false,
    }, { todayISO: date }));
    check(`${gender}: ${level} commits through the real readiness door`, result.ok);
    ids.push(...(result.createdModifierIds ?? []));
    const day = screen(date).find(item => item.date === date);
    check(`${gender}: ${level} explains rest only when the session was removed`, level === 'cooked'
      ? !!day && !day.workout && day.restReason === 'fatigue' && renderLine(day.restReason) === 'No session today. Take the day to recover.'
      : !!day?.workout && day.restReason === undefined);
  }
  const signature = (days: typeof before) => finalProgramSignature(days.map(day =>
    [day.date, snapshotSemanticWorkout(day.date, day.workout), day.restReason, !day.workout ? renderLine(day.restReason) : null]));
  const after = screen(date);
  check(`${gender}: fatigue preserves completed, other training and ordinary rest days`,
    signature(before.filter(day => day.date !== date)) === signature(after.filter(day => day.date !== date)));
  const single = quiet(() => buildDayWorkoutProjectedDay({ date, todayISO: date, state: buildScheduleStateImperative() }));
  check(`${gender}: the opened date and live week share the fatigue explanation`,
    single.restReason === 'fatigue' && !single.workout && signature(after) === signature(quiet(() => deriveVisibleWeekLive(monday, date))));
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
  check(`${gender}: fatigue rest and its rendered explanation survive reopening`, boot.ok && signature(after) === signature(screen(date)));
  check(`${gender}: both fatigue answers have clearable identities`, ids.length === 2);
  for (const modifierId of ids) {
    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status', source: { screen: 'program_tab', surface: 'my_status', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { modifierId }, requiresRebuild: false,
      createsActiveModifier: false, oneOffOnly: false,
    }, { todayISO: date }));
    check(`${gender}: the fatigue answer clears`, result.ok);
  }
  const restored = screen(date).find(day => day.date === date);
  check(`${gender}: recovery restores the session and clears the fatigue explanation`,
    !!restored?.workout && restored.restReason === undefined);
  const recovered = signature(screen(date));
  const recoveredBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
  check(`${gender}: recovered work remains free of stale explanations after reopening`, recoveredBoot.ok && recovered === signature(screen(date)));
}

async function awayJourney(withTeamNights = false, check: typeof ok = ok): Promise<void> {
  storage.clear();
  const monday = '2026-07-13';
  await quietAsync(() => coldStartThroughOnboarding({
    profile: { ...profileForDevE2ESeed('empty-day-reason-showcase'), ...(withTeamNights ? {
      trainingDaysPerWeek: 2 as const, preferredTrainingDays: ['Monday', 'Friday'] as ('Monday' | 'Friday')[],
      // Reach both an emptied former club date and a legal solo replacement after travel.
      teamTrainingDaysPerWeek: 2 as const, teamTrainingDays: ['Thursday', 'Sunday'] as ('Thursday' | 'Sunday')[],
    } : {}) }, installDayISO: monday,
  }));
  const screen = () => quiet(() => buildProgramTabProjectedWeek({
    mondayISO: monday, todayISO: monday, state: buildScheduleStateImperative(),
  }));
  const before = screen();
  check('the travel journey reaches a real Saturday game before leaving',
    before.some(day => day.date === '2026-07-18' && day.source === 'game'));
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_schedule_modifier', source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
    scope: 'current_week', payload: { awaySpan: { from: monday, until: '2026-07-19' },
      awayEquipment: { tags: [], conditioningModalities: [] }, date: monday, todayISO: monday },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  }, { todayISO: monday }));
  check('the real travel answer commits', result.ok);
  if (withTeamNights) {
    const teamOnly = before.filter(day => day.workout?.workoutType === 'Team Training');
    check('the travel journey reaches both real team nights', teamOnly.length === 2);
    check('travel reaches a genuinely empty former team date', teamOnly.some(prior =>
      !screen().find(day => day.date === prior.date)?.workout),
      JSON.stringify(screen().map(day => [day.date, day.workout?.name, day.restReason])));
    check('travel also reaches a filled former team date', teamOnly.some(prior =>
      !!screen().find(day => day.date === prior.date)?.workout));
    check('travel explains emptied club dates and does not label replacement solo sessions as rest', teamOnly.every(prior => {
      const after = screen().find(day => day.date === prior.date);
      return !!after && after.restReason === (after.workout ? undefined : 'away');
    }), JSON.stringify(screen().map(day => [day.date, day.workout?.name, day.restReason])));
  }
  const game = screen().find(day => day.date === '2026-07-18');
  check('travel explains the game day it actually emptied', !game?.workout && game?.restReason === 'away',
    JSON.stringify(screen().map(day => [day.date, day.workout?.name, day.restReason])));
  const signature = () => finalProgramSignature(screen().map(day => [day.date, snapshotSemanticWorkout(day.date, day.workout), day.restReason]));
  const expected = signature();
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: monday }));
  check('travel explanation and solo sessions survive reopening', boot.ok && expected === signature());
}

void journey().then(async () => {
  await fatigueJourney('male');
  await fatigueJourney('female');
  await awayJourney();
  await awayJourney(true);
  const overlayModule = require('../rules/canonicalWeekOverlay');
  const original = overlayModule.compileWeekOverlay;
  const mutated = sourceMutation<typeof overlayModule>(join(__dirname, '../rules/canonicalWeekOverlay.ts'),
    'restDayReasonByDay: sourceMicrocycle.restDayReasonByDay,', 'restDayReasonByDay: undefined,');
  const rejected: string[] = [];
  try {
    overlayModule.compileWeekOverlay = mutated.compileWeekOverlay;
    await journey((name, condition) => { if (!condition) rejected.push(name); });
  } finally { overlayModule.compileWeekOverlay = original; }
  ok('the real journey fails when the overlay drops its explanation',
    rejected.includes('the real reported injuries reach an empty Thursday, not a surviving session'));

  const availability = require('../rules/canonicalWeeklyAvailabilityState') as typeof import('../rules/canonicalWeeklyAvailabilityState');
  const originalAvailability = availability.schedulerInputsWithAvailabilityState;
  const travelRejected: string[] = [];
  try {
    availability.schedulerInputsWithAvailabilityState = (...args) => {
      const { restDayReasonByDay: _dropped, ...withoutCause } = originalAvailability(...args);
      return withoutCause;
    };
    await awayJourney(true, (name, condition) => { if (!condition) travelRejected.push(name); });
  } finally { availability.schedulerInputsWithAvailabilityState = originalAvailability; }
  ok('the real team-night journey fails if travel discards why it removed the anchor',
    travelRejected.includes('travel explains emptied club dates and does not label replacement solo sessions as rest'));

  const factCompiler = require('../rules/canonicalWeeklySourceFactCompiler') as typeof import('../rules/canonicalWeeklySourceFactCompiler');
  const originalFactCompiler = factCompiler.compileCanonicalSourceFactWeeks;
  const withoutFatigueReason = sourceMutation<typeof factCompiler>(join(__dirname, '../rules/canonicalWeeklySourceFactCompiler.ts'),
    "restDayReasonByDay[new Date(`${date}T12:00:00Z`).getUTCDay()] = 'fatigue';", '/* dropped fatigue explanation */');
  const fatigueRejected: string[] = [];
  try {
    factCompiler.compileCanonicalSourceFactWeeks = withoutFatigueReason.compileCanonicalSourceFactWeeks;
    await fatigueJourney('male', (name, condition) => { if (!condition) fatigueRejected.push(name); });
  } finally { factCompiler.compileCanonicalSourceFactWeeks = originalFactCompiler; }
  ok('the real fatigue journey fails if the removal loses its reason',
    fatigueRejected.includes('male: cooked explains rest only when the session was removed'));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}).catch(error => { console.error(error); process.exitCode = 1; });
