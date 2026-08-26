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

import { SCENARIOS, runScenario, projectWithGapsMarked, type PrintedWeek } from '../../scripts/print-week';
import { displayReps } from '../rules/prescriptionDisplay';
import { conditioningVisibleDoseFor } from '../rules/conditioningSelection';
import {
  blockBoundaryExplanationSentences,
  weekRefusalIsSpeakable,
  weekRefusalSentences,
} from '../rules/projectionCopy';
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
/** The thrown refusals themselves — surface 5b needs their typed findings. */
const REFUSALS: { slug: string; error: any }[] = [];

quiet(() => {
  for (const scenario of SCENARIOS) {
    try {
      WORLDS.push({ slug: scenario.slug, printed: runScenario(scenario) });
    } catch (e) {
      REFUSED.push(`${scenario.slug}: ${e instanceof Error ? e.message : String(e)}`);
      REFUSALS.push({ slug: scenario.slug, error: e });
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
// 3. ONE ATHLETE-FACING CONDITIONING PRESCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

run('every conditioning dose line is the shared resolved athlete prescription', () => {
  let checked = 0;
  for (const { slug, printed } of WORLDS) {
    for (const { date, row } of allRows(printed.visibleWeek)) {
      const dose = conditioningVisibleDoseFor(String(row.name));
      if (!dose) {
        assert(row.dose.length === 0,
          `${slug} ${date}: "${String(row.name)}" carries dose lines but resolves to no `
          + 'authored template. A dose the projection cannot trace is an invention.');
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
          + `shared conditioning projection says "${want[i]}". A surface has drifted.`);
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

// ═══════════════════════════════════════════════════════════════════════════
// 6. TYPED KIT GAPS ARE VISIBLE (surface 4)
// ═══════════════════════════════════════════════════════════════════════════

run('every typed gap the composer recorded reaches the athlete, and none is invented', () => {
  let withGaps = 0;
  for (const { slug, printed } of WORLDS) {
    for (let i = 0; i < printed.weekDays.length; i += 1) {
      const stored = ((printed.weekDays[i].workout as any)?.composedGaps ?? []) as readonly any[];
      const day = printed.visibleWeek.days.find((d) => d.date === printed.weekDays[i].date);
      if (!day) continue;
      // A slot outside the authored union carries no sentence BY DESIGN (a copy
      // gap, declared). So the visible count may be lower than the stored count,
      // never higher — an extra sentence would be the projection inventing a gap.
      assert(day.gaps.length <= stored.length,
        `${slug} ${day.date}: ${day.gaps.length} gap sentences from ${stored.length} stored `
        + 'gaps. The projection is announcing a gap the composer never recorded.');
      if (stored.length > 0) {
        assert(day.gaps.length === stored.length,
          `${slug} ${day.date}: the composer recorded ${stored.length} typed gap(s) and the `
          + `athlete is shown ${day.gaps.length}. A gap the app worked out and then kept to `
          + 'itself is the defect Sam named.');
        withGaps += 1;
        for (const gap of stored) {
          if (gap?.cause !== 'kit') continue;
          const slotWords = String(gap.slot).replace(/_/g, ' ');
          assert(day.gaps.some((line) => String(line).includes(slotWords)),
            `${slug} ${day.date}: a kit gap on "${gap.slot}" is stored but no visible line `
            + `names it. Lines: ${day.gaps.map(String).join(' | ')}`);
        }
      }
    }
  }
  assert(withGaps > 0,
    'no world carried a typed gap at all — this cell would pass on an app that had '
    + 'stopped recording gaps entirely, which is not what it is for. `10-dumbbell-away` '
    + 'exists precisely so a kit gap is reachable.');
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. EXPLANATIONS AGREE EXACTLY WITH THE STORED PROGRAM (surface 5)
// ═══════════════════════════════════════════════════════════════════════════

run('block-boundary explanations agree exactly with the stored program', () => {
  for (const { slug, printed } of WORLDS) {
    const want = blockBoundaryExplanationSentences(printed.program as never).map(String);
    const got = printed.visibleWeek.explanations.map(String);
    assert(JSON.stringify(got) === JSON.stringify(want),
      `${slug}: the week shows ${JSON.stringify(got)} but the stored program explains `
      + `${JSON.stringify(want)}. An explanation that does not match the decision it `
      + 'describes is worse than none.');
  }
});

run('a stored load increase actually reaches the athlete — the wiring is not inert', () => {
  // NON-VACUITY, DELIBERATELY FIXTURE-DRIVEN. None of Sam's print scenarios
  // crosses a block boundary (they all generate a FIRST block with no previous
  // program), so the agreement cell above is satisfied by empty === empty on
  // every real world. That would let the whole surface be deleted and stay
  // green. This drives `project()` with a stored explanation row directly, which
  // is the smallest thing that proves the carrier is wired at all.
  //
  // It does NOT replace a real Block Two world. That gap is declared in the
  // mission report rather than papered over here.
  const week = projectWithGapsMarked({
    week: WORLDS[0].printed.weekDays,
    weekStart: WORLDS[0].printed.visibleWeek.weekStart,
    program: {
      blockBoundaryExplanation: [{
        kind: 'history_progressed',
        exerciseName: 'Back Squat',
        previousLoadKg: 80,
        nextLoadKg: 85,
      }],
    } as never,
  }).visibleWeek;
  assert(week.explanations.length === 1,
    `a stored load increase produced ${week.explanations.length} sentences, not 1. The `
    + 'carrier is not wired — which is exactly the state surface 5 was found in: the '
    + 'sentences were built and signed and nothing production-side read them.');
  const line = String(week.explanations[0]);
  for (const must of ['Back Squat', '80', '85']) {
    assert(line.includes(must),
      `the sentence "${line}" does not carry "${must}" from the stored row. An explanation `
      + 'must agree exactly with the decision it describes.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. A TYPED REFUSAL SPEAKS (surface 5b)
// ═══════════════════════════════════════════════════════════════════════════

run('every typed refusal produces visible athlete text, in Sam\'s three lines', () => {
  assert(REFUSALS.length > 0,
    'no world refused at all, so this cell is vacuous — the two that refuse on main '
    + 'are what make the refusal surface reachable');
  for (const { slug, error } of REFUSALS) {
    const findings = error?.findings;
    assert(Array.isArray(findings) && findings.length > 0,
      `${slug} refused without typed findings — the refusal is not typed, and nothing `
      + 'can be said about a reason that does not exist');
    const lines = weekRefusalSentences(findings).map(String);
    assert(lines.length >= 3,
      `${slug}: a typed refusal produced ${lines.length} lines. Sam's structure is a lead, `
      + 'at least one cause, and the fix line.');
    assert(lines[0] === "We couldn't build a safe week from your current setup.",
      `${slug}: first line is "${lines[0]}", not Sam's lead sentence.`);
    assert(lines[lines.length - 1] === 'Update the relevant answer and try again.',
      `${slug}: last line is "${lines[lines.length - 1]}", not Sam's fix sentence.`);
    for (const middle of lines.slice(1, -1)) {
      assert(middle.length > 0 && middle !== lines[0],
        `${slug}: a middle line is empty or a repeat of the lead`);
    }
    assert(weekRefusalIsSpeakable(findings),
      `${slug}: the refusal is not speakable, so a surface would have nothing to show`);
  }
});

run('different typed causes get different sentences — nothing is collapsed', () => {
  const blocking = (clause: string) => [{ clause, severity: 'blocking' }];
  const middleFor = (clause: string) =>
    weekRefusalSentences(blocking(clause)).map(String).slice(1, -1).join(' ');

  const clauses = [
    'main_strength_required_minimum',
    'main_strength_planner_selected_target',
    'main_strength_permitted_maximum',
    'required_safe_patterns_present',
    'pattern_balance',
    'prohibited_patterns_absent',
    'core_conditioning_required_minimum',
    'sprint_high_speed_required_minimum',
    'full_rest_required_minimum',
    'hard_day_permitted_maximum',
    'training_paused_means_no_training',
    'prohibited_power_absent',
    'prohibited_sprint_absent',
    'row_role_is_declared',
  ];
  const seen = new Map<string, string>();
  for (const clause of clauses) {
    const middle = middleFor(clause);
    assert(middle.length > 0,
      `clause "${clause}" has no athlete sentence. Every typed cause carries its own.`);
    const clash = seen.get(middle);
    assert(clash === undefined,
      `"${clause}" and "${clash}" produce the SAME sentence: "${middle}". Sam: do not `
      + 'collapse different causes into one generic message.');
    seen.set(middle, clause);
  }

  // Two blocking causes at once say BOTH; one cause found twice says it ONCE.
  const two = weekRefusalSentences([
    { clause: 'hard_day_permitted_maximum', severity: 'blocking' },
    { clause: 'full_rest_required_minimum', severity: 'blocking' },
  ]).map(String);
  assert(two.length === 4, `two causes produced ${two.length} lines, expected 4`);
  const twice = weekRefusalSentences([
    { clause: 'full_rest_required_minimum', severity: 'blocking' },
    { clause: 'full_rest_required_minimum', severity: 'blocking' },
  ]).map(String);
  assert(twice.length === 3,
    `one cause found twice produced ${twice.length} lines — a cause is reported once`);
});

run('a refused week is never presented as an empty successful program', () => {
  for (const { slug, error } of REFUSALS) {
    // 1. THERE IS NO WEEK. The refusal THREW; nothing was returned that a
    //    surface could mistake for a week with no sessions in it.
    assert(!(error as any)?.program && !(error as any)?.visibleWeek,
      `${slug}: the refusal carries a program — a caught refusal that hands back a week `
      + 'is exactly the "empty successful program" this cell exists to forbid');
    // 2. AND IT HAS WORDS. A refusal with no sentence is indistinguishable, on
    //    the glass, from a week with nothing in it.
    assert(weekRefusalIsSpeakable((error as any).findings),
      `${slug}: refused with no words. A surface catching this would render blank, and a `
      + 'blank week reads as "nothing to do today" rather than "we could not build this".');
  }
  // A disclosed gap is NOT a refusal and must not produce refusal text — that
  // would put "we couldn't build a safe week" on a week that WAS built.
  assert(!weekRefusalIsSpeakable([{ clause: 'required_safe_patterns_present', severity: 'disclosed_gap' }]),
    'a disclosed gap produced refusal text. A disclosable clause fails WITHOUT refusing '
    + 'the week (R-083), and the athlete already learns about it through the day gaps.');
});

console.log(`\nAthlete-visible projection totals: ${passed} passed, ${failed} failed`);
if (REFUSED.length > 0) {
  console.log(`  worlds that refused to generate (red on main, not this mission's):`);
  for (const line of REFUSED) console.log(`    ${line}`);
}
totalsPrinted(failed);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
