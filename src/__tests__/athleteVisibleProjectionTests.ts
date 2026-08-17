/**
 * WHAT THE ATHLETE ACTUALLY READS — held against what the composer authored.
 *
 * Sam's order, 2026-08-17: *"Make the program the athlete sees accurately express
 * the program already authored and accepted."* Five surfaces, all display. This
 * suite is the executable half of that sentence, and its subject is the
 * relationship between two things rather than either one alone:
 *
 *   STORED ACCEPTED PROGRAM   →   VISIBLE PROJECTION
 *
 * ## IT RUNS REAL GENERATED WORLDS, NOT FIXTURES
 *
 * Every cell projects weeks built by `generateProgramLocally` and resolved
 * through `buildProgramTabProjectedWeek` + `project()` — the app's own read
 * chain, reached through `scripts/print-week.ts`'s `runScenario`, which is the
 * one place that chain is already assembled correctly. A second hand-built
 * `ScheduleState` is how that script's own two harness bugs were born, and its
 * header says so; this suite does not grow a third.
 *
 * The worlds are Sam's proof list: pre-season sprint + upper + hard
 * conditioning, off-season sprint/tempo/4×4, the dumbbell-away week, in-season
 * with club nights, and a bye.
 *
 * ## WHAT IS PINNED
 *
 *   1. NO `1 × 1`. A placeholder never reaches the athlete as a prescription.
 *   2. ONE REP NUMBER (R-016) — and it is `displayReps` of the STORED range, so
 *      the cell fails both if a range comes back and if the number stops being
 *      the ruled midpoint.
 *   3. THE AUTHORED DOSE, VERBATIM. Every dose line's text is the authored
 *      template field it claims to be — work, rest, sets/rounds, total.
 *   4. SPRINT WORK READS UNDER SPEED, and not under strength.
 *   5. **CONSERVATION, THE POINT OF THE WHOLE MISSION.** No row the composer
 *      authored is missing from the projection, and no row is duplicated across
 *      two parts. A read layer may group and format; it may never delete,
 *      substitute or re-author. This is the cell that makes "projection cannot
 *      remove or change an authored row" a fact rather than a promise.
 *
 * ## WHY NUMBER 5 IS EXPRESSED AS A SET DIFFERENCE, NOT A COUNT
 *
 * A count is satisfied by losing one row and gaining another — which is exactly
 * the failure mode Sam banned ("do not invent replacement exercises"). Ids are
 * compared as sets, both directions, and the message names the offending id.
 *
 * Run: npm run test:athlete-projection
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { SCENARIOS, runScenario, type PrintedWeek } from '../../scripts/print-week';
import { displayReps } from '../rules/prescriptionDisplay';
import { conditioningVisibleDoseFor } from '../rules/conditioningSelection';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { isComposedPrescriptionRow } from '../rules/projectVisibleWeek';
import type { VisibleRow, VisibleWeek } from '../rules/visibleProjection';
import type { Workout } from '../types/domain';

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}
function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally { console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l; }
}

/**
 * THE WORLDS, GENERATED ONCE.
 *
 * Two of Sam's nine scenarios REFUSE to generate on `main` itself
 * (`1-early-off-season`, `6-bodyweight-only` — typed
 * `GeneratedWeekRefusedError`s, red before this mission and untouched by it). A
 * refusal is not a projection defect, so it is recorded and skipped rather than
 * failing a display cell — and the count is asserted below, so a world that
 * starts refusing LATER cannot slip past as "one of the known two".
 */
interface World {
  readonly slug: string;
  readonly printed: PrintedWeek;
}

const WORLDS: World[] = [];
const REFUSED: string[] = [];

quiet(() => {
  for (const scenario of SCENARIOS) {
    try {
      WORLDS.push({ slug: scenario.slug, printed: runScenario(scenario) });
    } catch (e) {
      REFUSED.push(`${scenario.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
});

console.log('\n-- Athlete-visible projection --');
console.log(`  worlds generated: ${WORLDS.length}, refused: ${REFUSED.length}`);

/**
 * THE STORED ACCEPTED WORKOUTS — the left-hand side of Sam's comparison.
 *
 * `printed.weekDays` and NOT `printed.program`: generation's microcycle is not
 * the accepted week. The resolver relocates sessions (a bye week is the case
 * that proved it), so a row can be legitimately accepted onto a date the
 * generated program never named. Comparing the projection against `program`
 * reads that relocation as an invented row — this suite's first draft did
 * exactly that and failed on `4-bye-week`.
 */
function acceptedWorkouts(printed: PrintedWeek): { date: string; workout: Workout }[] {
  return printed.weekDays
    .filter((day) => !!day.workout)
    .map((day) => ({ date: day.date, workout: day.workout as Workout }));
}

function allRows(week: VisibleWeek): { date: string; partKind: string; row: VisibleRow }[] {
  const out: { date: string; partKind: string; row: VisibleRow }[] = [];
  for (const day of week.days) {
    for (const part of day.parts) {
      for (const row of part.rows) out.push({ date: day.date, partKind: part.kind, row });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 0. THE WORLDS THEMSELVES
// ═══════════════════════════════════════════════════════════════════════════

run('the proof worlds generate, and the two known refusals stay exactly two', () => {
  assert(WORLDS.length >= 7,
    `only ${WORLDS.length} worlds generated — the display cells below are vacuous `
    + `without them. Refusals: ${REFUSED.join(' | ')}`);
  assert(REFUSED.length === 2,
    `${REFUSED.length} scenarios refused to generate, not the 2 that already refuse `
    + `on main (1-early-off-season, 6-bodyweight-only). Refusals: ${REFUSED.join(' | ')}`);
  for (const want of ['7-no-club-pre-season', '9-later-off-season', '5-away-trip']) {
    assert(WORLDS.some((w) => w.slug === want),
      `${want} is one of the three weeks Sam asked to be printed and it did not generate`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. NO "1 × 1"
// ═══════════════════════════════════════════════════════════════════════════

run('no athlete ever reads "1 × 1" where a real prescription exists', () => {
  for (const { slug, printed } of WORLDS) {
    for (const { date, row } of allRows(printed.visibleWeek)) {
      const text = row.prescription === null ? '' : String(row.prescription);
      assert(!/^\s*1\s*×\s*1\s*$/.test(text),
        `${slug} ${date}: "${String(row.name)}" reads "${text}". That is the composer's `
        + 'placeholder, not a dose — the authored prescription is on the template the '
        + 'row was built from.');
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ONE REP NUMBER, AND IT IS THE RULED MIDDLE ONE (R-016)
// ═══════════════════════════════════════════════════════════════════════════

run('a strength prescription is one number, and it is displayReps of the STORED range', () => {
  let checked = 0;
  for (const { slug, printed } of WORLDS) {
    const byId = new Map<string, any>();
    for (const { workout } of acceptedWorkouts(printed)) {
      for (const ex of (workout as any)?.exercises ?? []) byId.set(String(ex?.id), ex);
    }
    for (const { date, row } of allRows(printed.visibleWeek)) {
      if (row.prescription === null) continue;
      const text = String(row.prescription);
      const setsReps = text.match(/^(\d+)\s*×\s*(\d+)$/);
      const stored = byId.get(row.id);
      if (!stored) continue;
      assert(!/^\s*\d+\s*×\s*\d+\s*-\s*\d+\s*$/.test(text),
        `${slug} ${date}: "${String(row.name)}" reads "${text}" — a RANGE. R-016: the `
        + 'athlete sees a single middle number. The stored range stays the generation '
        + 'source; it is not what the athlete reads.');
      if (!setsReps) continue;
      const min = Number(stored.prescribedRepsMin);
      const max = Number(stored.prescribedRepsMax);
      if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
      const want = displayReps(min, max);
      if (want === null) continue;
      assert(Number(setsReps[2]) === want,
        `${slug} ${date}: "${String(row.name)}" shows ${setsReps[2]} reps, but the stored `
        + `range is ${min}-${max} whose ruled middle number is ${want}. The display and `
        + 'the logging midpoint must be the same number or they drift.');
      assert(Number(setsReps[1]) === Number(stored.prescribedSets),
        `${slug} ${date}: "${String(row.name)}" shows ${setsReps[1]} sets, stored is `
        + `${stored.prescribedSets}. Projection may format a dose; it may not change one.`);
      checked += 1;
    }
  }
  assert(checked >= 20, `only ${checked} sets×reps rows were checked — the cell is thin`);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE AUTHORED CONDITIONING DOSE, VERBATIM
// ═══════════════════════════════════════════════════════════════════════════

run('every conditioning dose line is the authored template field, word for word', () => {
  let checked = 0;
  for (const { slug, printed } of WORLDS) {
    for (const { date, row } of allRows(printed.visibleWeek)) {
      const dose = conditioningVisibleDoseFor(String(row.name));
      if (!dose) {
        assert(row.dose.length === 0,
          `${slug} ${date}: "${String(row.name)}" carries dose lines but resolves to no `
          + 'authored template. A dose the sheet did not author is an invention.');
        continue;
      }
      assert(row.dose.length === 4,
        `${slug} ${date}: "${String(row.name)}" resolves to an authored dose but shows `
        + `${row.dose.length} lines, not 4. Sam asked for work, rest, rounds and useful `
        + 'duration — all four.');
      const lines = row.dose.map(String);
      const want = [
        `Work: ${dose.work}`,
        `Rest: ${dose.rest}`,
        `Sets: ${dose.setsRounds}`,
        `Takes about: ${dose.totalSessionTime}`,
      ];
      for (let i = 0; i < want.length; i += 1) {
        assert(lines[i] === want[i],
          `${slug} ${date}: "${String(row.name)}" line ${i + 1} reads "${lines[i]}" but the `
          + `authored template says "${want[i]}". The projection is rewriting Sam's sheet.`);
      }
      assert(row.prescription === null,
        `${slug} ${date}: "${String(row.name)}" shows BOTH an authored dose and the `
        + `sets×reps line "${String(row.prescription)}". One row, one prescription.`);
      checked += 1;
    }
  }
  assert(checked >= 5, `only ${checked} authored conditioning rows were checked — thin`);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SPRINT WORK READS UNDER SPEED
// ═══════════════════════════════════════════════════════════════════════════

run('sprint work is grouped under Speed, never under Strength', () => {
  let seen = 0;
  for (const { slug, printed } of WORLDS) {
    for (const { workout } of acceptedWorkouts(printed)) {
      const ids = ((workout as any)?.speedBlock?.exerciseIds ?? []).map(String);
      if (ids.length === 0) continue;
      const present = new Set(
        ((workout as any).exercises ?? []).map((ex: any) => String(ex?.id)).filter((id: string) => ids.includes(id)),
      );
      if (present.size === 0) continue;
      for (const { date, partKind, row } of allRows(printed.visibleWeek)) {
        if (!present.has(row.id)) continue;
        seen += 1;
        assert(partKind === 'speed',
          `${slug} ${date}: "${String(row.name)}" belongs to the day's speed block but the `
          + `projection filed it under "${partKind}". Sam, 2026-08-17: sprint work appears `
          + 'under Speed.');
      }
    }
  }
  assert(seen > 0,
    'no speed-block row reached the projection in ANY world — this cell would pass on an '
    + 'app that had deleted sprint work entirely, which is not what it is for');
});

run('a Speed part is never a name with nothing under it', () => {
  for (const { slug, printed } of WORLDS) {
    for (const day of printed.visibleWeek.days) {
      for (const part of day.parts) {
        if (part.kind !== 'speed') continue;
        assert(part.rows.length > 0,
          `${slug} ${day.date}: a Speed block is on the day with no exercises under it. `
          + 'That is the defect Sam saw: the rows were under Strength.');
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONSERVATION — THE PROJECTION MAY NOT DELETE OR DUPLICATE AUTHORED WORK
// ═══════════════════════════════════════════════════════════════════════════

run('every authored row the composer owns reaches the athlete — none lost, none duplicated', () => {
  let checkedWorlds = 0;
  for (const { slug, printed } of WORLDS) {
    for (const { workout } of acceptedWorkouts(printed)) {
      const buckets = getSessionComponentRows(workout);
      // The rows the row-owner says belong to a part kind the projection renders.
      // `power`, `team_training` and add-ons have no row surface in `project()`
      // and are excluded here rather than silently — see `rowsForKind`.
      const owned = [
        ...buckets.strengthRows,
        ...buckets.supportRows,
        ...buckets.conditioningRows,
        ...buckets.speedRows,
      ]
        // Composed prescription rows are a DECLARED drop with a named owner
        // (`isComposedPrescriptionRow`, walker law L-P3). Excluded by the same
        // predicate the projection uses, so this cell cannot disagree with it.
        .filter((row: any) => !isComposedPrescriptionRow(row))
        .map((row: any) => String(row?.id));
      if (owned.length === 0) continue;

      const shown = allRows(printed.visibleWeek)
        .filter((entry) => owned.includes(entry.row.id))
        .map((entry) => entry.row.id);

      for (const id of owned) {
        assert(shown.includes(id),
          `${slug}: authored row "${id}" (workout day ${(workout as any).dayOfWeek}) is owned by a `
          + 'part kind the projection renders, and the athlete never sees it. A read layer '
          + 'may not delete work the composer authored.');
      }
      const counts = new Map<string, number>();
      for (const id of shown) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, n] of counts) {
        assert(n === 1,
          `${slug}: row "${id}" is rendered ${n} times across parts. A row belongs to one `
          + 'part; two is the athlete being told to do it twice.');
      }
      checkedWorlds += 1;
    }
  }
  assert(checkedWorlds >= 10,
    `only ${checkedWorlds} workouts were conservation-checked — the cell is thin`);
});

run('the projection never invents a row the accepted program does not hold', () => {
  for (const { slug, printed } of WORLDS) {
    const stored = new Set<string>();
    for (const { workout } of acceptedWorkouts(printed)) {
      for (const ex of (workout as any)?.exercises ?? []) stored.add(String(ex?.id));
    }
    if (stored.size === 0) continue;
    for (const { date, partKind, row } of allRows(printed.visibleWeek)) {
      // Fixture stubs and appointment placeholders carry no stored rows; they
      // also produce no rows here, so anything that DOES appear must be stored.
      assert(stored.has(row.id),
        `${slug} ${date}: the ${partKind} part shows row "${row.id}" ("${String(row.name)}") `
        + 'which the accepted program does not contain. Projection may format authored '
        + 'data; it may never author.');
    }
  }
});

console.log(`\nAthlete-visible projection totals: ${passed} passed, ${failed} failed`);
if (REFUSED.length > 0) {
  console.log(`  worlds that refused to generate (red on main, not this mission's):`);
  for (const line of REFUSED) console.log(`    ${line}`);
}
totalsPrinted(failed);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
