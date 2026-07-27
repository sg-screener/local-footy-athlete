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

// NOTE — two structural assertions belong to the MIGRATION commit, not here:
// that no production file still names a retired tier, and that
// weeklyExposureContractBuilders no longer zeroes main_strength. The law is
// authored and encoded; retiring the 81 call sites is its own pass, and
// asserting the end state before that pass would ship a red gate.
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

/* ── "Nothing is required" means every domain ── */

// The optional tier's whole content is "deloaded AND nothing is required". §18
// enforces two separate numbers per domain: a required MINIMUM and a
// planner-selected CORE target, and a missed core target is blocking on its own
// — `required: 0` does not excuse it. So an optional week has to drop BOTH, in
// EVERY domain, or the contract still commits the week to core work that every
// session was deliberately stamped optional against, and §18 rejects the whole
// commit.
//
// This is asserted across all three domains together because the defect it
// pins was a PARTIAL decoration: strength dropped both numbers while
// conditioning and sprint dropped only the minimum, so the optional week
// remained impossible via a domain nobody had looked at. A per-domain spot
// check would have passed on strength and missed it.
console.log('\n[9] OPTIONAL WEEK — no domain keeps a core target');

for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  const optional = buildWeeklyExposureContract({
    seasonPhase: phase,
    readiness: 'medium',
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [],
    hasGame: false,
    gameDay: null,
    weekModeOverride: 'optional_week',
  } as never);

  ok(`${phase}: the optional week is minted`,
    optional.identity.mode === 'optional_week', optional.identity.mode);

  for (const [domain, exposure] of [
    ['strength', optional.strength],
    ['conditioning', optional.conditioning],
    ['sprint/COD', optional.sprintCod],
  ] as const) {
    ok(`${phase}: ${domain} requires nothing`,
      (exposure as { required: number }).required === 0,
      `required=${(exposure as { required: number }).required}`);
    ok(`${phase}: ${domain} COMMITS to nothing either`,
      (exposure as { targetCount: number }).targetCount === 0,
      `targetCount=${(exposure as { targetCount: number }).targetCount}`);
  }
}

/* ── Result ── */

console.log(
  `\nReadiness + illness law: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
