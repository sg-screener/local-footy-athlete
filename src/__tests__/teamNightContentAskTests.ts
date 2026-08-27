/**
 * R-226 — a moved session landing on a team night asks, and the safe version
 * is legal by construction.
 *
 * Sam, 2026-08-26 (launch-audit finding #10): *"give them the option of
 * swapping to the safer team night versions. But allow them to say no and
 * keep the regular ones. If they choose the regular ones then they should
 * again be given a warning about it."* The flagged families are the Bible's
 * own (`docs/LFA_PROGRAMMING_BIBLE.md:156`), the RDL entry is dose-qualified
 * by :157, and every replacement must exist in the selectable vocabulary and
 * share a slot family with what it replaces — asked of the vocabulary itself,
 * so a renamed pool entry reds this file rather than minting an illegal row.
 *
 * Run: npm run test:team-night-content
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import {
  applyTeamNightSafeSwaps,
  teamNightFlaggedRows,
  TEAM_NIGHT_CONTENT_ASK,
  TEAM_NIGHT_CONTENT_ROUTE_IDS,
} from '../rules/teamNightContentAsk';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type { Workout } from '../types/domain';

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function row(name: string, repsMax = 10): { exercise: { name: string }; prescribedSets: number; prescribedRepsMin: number; prescribedRepsMax: number; prescribedWeightKg: number } {
  return {
    exercise: { name },
    prescribedSets: 3,
    prescribedRepsMin: Math.min(5, repsMax),
    prescribedRepsMax: repsMax,
    prescribedWeightKg: 60,
  };
}

const SESSION = {
  id: 'w-1', name: 'full_body', workoutType: 'Strength', sessionTier: 'core',
  dayOfWeek: 3, date: '2026-08-26',
  exercises: [
    row('Back Squat'),
    row('Bulgarian Split Squats'),
    row('Nordic Lower'),
    row('RDLs', 10),
    row('Bench Press'),
  ],
} as unknown as Workout;

run('the Bible :156 families are flagged, and nothing else is', () => {
  const flagged = teamNightFlaggedRows(SESSION);
  assert(flagged.map((f) => f.name).join('|') ===
    'Back Squat|Bulgarian Split Squats|Nordic Lower|RDLs',
    `flagged: ${JSON.stringify(flagged)}`);
  assert(flagged.every((f) => f.action === (f.name === 'RDLs' ? 'dose' : 'swap')),
    'the RDL entry is a dose action; the named three are swaps');
});

run('low-rep RDLs are FINE — Bible :157, flagged by dose, not identity', () => {
  const lowRep = { ...SESSION, exercises: [row('RDLs', 3)] } as unknown as Workout;
  assert(teamNightFlaggedRows(lowRep).length === 0,
    'a 2-3 rep RDL must not be flagged');
});

run('an upper session raises no ask at all', () => {
  const upper = { ...SESSION, exercises: [row('Bench Press'), row('Barbell Row')] } as unknown as Workout;
  assert(teamNightFlaggedRows(upper).length === 0, 'upper work is team-night-safe');
});

run('the safe version swaps the named three, keeps their dose, and trims the RDL', () => {
  const { workout, changes } = applyTeamNightSafeSwaps(SESSION);
  const names = (workout.exercises ?? []).map((r) =>
    (r as { exercise?: { name?: string } }).exercise?.name);
  assert(JSON.stringify(names) === JSON.stringify(
    ['Box Squat', 'Reverse Lunges', 'Hamstring Curl', 'RDLs', 'Bench Press']),
    `names after swap: ${JSON.stringify(names)}`);
  const box = (workout.exercises ?? [])[0] as { prescribedSets?: number; prescribedWeightKg?: number };
  assert(box.prescribedSets === 3 && box.prescribedWeightKg === 60,
    'a swapped row keeps its dose — the swap changes the pick, not the work');
  const rdl = (workout.exercises ?? [])[3] as { prescribedRepsMin?: number; prescribedRepsMax?: number; prescribedWeightKg?: number };
  assert(rdl.prescribedRepsMin === 2 && rdl.prescribedRepsMax === 3 && rdl.prescribedWeightKg === 60,
    `the RDL drops to the low-rep tier with its weight kept: ${JSON.stringify(rdl)}`);
  const bench = (workout.exercises ?? [])[4];
  assert(bench === (SESSION.exercises ?? [])[4], 'an unflagged row is byte-identical');
  assert(changes.length === 4, `four changes disclosed: ${JSON.stringify(changes)}`);
  for (const index of [0, 1, 2]) {
    const swapped = workout.exercises[index];
    assert(!!swapped.exerciseId && swapped.exerciseId === swapped.exercise?.id &&
      swapped.exerciseId !== SESSION.exercises[index].exerciseId,
    'a safe swap must replace exercise identity, not just its displayed name');
  }
});

run('a safe session flags nothing — the swap and the flag cannot loop', () => {
  const { workout } = applyTeamNightSafeSwaps(SESSION);
  assert(teamNightFlaggedRows(workout).length === 0,
    'the safe version must itself be team-night-safe');
});

run('every replacement exists in the vocabulary and shares a slot family', () => {
  const names = new Set(selectableExerciseNames());
  const pairs: Array<[string, string]> = [
    ['Back Squat', 'Box Squat'],
    ['Bulgarian Split Squats', 'Reverse Lunges'],
    ['Nordic Lower', 'Hamstring Curl'],
  ];
  for (const [from, to] of pairs) {
    assert(names.has(to), `replacement "${to}" is not in the selectable vocabulary`);
    const fromSlots = slotsForExerciseName(composedIdentityFor(from));
    const toSlots = slotsForExerciseName(composedIdentityFor(to));
    assert(toSlots.some((slot) => (fromSlots as readonly string[]).includes(slot as string)),
      `"${to}" (${toSlots}) shares no slot with "${from}" (${fromSlots})`);
    assert(canonicalExerciseName(to) !== canonicalExerciseName(from), 'a swap must change the pick');
  }
});

run('two routes, and the keep warning is short', () => {
  assert(JSON.stringify(TEAM_NIGHT_CONTENT_ROUTE_IDS) === JSON.stringify(['swap_safe', 'keep_regular']),
    'the ruled routes are swap_safe and keep_regular');
  assert(TEAM_NIGHT_CONTENT_ASK.keepWarning.length < 120,
    'Sam: "Nothing long just a clear warning" — keep it one sentence');
});

/* ── THE FUNNEL, at the source level (same idiom as the R-107 cells) ─────── */

const repoRoot = path.join(__dirname, '..');
const producer = fs.readFileSync(path.join(repoRoot, 'utils', 'planChangeProducer.ts'), 'utf8');
const sheet = fs.readFileSync(path.join(repoRoot, 'screens', 'home', 'PlanChangeSheet.tsx'), 'utf8');

run('the producer raises the ask BEFORE the move materialises — routeless applies nothing', () => {
  const askAt = producer.indexOf("error: 'team_night_content_route_required'");
  const moveInputAt = producer.indexOf('const input = athleteMoveInput({');
  assert(askAt > 0, 'the routeless sentinel is gone from the producer');
  assert(moveInputAt > askAt, 'the ask must be raised before athleteMoveInput materialises the move');
});

run('swap_safe transforms the ARRIVING content at the anchor-stack seam', () => {
  assert(/teamNightContentRoute === 'swap_safe'\s*\?\s*applyTeamNightSafeSwaps\(/.test(producer),
    'the arriving-content transform is gone');
});

run('the sheet funnels the ask and routes keep_regular through the warning step', () => {
  assert(sheet.includes("kind: 'team_night_content_ask'"), 'the ask step is gone from the sheet');
  assert(/team_night_content_ask[\s\S]{0,3000}teamNightContentRoute: 'keep_regular'[\s\S]{0,400}keepWarning/.test(sheet),
    "keep_regular no longer detours through the confirm warning (Sam: 'again be given a warning')");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
