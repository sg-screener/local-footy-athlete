/**
 * THE READINESS LAW + THE ILLNESS LAW — Sam, 2026-07-27.
 *
 *   docs/LFA_PROGRAMMING_BIBLE.md §14 + §19
 *
 * Readiness: low readiness means THE NEXT 7 DAYS ARE DELOADED — a rolling
 * window from the declaration day, not the remainder of the calendar week.
 * Declare on Friday and the following week deloads, not just the weekend.
 *
 * Illness: three tiers, all riding the deload law. Severity decides exactly
 * TWO things — deload or not, optional or not.
 *
 *   mild      training unchanged; logged as a fact that can lower readiness
 *   moderate  deloaded while the fact is ACTIVE (illness horizon, NOT 7 days)
 *   severe    deloaded AND every session optional while active
 *
 * Both replace the invented four-tier readiness system. The tier TYPE is
 * retired, not just its numbers: readiness exposes deloaded-or-not and nothing
 * else, so it cannot grow graduations back.
 *
 * Run: npm run test:readiness-illness-law
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  READINESS_DELOAD_WINDOW_DAYS,
  resolveReadinessDeload,
  resolveIllnessDirective,
  isDateInReadinessDeloadWindow,
  type IllnessSeverityTier,
} from '../rules/readinessIllnessLaw';
import {
  createTemporaryIllnessFact,
  normalizeTemporarySourceFacts,
} from '../rules/temporarySourceFact';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { buildWeeklyExposureContract } from '../rules/weeklyExposureContractBuilders';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/* ── The window ── */

console.log('\n[1] THE READINESS WINDOW — rolling 7 days, not remainder-of-week');

ok('the window is 7 days', READINESS_DELOAD_WINDOW_DAYS === 7,
  `got ${READINESS_DELOAD_WINDOW_DAYS}`);

// Sam's worked example. 2026-07-31 is a Friday.
const FRIDAY = '2026-07-31';
const declared = resolveReadinessDeload({ declaredOnISO: FRIDAY, lowReadiness: true });

ok('a low-readiness declaration produces a deload', declared !== null);
ok('the window starts on the declaration day',
  declared?.startISO === FRIDAY, `got ${declared?.startISO}`);
ok('the window ends 7 days later, on the following Thursday',
  declared?.endISO === '2026-08-06', `got ${declared?.endISO}`);

// The whole point of the ruling: NOT the remainder of the calendar week.
for (const [label, date] of [
  ['Friday (declaration day)', '2026-07-31'],
  ['Saturday', '2026-08-01'],
  ['Sunday — old behaviour stopped here', '2026-08-02'],
  ['Monday of the NEXT week', '2026-08-03'],
  ['Wednesday of the next week', '2026-08-05'],
  ['Thursday — last day of the window', '2026-08-06'],
] as const) {
  ok(`${label} is inside the window`,
    isDateInReadinessDeloadWindow(date, declared!), date);
}

ok('the 8th day is OUTSIDE the window',
  !isDateInReadinessDeloadWindow('2026-08-07', declared!));
ok('the day before the declaration is outside the window',
  !isDateInReadinessDeloadWindow('2026-07-30', declared!));

ok('normal readiness produces no deload',
  resolveReadinessDeload({ declaredOnISO: FRIDAY, lowReadiness: false }) === null);

/* ── No graduations ── */

console.log('\n[2] NO TIERS — readiness says deloaded-or-not, and nothing else');

ok('readiness exposes only a window, never a magnitude',
  declared !== null
    && !('tier' in declared)
    && !('severity' in declared)
    && !('reduction' in declared),
  Object.keys(declared ?? {}).join(', '));

/* ── The retirement, enforced ── */

// These three were deferred while the 81 call sites were being retired —
// asserting the end state mid-migration would have shipped a red gate. The
// migration has landed, so they become RATCHETS: the tiers are not merely gone,
// they cannot grow back without failing the gate.
console.log('\n[2b] STRUCTURAL — the retired tiers cannot return');

const PRODUCTION_SOURCES = (function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
})(path.join(repoRoot, 'src'));

// 1. No production file may name a retired tier. The four-tier system is gone
//    down to the TYPE, so a surviving name is a surviving representation —
//    something would read it, then something else would copy that.
{
  const RETIRED = /\b(slight_reduction|moderate_reduction|major_reduction|GenerationReadinessTier)\b/;
  const offenders = PRODUCTION_SOURCES
    .filter((file) => RETIRED.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file));
  ok('no production file names a retired readiness tier',
    offenders.length === 0, offenders.join(', '));
}

// 2. The contract builders may not zero a main-strength count on readiness.
//    This is the specific site the law was written against: a readiness input
//    reaching in and cutting the week's strength COUNT.
{
  const builders = fs.readFileSync(
    path.join(repoRoot, 'src/rules/weeklyExposureContractBuilders.ts'), 'utf8');
  const active = builders.split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  // Every surviving mention must be a `void` no-op — the deliberate marker that
  // the input is received and consciously ignored. A real READ (a ternary, a
  // guard, an argument) is the tier system reaching back into the counts, and
  // is what this fails on. The interface's own `readinessDeloaded?: boolean`
  // declaration is not a read.
  const reads = active.split('\n')
    .filter((line) => /\binput\.readinessDeloaded\b/.test(line))
    .filter((line) => !/^\s*void\s+input\.readinessDeloaded;\s*$/.test(line));
  ok('the contract builders never read readiness to cut a strength count',
    reads.length === 0, reads.join(' | '));
}

// 3. Reductions are TYPED. A count reduction is expressible — injury and a
//    training pause still author them — so the invariant below can only be
//    stated against a real vocabulary, not an absent one.
{
  const source = fs.readFileSync(
    path.join(repoRoot, 'src/rules/weeklyExposureContractV2.ts'), 'utf8');
  ok('the frequency metrics a count reduction would use are typed and present',
    ['main_strength_frequency', 'conditioning_core_frequency', 'sprint_high_speed_frequency']
      .every((metric) => source.includes(`'${metric}'`)));
}

/* ── INV_LOW_READINESS_MAKES_NO_COUNT_REDUCTION ── */

// The law's load-bearing consequence, asserted for BOTH acting tiers:
//
//   "Readiness never REMOVES sessions. The old tiers cut session counts by
//    degree, and counts are structure — which the deload law holds constant
//    while the work inside shrinks."
//
// Stated against BEHAVIOUR, not against the absence of the deleted code: a
// readiness input authors no frequency reduction, and the week's structural
// counts are byte-identical to the healthy week's. A future change that cuts a
// count by some new route fails here even if it never uses the word 'tier'.
//
// 'tired' is excluded deliberately — it is 'noted', reaches the program not at
// all, and would pass this trivially.
console.log('\n[2c] INV_LOW_READINESS_MAKES_NO_COUNT_REDUCTION — both acting tiers');

const FREQUENCY_METRICS = [
  'main_strength_frequency',
  'conditioning_core_frequency',
  'sprint_high_speed_frequency',
  'strength_pattern_count',
] as const;

function safetyContract(readiness?: { deloaded: boolean; sessionsOptional: boolean }) {
  const base = buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season',
    declaredSubphase: 'game_week',
    mode: 'in_season_game_week',
    blockNumber: 1, weekInBlock: 1, globalWeek: 1, phaseWeek: 1,
    phaseWeekProvenance: 'explicit_phase_clock',
    weekKind: 'build',
    anchorState: 'game',
    teamTrainingDays: [2, 4],
    fixtureDay: 6,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: 4, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 2,
    },
    prohibitedPatterns: [],
    prohibitedPatternProvenance: 'explicit_none',
    equipment: {
      appConditioningFeasible: true, substitutionStatus: 'not_required', consideredSubstitutions: [],
    },
  } as never);
  return applyGenerationSafetyToSection18Contract({
    contract: base,
    generationConstraints: readiness
      ? {
          activeConstraintIds: ['r'], injuries: [], activeInjuryKeys: [],
          readiness: { id: 'r', sourceType: 'fatigue', ...readiness },
        } as never
      : undefined,
  });
}

const healthyWeek = safetyContract();

for (const [tier, directive] of [
  ['wrecked', { deloaded: true, sessionsOptional: false }],
  ['absolutely cooked', { deloaded: true, sessionsOptional: true }],
] as const) {
  const week = safetyContract(directive);

  const frequencyReductions = week.authorisedReductions.filter((entry) =>
    (FREQUENCY_METRICS as readonly string[]).includes(entry.metric));
  ok(`${tier}: authors NO frequency reduction`,
    frequencyReductions.length === 0,
    frequencyReductions.map((entry) => `${entry.metric}<-${entry.reason}`).join(', '));

  ok(`${tier}: authors no reduction citing low_readiness at all`,
    week.authorisedReductions.every((entry) => entry.reason !== 'low_readiness'),
    week.authorisedReductions.map((entry) => `${entry.metric}<-${entry.reason}`).join(', '));

  for (const [domain, before, after] of [
    ['main strength', healthyWeek.mainStrength.exposure, week.mainStrength.exposure],
    ['conditioning', healthyWeek.conditioning.core, week.conditioning.core],
    ['sprint/high-speed', healthyWeek.sprintHighSpeed.exposure, week.sprintHighSpeed.exposure],
  ] as const) {
    ok(`${tier}: ${domain} keeps the healthy week's required minimum`,
      after.requiredMinimum === before.requiredMinimum,
      `${after.requiredMinimum} vs ${before.requiredMinimum}`);
    ok(`${tier}: ${domain} keeps the healthy week's permitted maximum`,
      after.permittedMaximum === before.permittedMaximum,
      `${after.permittedMaximum} vs ${before.permittedMaximum}`);
  }

  // The other half of the law, so this cannot be satisfied by doing nothing at
  // all: the week IS deloaded — the dose shrinks even though no count moves.
  ok(`${tier}: the week is still marked for a lighter dose`,
    week.safety.lighterStrengthRequired === true ||
    week.safety.strengthIntensityCeiling !== null ||
    week.safety.affectedDomains.includes('session_dose'),
    JSON.stringify(week.safety.affectedDomains));

  // And power survives, which is what separates a deload from the retired
  // major_reduction tier.
  ok(`${tier}: power survives — a deload is not a reason to lose sharpness`,
    week.power.eligible === true, String(week.power.removalReason));
}

/* ── Illness ── */

console.log('\n[3] THE ILLNESS LAW — three tiers, exactly two decisions');

const TIERS: readonly IllnessSeverityTier[] = ['mild', 'moderate', 'severe'];

ok('exactly three illness tiers exist', TIERS.length === 3);

{
  const mild = resolveIllnessDirective('mild');
  ok('MILD does not deload', mild.deloaded === false);
  ok('MILD does not make sessions optional', mild.sessionsOptional === false);
}
{
  const moderate = resolveIllnessDirective('moderate');
  ok('MODERATE deloads', moderate.deloaded === true);
  ok('MODERATE does not make sessions optional', moderate.sessionsOptional === false);
}
{
  const severe = resolveIllnessDirective('severe');
  ok('SEVERE deloads', severe.deloaded === true);
  ok('SEVERE makes every session optional', severe.sessionsOptional === true);
}

ok('severity decides EXACTLY two things and carries no other numbers',
  TIERS.every((tier) => {
    const keys = Object.keys(resolveIllnessDirective(tier)).sort();
    return keys.join(',') === 'deloaded,sessionsOptional';
  }),
  Object.keys(resolveIllnessDirective('moderate')).join(', '));

// The horizons are deliberately different, and confusing them is the obvious
// mistake: illness is open until cleared, readiness is a fixed 7 days.
ok('illness does NOT use the readiness 7-day window',
  resolveIllnessDirective('moderate').deloaded === true
    && !('windowDays' in resolveIllnessDirective('moderate')));

/* ── The Bible ── */

console.log('\n[4] AUTHORED — both laws recorded');

const bible = fs.readFileSync(path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');
ok('the readiness law is in the Bible', bible.includes('THE READINESS LAW (Sam, 2026-07-27)'));
ok('the illness law is in the Bible', bible.includes('THE ILLNESS LAW (Sam, 2026-07-27)'));
// The authored sentence carries no quotation marks ("There is no full pause —
// the app never empties a week on readiness alone"). The regex demanded them,
// so it was asserting a typographic detail rather than the law, and failed
// against the Bible entry that does record the consequence.
ok('the Bible states there is no full pause', /There is no "?full pause"?/.test(bible));
ok('the Bible states readiness never removes sessions',
  /Readiness never REMOVES sessions/.test(bible));

/* ── One severity vocabulary ── */

console.log('\n[5] ONE severity vocabulary — the fact store speaks the law\'s tiers');

// The fact store used to declare its own binary `'minor' | 'severe'` union, a
// second illness vocabulary sitting beside the law's three tiers. With only two
// values MODERATE had no storage, so a flu-level illness could not be recorded
// at all — it either did nothing or emptied the week. The store now uses the
// law's type, so the two cannot drift apart.
ok('a moderate illness fact can be created and keeps its tier',
  createTemporaryIllnessFact({
    observedDate: '2026-07-27',
    scope: { kind: 'week', weekStart: '2026-07-27', from: '2026-07-27', until: '2026-08-02' },
    sourceSurface: 'test',
    severity: 'moderate',
  }).severity === 'moderate');

// mild is INERT (< 4 on the shared health-fact threshold), moderate and severe
// DERIVE. Moderate must clear the threshold or "deloaded while active" could
// never fire.
const tierLevel = (severity: IllnessSeverityTier) => createTemporaryIllnessFact({
  observedDate: '2026-07-27',
  scope: { kind: 'week', weekStart: '2026-07-27', from: '2026-07-27', until: '2026-08-02' },
  sourceSurface: 'test',
  severity,
}).athleteReportedLevel;

ok('mild is inert on the shared threshold', tierLevel('mild') === 'slight',
  `got ${String(tierLevel('mild'))}`);
ok('moderate DERIVES on the shared threshold', tierLevel('moderate') === 'moderate',
  `got ${String(tierLevel('moderate'))}`);
ok('severe DERIVES on the shared threshold', tierLevel('severe') === 'high',
  `got ${String(tierLevel('severe'))}`);

// Sam's migration ruling. The old `severe` drove the optional-sessions week
// mode, which is exactly the new SEVERE behaviour — mapping it to moderate
// would silently downgrade a bed-bound athlete's stored fact to flu.
const hydrate = (storedSeverity: string) => normalizeTemporarySourceFacts({
  value: [{
    factId: `legacy-${storedSeverity}`,
    factKind: 'illness',
    severity: storedSeverity,
    status: 'active',
    observedDate: '2026-07-27',
    effectiveFrom: '2026-07-27',
    effectiveUntil: '2026-08-02',
  }],
})[0] as { severity: IllnessSeverityTier } | undefined;

ok('a stored legacy `minor` hydrates as MILD', hydrate('minor')?.severity === 'mild',
  `got ${String(hydrate('minor')?.severity)}`);
ok('a stored legacy `severe` hydrates as SEVERE — never downgraded to moderate',
  hydrate('severe')?.severity === 'severe',
  `got ${String(hydrate('severe')?.severity)}`);
ok('an unrecognised stored severity falls back to the inert tier',
  hydrate('banana')?.severity === 'mild',
  `got ${String(hydrate('banana')?.severity)}`);

/* ── The doors ── */

console.log('\n[6] THE THREE SICK DOORS — Sam\'s labels, authored');

ok('the three sick doors are in the Bible',
  bible.includes('THE THREE SICK DOORS (Sam, 2026-07-27)'));
for (const label of ['A bit off', 'Properly sick', "Can't get out of bed"]) {
  ok(`the Bible records the door "${label}"`, bible.includes(label));
}
ok('the Bible records that this supersedes the R16 two-option ruling',
  /SUPERSEDES the R16 door-routing ruling/.test(bible));
ok('the Bible records the day-granular owner',
  bible.includes('THE DELOAD/OPTIONAL OWNER (Sam, 2026-07-27)'));

/* ── The doors, wired ── */

console.log('\n[7] THE THREE SICK DOORS — wired to the three tiers');

// One door per tier, and the door vocabulary IS the law's. The kinds used to be
// `sniffle_today` and `sick_week`, which named a SCOPE — but scope is now
// derived from the tier (mild is today-scoped, moderate and severe hold until
// cleared), so those names described something the athlete no longer chooses.
for (const [kind, tier] of [
  ['illness_mild', 'mild'],
  ['illness_moderate', 'moderate'],
  ['illness_severe', 'severe'],
] as const) {
  const action = readinessActionForKind(kind, {
    anchorDateISO: '2026-07-27',
    todayISO: '2026-07-27',
  });
  ok(`the ${kind} door writes a ${tier} illness fact`,
    action.type === 'set_illness_status' &&
      (action.payload as { severity?: string }).severity === tier,
    `got ${action.type}/${String((action.payload as { severity?: string }).severity)}`);
}

// MILD is record-only and today-scoped; the deriving tiers hold until cleared.
ok('the mild door is today-scoped',
  readinessActionForKind('illness_mild', {
    anchorDateISO: '2026-07-27', todayISO: '2026-07-27',
  }).scope === 'today_only');

for (const kind of ['illness_moderate', 'illness_severe'] as const) {
  ok(`the ${kind} door is week-scoped, not a single day`,
    readinessActionForKind(kind, {
      anchorDateISO: '2026-07-27', todayISO: '2026-07-27',
    }).scope === 'current_week');
}

/* ── The copy ── */

console.log('\n[8] SAM\'S LABELS — athlete-facing copy, exactly as authored');

const sheet = fs.readFileSync(
  path.join(repoRoot, 'src/screens/home/HomeScreenV2.tsx'), 'utf8');

for (const label of ['A bit off', 'Properly sick', "Can't get out of bed"]) {
  ok(`the sheet offers "${label}"`, sheet.includes(`label="${label}"`),
    'Sam authored this wording; it is not ours to paraphrase');
}

// The superseded R16 label must be GONE, not merely unused — leaving it in the
// sheet is how two vocabularies survive a rename.
ok('the superseded "Coming down with something" label is gone',
  !sheet.includes('Coming down with something'));

/* ── "Nothing is required" is not "nothing is offered" ── */

// The optional tier's whole content is "deloaded AND nothing is required".
// §18 enforces two separate numbers per domain — a required MINIMUM and a
// planner-selected CORE target — and a missed core target is blocking on its
// own, so `required: 0` alone does not lift the commitment.
//
// But the commitment and the STRUCTURE are different things, and they were
// being lifted with the same lever. Zeroing `targetCount` stopped §18 demanding
// the sessions AND stopped the generator building them, so a pre-season
// "absolutely cooked" week arrived as six recovery sessions: "nothing is
// required" implemented as "nothing is offered". Sam's law is the opposite —
// "it does not empty the week. It lifts the MINIMUMS so nothing is required,
// and the sessions remain, OFFERED."
//
// One owner each: `targetCount` is structure and is PRESERVED; the commitment
// is lifted by `plannerSelectionKind: 'optional'`, which is the only thing §18
// enforces on.
console.log('\n[9] OPTIONAL WEEK — nothing required, everything still offered');

for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  const input = {
    seasonPhase: phase,
    readiness: 'medium',
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [],
    hasGame: false,
    gameDay: null,
  } as const;
  const normal = buildWeeklyExposureContract(input as never);
  const optional = buildWeeklyExposureContract({ ...input, weekModeOverride: 'optional_week' } as never);

  ok(`${phase}: the optional week is minted`,
    optional.identity.mode === 'optional_week', optional.identity.mode);

  for (const [domain, key] of [
    ['strength', 'strength'], ['conditioning', 'conditioning'], ['sprint/COD', 'sprintCod'],
  ] as const) {
    const lifted = optional[key] as { required: number; targetCount: number };
    const before = normal[key] as { required: number; targetCount: number };
    ok(`${phase}: ${domain} requires nothing`,
      lifted.required === 0, `required=${lifted.required}`);
    ok(`${phase}: ${domain} still OFFERS the week's real session count`,
      lifted.targetCount === before.targetCount,
      `optional targetCount=${lifted.targetCount}, the week it replaced had ${before.targetCount}`);
  }
}

// The commitment is lifted at its own owner, in EVERY domain. Sprint was the
// one that silently kept `selectionKind: 'core'` while strength and
// conditioning were marked optional, so §18 held every optional week to a core
// sprint target it has none of by design — which is what rejected every
// severe-illness commit.
for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  const v2 = buildSection18WeeklyExposureContractV2({
    seasonPhase: phase,
    declaredSubphase: phase === 'In-season' ? 'game_week' : phase === 'Pre-season'
      ? 'early_preseason' : 'mid_offseason',
    mode: 'optional_week',
    blockNumber: 1, weekInBlock: 1, globalWeek: 1, phaseWeek: 1,
    phaseWeekProvenance: 'explicit_phase_clock',
    weekKind: 'build',
    anchorState: 'none',
    teamTrainingDays: [],
    fixtureDay: null,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: 4, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0,
    },
    prohibitedPatterns: [],
    prohibitedPatternProvenance: 'explicit_none',
    equipment: {
      appConditioningFeasible: true, substitutionStatus: 'not_required', consideredSubstitutions: [],
    },
  } as never);

  for (const [domain, exposure] of [
    ['strength', v2.mainStrength.exposure],
    ['conditioning', v2.conditioning.core],
    ['sprint/high-speed', v2.sprintHighSpeed.exposure],
  ] as const) {
    ok(`${phase}: ${domain} commits to nothing — selection is optional`,
      exposure.plannerSelectionKind === 'optional',
      `plannerSelectionKind=${exposure.plannerSelectionKind}`);
    ok(`${phase}: ${domain} carries no enforceable core target`,
      (exposure.plannerSelectedTarget ?? 0) === 0,
      `plannerSelectedTarget=${exposure.plannerSelectedTarget}`);
  }
}

/* ── Result ── */

console.log(
  `\nReadiness + illness law: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
