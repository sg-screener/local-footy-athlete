/**
 * A REPLAY MAY NOT RE-AUTHOR A BLOCK — the guard for `LAW-a-replay-never-reauthors`.
 *
 * ## THE DEFECT THIS HOLDS, MEASURED BEFORE THE FIX (2026-08-18, seat `visible`)
 *
 * `quiescentBoot` regenerates the whole program on every launch and passed
 * `recordSelections: true`. At one boot a `today_only` exclusion was still live,
 * the composer picked a different squat, and the boot RECORDED that pick as the
 * block's history. `recordBlockSelections` replaces a block's rows by design, so
 * the athlete's original main lift was not shadowed — it was destroyed, from
 * `currentProgram` AND from the selection history, which is the input every
 * future generation reads. Nothing was left to re-derive from and no rebuild
 * could help.
 *
 * **A reversible, dated decision was laundered into a permanent generation
 * INPUT.** `applyExerciseExclusionDecision` states the opposite contract in its
 * own return value (`rebuildRequired: scope !== 'today_only'`, because a
 * today-only answer "does not change what future generation may choose"), and
 * the recorder's own comment says it exists to stop a boot re-deriving a
 * different past when exclusions change. The boot defeated the protection with
 * the protection's own pen.
 *
 * ## WHY IT IS A CELL AND NOT A COMMENT
 *
 * The fix is one word at five call sites, which is exactly the kind of change a
 * later edit reverts without noticing. The cells below drive the REAL
 * `generateProgramLocally` and read the REAL store — never a description of
 * which function was called, because this repo has shipped 116 green cells that
 * asserted a function name while the defect sat in an argument.
 *
 * ## THE CONTROLS ARE HALF THE CELLS, DELIBERATELY
 *
 * Cell 2 proves the exclusion genuinely moves the composer's pick — without it,
 * cell 1 would pass just as well on an app that had stopped reading exclusions
 * at all. Cell 3 proves a replay still records a block nobody has recorded,
 * which is the property the blunt fix (`recordSelections: false`) would break
 * and the reason the recording exists.
 */
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  blockSelectionHistory,
  useBlockSelectionHistoryStore,
} from '../store/blockSelectionHistoryStore';
import { commercialGymEquipmentAnswer } from './support/equipmentAnswerFixture';
import type { OnboardingData } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { pass += 1; console.log(`  PASS ${label}`); return; }
  fail += 1; failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const BLOCK_START = '2026-07-06';

function athlete(): OnboardingData {
  return {
    name: 'Replay Test',
    age: 24,
    gender: 'male', seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: commercialGymEquipmentAnswer(),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
  } as unknown as OnboardingData;
}

function resetHistory(): void {
  useBlockSelectionHistoryStore.setState({
    selections: [], conditioningSelections: [], powerSelections: [],
  } as never);
}

/**
 * THE POWER HISTORY IS IDENTITY AND ROTATION INPUT, NEVER WORKOUT CONTENT.
 *
 * `c3b5f71b` (2026-08-31) added `powerSelections` beside the exercise and
 * conditioning histories. It is the same class of row — which identity each
 * power seat chose for a block — persisted as a rotation INPUT so a boot cannot
 * re-derive a different Primer. The store's own header rules out a program
 * snapshot ("No dose, no sets, no load"), but nothing checked the NEW array:
 * the writer census (`docs/WEEKLY_WRITER_CENSUS_AUDIT_2026-09-03.md` §4.3.2)
 * found no cell holding it to identity only. This is that cell.
 *
 * It reads the bytes the persist middleware would write (`partialize`), not
 * the in-memory rows, because the law is about what reaches disk.
 */
const POWER_ROW_KEYS = ['blockStartISO', 'exerciseName', 'family', 'seatIndex'] as const;
const GENERATED_CONTENT_KEYS = [
  'sets', 'reps', 'repsMin', 'repsMax', 'prescribedSets', 'prescribedRepsMin', 'prescribedRepsMax',
  'prescribedWeightKg', 'prescribedRestSeconds', 'weight', 'weightKg', 'load', 'restSeconds',
  'exercise', 'exercises', 'workout', 'workouts', 'notes', 'cues', 'description', 'id', 'workoutId',
  'durationMinutes', 'intensity',
];

/** The `powerSelections` slice exactly as the persist middleware would store it. */
function persistedPowerRows(): unknown[] {
  const options = (useBlockSelectionHistoryStore as unknown as {
    persist: { getOptions: () => { partialize?: (state: unknown) => { powerSelections?: unknown[] } } };
  }).persist.getOptions();
  const persisted = options.partialize
    ? options.partialize(useBlockSelectionHistoryStore.getState())
    : (useBlockSelectionHistoryStore.getState() as { powerSelections?: unknown[] });
  return JSON.parse(JSON.stringify(persisted.powerSelections ?? [])) as unknown[];
}

/** Every key at every depth of a JSON value. */
function keysDeep(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) { for (const item of value) keysDeep(item, into); return into; }
  if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      into.add(key); keysDeep(inner, into);
    }
  }
  return into;
}

/**
 * Generate the block, optionally excluding `excluded` for the WHOLE week.
 *
 * ⚠ **THE SCOPE HAD TO BE `until_changed`, AND THAT IS THE POINT.** A
 * `today_only` answer never reaches the recorded base at all — `composeWeek`
 * keeps dated answers out of `baseLegal` by `LAW-temporary-equipment-never-permanent`
 * — so a today-only control passes on an app that has stopped recording
 * entirely. `until_changed` is a whole-week answer that LEGITIMATELY changes
 * what future generation may choose, which makes it the hardest case for the
 * law under test: even an answer that is entitled to move the record may only
 * move it through the door that AUTHORS the block, never through a replay.
 */
function generate(
  recordSelections: 'author' | 'replay' | false,
  excluded: string | null,
): void {
  generateProgramLocally(athlete(), {
    todayISO: BLOCK_START,
    blockNumber: 1,
    recordSelections,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    ...(excluded
      ? {
        athletePrefs: {
          excluded: [],
          pinned: [],
          /* ⚠ THE FIELD IS `exercise`, NOT `exerciseName`. The first cut of
           * this fixture used `exerciseName`; `resolveWeekExclusions` reads
           * `exclusion.exercise`, so the exclusion was `undefined` and
           * completely inert — and the CONTROL is what caught it. A fixture is
           * a claim too. */
          exclusions: [{
            exercise: excluded,
            scope: 'until_changed' as const,
            decidedOnISO: BLOCK_START,
            activeThroughISO: null,
            blockNumber: 1,
          }],
        } as never,
      }
      : {}),
  } as never);
}

/** What the store says this block chose for `slot`. */
function recorded(slot: string): string | null {
  const row = blockSelectionHistory()
    .find((entry) => entry.slot === slot && entry.blockStartISO === BLOCK_START);
  return row ? String((row as { identity?: string }).identity ?? '') : null;
}

/** The slot with a recorded identity we can meaningfully exclude. */
function firstRecordedSlot(): { slot: string; identity: string } | null {
  const row = blockSelectionHistory().find((entry) => entry.blockStartISO === BLOCK_START);
  if (!row) return null;
  const typed = row as { slot?: string; identity?: string };
  if (!typed.slot || !typed.identity) return null;
  return { slot: typed.slot, identity: typed.identity };
}

console.log('\n-- A replay may not re-author a block --');

/* ── SETUP: the authoring door records the block, with no exclusion live. ──── */
resetHistory();
generate('author', null);
const authored = firstRecordedSlot();
ok('SETUP — the authoring door recorded the block',
  authored !== null, 'no rows recorded, so every cell below would be vacuous');

if (authored) {
  /* ── CELL 2 (CONTROL, RUN FIRST) — the exclusion really does move the pick. ──
   * Run before cell 1 so a world where exclusions are inert cannot let cell 1
   * pass by accident. */
  resetHistory();
  generate('author', null);
  generate('author', authored.identity);
  const afterAuthorWithExclusion = recorded(authored.slot);
  ok('CONTROL — an AUTHOR regeneration under the exclusion DOES replace the row',
    afterAuthorWithExclusion !== null && afterAuthorWithExclusion !== authored.identity,
    `slot ${authored.slot}: recorded ${String(afterAuthorWithExclusion)}, `
    + `expected something other than ${authored.identity}`);

  /* ── CELL 1 — THE DEFECT. A replay under the same exclusion must not move it. */
  resetHistory();
  generate('author', null);
  generate('replay', authored.identity);
  const afterReplay = recorded(authored.slot);
  ok('a REPLAY under a whole-week exclusion leaves the recorded row untouched',
    afterReplay === authored.identity,
    `slot ${authored.slot}: recorded ${String(afterReplay)}, expected ${authored.identity}`);

  /* ── CELL 3 — and a replay still records a block nobody has recorded. ────────
   * The property `recordSelections: false` would have broken: without it every
   * launch rotates a never-authored block freely, which is the defect the
   * recording was introduced to stop. */
  resetHistory();
  generate('replay', null);
  ok('a REPLAY still records a block that has never been recorded',
    firstRecordedSlot() !== null,
    'a first-time replay wrote nothing, so an unauthored block rotates every launch');

  /* ── CELL 4 — a probe writes nothing at all. ────────────────────────────── */
  resetHistory();
  generate(false, null);
  ok('a PROBE records nothing',
    blockSelectionHistory().length === 0,
    `probe wrote ${blockSelectionHistory().length} rows into the athlete's history`);
  ok('a PROBE records no power seats either',
    persistedPowerRows().length === 0,
    `probe wrote ${persistedPowerRows().length} power rows into the athlete's history`);

  /* ── CELL 5 — persisted power selections are identity + rotation input only. ──
   * Anchor first: the authoring door must actually record power seats for this
   * athlete, or the shape cells below would pass over an empty array. */
  resetHistory();
  generate('author', null);
  const powerRows = persistedPowerRows();
  ok('SETUP — the authoring door recorded at least one power seat for the block',
    powerRows.length > 0
      && powerRows.every((row) => (row as { blockStartISO?: string }).blockStartISO === BLOCK_START),
    `power rows recorded: ${JSON.stringify(powerRows)}`);
  const powerKeysDeep = keysDeep(powerRows);
  const leakedContentKeys = GENERATED_CONTENT_KEYS.filter((key) => powerKeysDeep.has(key));
  ok('a persisted power selection carries NO generated workout content (no dose, load, rows or ids)',
    leakedContentKeys.length === 0,
    `generated-content keys found in the persisted power history: ${leakedContentKeys.join(', ')}`);
  const offShape = powerRows.filter((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
    const keys = Object.keys(row as Record<string, unknown>).sort();
    if (keys.join(',') !== [...POWER_ROW_KEYS].sort().join(',')) return true;
    const typed = row as Record<string, unknown>;
    return typeof typed.blockStartISO !== 'string' || typeof typed.family !== 'string'
      || typeof typed.exerciseName !== 'string' || typeof typed.seatIndex !== 'number';
  });
  ok('every persisted power selection is exactly {blockStartISO, family, seatIndex, exerciseName} of primitives',
    offShape.length === 0,
    `rows off the identity/rotation shape: ${JSON.stringify(offShape)}`);
  ok('each power seat is recorded once per block (rotation key family+seatIndex is unique)',
    new Set(powerRows.map((row) => {
      const typed = row as { family: string; seatIndex: number };
      return `${typed.family}:${typed.seatIndex}`;
    })).size === powerRows.length,
    `duplicate family/seat keys in ${JSON.stringify(powerRows)}`);
}

console.log(`\nBlock selection authority: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
