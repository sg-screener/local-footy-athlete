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
  useBlockSelectionHistoryStore.setState({ selections: [] } as never);
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
}

console.log(`\nBlock selection authority: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
