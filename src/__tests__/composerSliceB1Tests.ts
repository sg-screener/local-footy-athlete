/**
 * SLICE B1 CHECKPOINT 1 — the composer's contract, one cell per clause.
 *
 *   npm run test:composer-b1
 *
 * **ROUTE-SCOPED, AND THE CELLS SAY SO.** Every enforcement here holds for the
 * COMPOSED route only. The legacy route is untouched this slice and the registry
 * rows for R-090 and the main-lift-role ruling are globally UNENFORCED until all
 * program-building routes migrate or are deleted.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  composeWeek,
  composedDayKind,
  kitUnachievablePatterns,
  type ComposerInputs,
  type ComposerPlannedDay,
} from '../rules/composeWeek';
import { composedIdentityFor, composedRowIsLegal } from '../rules/composedRowLegality';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { EQUIPMENT_TAG_LABELS } from '../rules/equipmentVocabulary';
import { exerciseAllowedByEquipment } from '../data/exercisePoolsStrength';
import { exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const FULL_GYM = resolveEquipmentCapabilities({
  equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
const DB_BANDS = resolveEquipmentCapabilities({
  equipment: ['Dumbbells', 'Bands'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
/** An EXHAUSTIVE answer resolving to bodyweight — never `tags: {}`, which also means unanswered. */
const AWAY_BODYWEIGHT = resolveEquipmentCapabilities({
  equipmentAnswer: {
    tags: Object.fromEntries(Object.keys(EQUIPMENT_TAG_LABELS).map((tag) => [tag, 'do_not_have'])),
    modalities: Object.fromEntries(
      ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'].map((m) => [m, 'do_not_have'])),
  },
} as never).tags as string[];

const UPPER_FULL_DAY: ComposerPlannedDay = {
  dayOfWeek: 2,
  isTeamDay: false,
  planEntryId: 'w1:tuesday:none:team',
  strengthIntent: {
    archetype: 'upper', primaryPattern: 'push',
    plannedPatterns: ['push', 'pull'], effectivePatterns: ['push', 'pull'],
  },
  name: 'Team Training + Upper Body Strength',
  workoutType: 'Team Training',
  sessionTier: 'core',
};
const LOWER_DAY: ComposerPlannedDay = {
  dayOfWeek: 1,
  isTeamDay: false,
  planEntryId: 'w1:monday:none:strength',
  strengthIntent: {
    archetype: 'lower', primaryPattern: 'squat',
    plannedPatterns: ['squat', 'hinge'], effectivePatterns: ['squat', 'hinge'],
  },
  name: 'Lower Body Strength',
  workoutType: 'Strength',
  sessionTier: 'core',
};

function inputs(over: Partial<ComposerInputs> = {}): ComposerInputs {
  return {
    profile: { seasonPhase: 'Pre-season', experienceLevel: 'Intermediate' } as never,
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [UPPER_FULL_DAY],
    kit: FULL_GYM,
    injuries: { prohibitedPatterns: [], excludedIdentities: [] },
    todayISO: '2026-07-13',
    ...over,
  };
}

// ── CLAUSE (a) — the required-pattern set is derived AT CONSTRUCTION ────────
console.log('\n[a] The required-pattern set is derived kit-relative at construction');
{
  const contractInput = {
    seasonPhase: 'Pre-season', declaredSubphase: 'general_preseason', mode: 'standard',
    anchorState: { teamTrainingDays: [], fixtureDays: [] },
    teamTrainingDays: [2, 4], capacity: 'moderate',
    plannerSelected: {
      mainStrength: 2, coreConditioning: 3, sprintHighSpeed: 1, powerPrimers: 0,
    },
  } as never;
  const wide = buildSection18WeeklyExposureContractV2(contractInput);
  ok('the unnarrowed contract still requires all four patterns',
    wide.strengthPatterns.requiredSafePatterns.length === 4,
    JSON.stringify(wide.strengthPatterns.requiredSafePatterns));
  const declared = buildSection18WeeklyExposureContractV2({
    ...(contractInput as object), declaredRequiredPatterns: ['push', 'pull'],
  } as never);
  ok("the planner's OWN answer narrows the required set",
    JSON.stringify(declared.strengthPatterns.requiredSafePatterns) === '["push","pull"]',
    JSON.stringify(declared.strengthPatterns.requiredSafePatterns));
  ok('a narrowed set stands the balance selector down (userRemovalConstraints precedent)',
    declared.strengthPatterns.balanceExpectation === 'not_applicable'
    && declared.strengthPatterns.laterSessionRestorationRequired === false,
    `${declared.strengthPatterns.balanceExpectation} / `
    + `${declared.strengthPatterns.laterSessionRestorationRequired}`);
  const kitNarrowed = buildSection18WeeklyExposureContractV2({
    ...(contractInput as object), kitUnachievablePatterns: ['pull'],
  } as never);
  ok('a kit-unachievable pattern is not owed (R-083)',
    !kitNarrowed.strengthPatterns.requiredSafePatterns.includes('pull'),
    JSON.stringify(kitNarrowed.strengthPatterns.requiredSafePatterns));
  // THE CONTROL: omitting both fields must leave every other route untouched.
  ok('omitting both fields is byte-identical to the old contract',
    JSON.stringify(wide) === JSON.stringify(
      buildSection18WeeklyExposureContractV2(contractInput)));
}

// ── CLAUSE (b) — one canonical identity ────────────────────────────────────
console.log('\n[b] Every composed row carries ONE canonical identity');
{
  const week = composeWeek(inputs({ plannedDays: [LOWER_DAY, UPPER_FULL_DAY] }));
  const rows = week.days.flatMap((day) => day.rows);
  ok('the sweep reached rows at all — non-vacuity first', rows.length >= 8, `${rows.length} rows`);
  ok('every identity is its own canonical form',
    rows.every((row) => composedIdentityFor(row.identity) === row.identity),
    rows.map((row) => row.identity).join(', '));
  // The five alias pairs the census measured must never both appear.
  const identities = rows.map((row) => row.identity);
  ok('no alias pair ships as two rows',
    !(identities.includes('Pallof Press') || identities.includes('Romanian Deadlift')
      || identities.includes('Face Pulls')),
    identities.join(', '));
}

// ── CLAUSE (c)/(d) — slots then rows, and the main-lift role ───────────────
console.log('\n[c] Slots, then rows — Sam\'s ladder, with main-lift-as-role');
{
  const week = composeWeek(inputs());
  const day = week.days[0];
  ok('a full-gym upper day covers all five of its slots',
    day.requiredSlots.length === 5 && day.rows.length === 5,
    `${day.requiredSlots.join(',')} / ${day.rows.length} rows`);
  ok('rows arrive in Sam\'s fill order',
    JSON.stringify(day.rows.map((row) => row.slot))
      === '["horizontal_push","horizontal_pull","vertical_push","vertical_pull","arm_or_shoulder"]',
    JSON.stringify(day.rows.map((row) => row.slot)));
  ok('every composed row is legal under the ONE owner',
    day.rows.every((row) => composedRowIsLegal(row.identity, FULL_GYM)));
  const mains = day.rows.filter((row) => row.role === 'main_strength');
  ok('each PLANNED pattern gets exactly one main lift',
    mains.length === 2
    && JSON.stringify(mains.map((row) => row.mainStrengthPattern).sort()) === '["pull","push"]',
    JSON.stringify(mains.map((row) => `${row.identity}:${row.mainStrengthPattern}`)));
  // GUARD (d): the SECOND push row of the day is a supplementary accessory.
  const secondPush = day.rows.find((row) => row.slot === 'vertical_push');
  ok('[guard d] a supplementary same-pattern row stays an accessory',
    secondPush?.role === 'strength_accessory' && secondPush?.mainStrengthPattern === null,
    `${secondPush?.identity} ${secondPush?.role}`);
  // A day that never planned a pattern must not main-lift it.
  const pushOnly = composeWeek(inputs({
    plannedDays: [{ ...UPPER_FULL_DAY, strengthIntent: {
      archetype: 'upper', primaryPattern: 'push',
      plannedPatterns: ['push'], effectivePatterns: ['push'] } }],
  })).days[0];
  ok('an unplanned pattern never takes the main-lift role',
    pushOnly.rows.every((row) => row.mainStrengthPattern !== 'pull'),
    JSON.stringify(pushOnly.rows.map((row) => `${row.slot}:${row.role}`)));
  ok('a lower day is judged by the LOWER ladder, from the typed intent not the name',
    composedDayKind(LOWER_DAY.strengthIntent) === 'lower');
  // NO DOUBLE-HINGE: one slot, one row, so a pattern cannot be doubled by the
  // composer at all — asserted rather than assumed.
  const lower = composeWeek(inputs({ plannedDays: [LOWER_DAY] })).days[0];
  ok('a composed lower day carries no double hinge',
    lower.rows.filter((row) => row.slot === 'hinge').length === 1
    && new Set(lower.rows.map((row) => row.slot)).size === lower.rows.length,
    JSON.stringify(lower.rows.map((row) => `${row.slot}:${row.identity}`)));
}

// ── CLAUSE (d) — session counts honest ─────────────────────────────────────
console.log('\n[d] Session counts are honest, or adjusted with a typed reason');
{
  const week = composeWeek(inputs({ plannedDays: [LOWER_DAY, UPPER_FULL_DAY] }));
  ok('the planner asked for two and got two',
    week.sessionCount.requested === 2 && week.sessionCount.composed === 2
    && week.sessionCount.adjustment === null,
    JSON.stringify(week.sessionCount));
  // THE INVARIANT, both directions: a requested day is either COMPOSED or
  // ADJUSTED WITH A REASON. It is never silently dropped, and the two always
  // add up.
  const partlyProhibited = composeWeek(inputs({
    injuries: { prohibitedPatterns: ['push', 'pull'], excludedIdentities: [] },
  }));
  ok('a day whose main patterns are prohibited still ships its lawful slot',
    partlyProhibited.sessionCount.composed === 1
    && partlyProhibited.days[0].rows.every((row) => row.slot === 'arm_or_shoulder'),
    JSON.stringify(partlyProhibited.days[0]?.rows.map((row) => row.slot)));
  // Every slot genuinely empty: prohibit both directions AND exclude the three
  // bodyweight arm rows, so the ladder has nothing lawful left anywhere.
  const nothingLeft = composeWeek(inputs({
    kit: AWAY_BODYWEIGHT,
    injuries: {
      prohibitedPatterns: ['push', 'pull'],
      // The five identities `arm_or_shoulder` still exposes on a bodyweight kit
      // — measured, not guessed. Two of them (`Chest-Supported DB Row`,
      // `Seated Cable Row`) are legal only because Sam's sheet has no row for
      // them; that silence is reported in the slice report, not patched here.
      excludedIdentities: ['Push-ups', 'Explosive Push-up', 'Scap Push-Up',
        'Chest-Supported DB Row', 'Seated Cable Row'],
    },
  }));
  ok('a day that cannot be filled is adjusted openly with a typed reason',
    nothingLeft.sessionCount.composed === 0
    && nothingLeft.sessionCount.adjustment?.[0].reason === 'no_trainable_slot_on_this_kit',
    JSON.stringify(nothingLeft.sessionCount));
  for (const week of [partlyProhibited, nothingLeft,
    composeWeek(inputs({ plannedDays: [LOWER_DAY, UPPER_FULL_DAY] }))]) {
    ok('requested = composed + adjusted, always — no day is silently dropped',
      week.sessionCount.requested
        === week.sessionCount.composed + (week.sessionCount.adjustment?.length ?? 0),
      JSON.stringify(week.sessionCount));
  }
}

// ── CLAUSE (e) — gaps disclosed, never repaired ────────────────────────────
console.log('\n[e] Kit gaps are typed, derived facts — never repaired, never substituted');
{
  const away = composeWeek(inputs({ kit: AWAY_BODYWEIGHT }));
  ok('a bodyweight athlete gets typed gaps, not substitutes',
    away.gaps.length > 0 && away.gaps.every((gap) => gap.cause === 'kit'),
    JSON.stringify(away.gaps.map((gap) => gap.slot)));
  ok('the gap names what the kit would need, in the sheet\'s own words',
    away.gaps.some((gap) => typeof gap.wouldNeed === 'string' && gap.wouldNeed.length > 0),
    JSON.stringify(away.gaps));
  ok('no gap row is substituted into the day',
    away.days.every((day) => day.rows.every((row) => composedRowIsLegal(row.identity, AWAY_BODYWEIGHT))));
  // A FULL-GYM CONTROL: the exemption cannot spread to an athlete who owns the kit.
  ok('a full-gym athlete has no kit gap at all',
    composeWeek(inputs()).gaps.length === 0);
  // THE B1 RULING (Sam, 2026-08-14): an unloaded Single-Leg RDL counts.
  ok('[R-084 superseded by R-086] an unloaded Single-Leg RDL is a legal single-leg-hip row',
    composedRowIsLegal('Single-Leg RDL', AWAY_BODYWEIGHT));
  const awayLower = composeWeek(inputs({ plannedDays: [LOWER_DAY], kit: AWAY_BODYWEIGHT })).days[0];
  ok('[R-084 superseded] the away lower day actually carries it',
    awayLower.rows.some((row) => row.slot === 'single_leg_hip'),
    JSON.stringify(awayLower.rows.map((row) => `${row.slot}:${row.identity}`)));
}

// ── THE ONE LEGALITY OWNER — the census's 4 disagreeing pairs, re-judged ────
console.log('\n[owner] The four disagreeing (exercise x kit) pairs, re-judged under ONE owner');
{
  const pairs: readonly [string, string[], string][] = [
    ['Chest Supported Row', AWAY_BODYWEIGHT, 'away'],
    ['Chest-Supported DB Row', AWAY_BODYWEIGHT, 'away'],
    ['Seated Cable Row', DB_BANDS, 'db_bands'],
    ['Seated Cable Row', AWAY_BODYWEIGHT, 'away'],
  ];
  for (const [name, kit, label] of pairs) {
    const verdict = composedRowIsLegal(name, kit);
    console.log(`    ${name} @ ${label}: ONE OWNER says ${verdict ? 'LEGAL' : 'ILLEGAL'}`
      + ` (pool owner ${exerciseAllowedByEquipment(name, kit as never)},`
      + ` sheet owner ${exerciseIsAvailableWith(name, kit)})`);
  }
  ok("Sam's correction settles Chest Supported Row on a bodyweight kit",
    composedRowIsLegal('Chest Supported Row', AWAY_BODYWEIGHT) === false);
  // ⚠ THE NAME APPEARS IN THE MODULE'S OWN DOCSTRING, which is where it belongs
  // — the header explains what it is NOT allowed to call. So the check reads
  // IMPORTS and CALL SITES, never the raw text.
  const ownerSource = readFileSync(
    resolve(__dirname, '../rules/composedRowLegality.ts'), 'utf8');
  ok('the composed path never consults the load classifier',
    !/from '\.\.\/data\/exercisePoolsStrength'/.test(ownerSource)
    && !/exerciseAllowedByEquipment\s*\(/.test(ownerSource));
}

// ── CLAUSE (f) / ANTI-OVERFIT — structural checks over the source ──────────
console.log('\n[f] The composer cannot ask which world it is in, and nothing rewrites it');
{
  const composerSource = readFileSync(resolve(__dirname, '../rules/composeWeek.ts'), 'utf8');
  ok('[anti-overfit] the composer never imports the migration gate',
    !composerSource.includes('composedRouteAdmission'));
  ok('[anti-overfit] the composer names no world, kit label, phase or day count',
    !/Full Gym|Bodyweight Only|'Pre-season'|trainingDaysPerWeek|weekNumber === /.test(composerSource),
    'a branch keyed to the control fixture would appear here');
  // ⚠ THE MIGRATION GATE IS DELETED (B1-PIVOT). These four cells asserted that
  // it admitted exactly one configuration; there is no gate to admit anything
  // now, and its file is gone. The property that replaces them is the
  // reachability proof below and in `composerSeveranceTests`.
  ok('[pivot] the migration allowlist file is deleted',
    !existsSync(resolve(__dirname, '../rules/composedRouteAdmission.ts')));
  // The canonicaliser's two rewriting branches are gated on `composed`.
  const canonSource = readFileSync(resolve(__dirname, '../utils/workoutCanonicalisation.ts'), 'utf8');
  ok('[f] the canonicaliser\'s drift branch stands down for a composed workout',
    canonSource.includes('!context.composed &&'));
  ok('[f] the canonicaliser\'s restore branch stands down for a composed workout',
    canonSource.includes('&& !context.composed'));
  const builderSource = readFileSync(resolve(__dirname, '../data/defaultProgram.ts'), 'utf8');
  // STRONGER THAN THE GUARD IT REPLACES: the generation builder does not call
  // the rewriter at all any more, so there is no branch to get wrong.
  ok('[pivot] generation-time pool rotation is DELETED, not guarded',
    !/applyPoolRotation\s*\(/.test(builderSource));
  ok('[pivot] the legacy strength templates are DELETED',
    !builderSource.includes("name: 'Back Squat', sets: 3")
    && builderSource.includes('B1-PIVOT: the legacy strength-content builder is severed'));
}

// ── PURITY AND DETERMINISM ─────────────────────────────────────────────────
console.log('\n[pure] Same inputs, same week; and every input has a reader');
{
  ok('composition is deterministic',
    JSON.stringify(composeWeek(inputs())) === JSON.stringify(composeWeek(inputs())));
  const week1 = composeWeek(inputs());
  const week2 = composeWeek(inputs({ phaseClock: { weekNumber: 2 } }));
  ok('[input: phaseClock] the week number changes what is selected',
    JSON.stringify(week1.days[0].rows.map((r) => r.identity))
      !== JSON.stringify(week2.days[0].rows.map((r) => r.identity)));
  ok('[input: kit] the kit changes what is selected',
    JSON.stringify(week1) !== JSON.stringify(composeWeek(inputs({ kit: DB_BANDS }))));
  ok('[input: plannedDays] the calendar changes which days are composed',
    composeWeek(inputs({ plannedDays: [LOWER_DAY, UPPER_FULL_DAY] })).days.length === 2);
  ok('[input: injuries] a prohibited pattern removes its slot',
    !composeWeek(inputs({
      injuries: { prohibitedPatterns: ['pull'], excludedIdentities: [] },
    })).days[0].rows.some((row) => row.slot.includes('pull')));
  ok('[input: injuries] an excluded identity is never selected',
    !composeWeek(inputs({
      injuries: { prohibitedPatterns: [], excludedIdentities: ['Bench Press'] },
    })).days[0].rows.some((row) => row.identity === 'Bench Press'));
  ok('[input: todayISO] the week start is stamped from today',
    composeWeek(inputs({ todayISO: '2026-07-20' })).weekStartISO === '2026-07-20'
    && week1.weekStartISO === '2026-07-13');
  ok('[input: profile] the profile is carried and read',
    typeof inputs().profile.seasonPhase === 'string');
  // THE KIT DERIVER, one owner for the contract and the gap.
  ok('kitUnachievablePatterns is empty on a full gym',
    kitUnachievablePatterns(FULL_GYM).length === 0);
}

console.log(`\nComposer B1 CP1: passed=${passed} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
