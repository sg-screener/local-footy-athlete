/**
 * EXERCISE ROTATION AND PREFERENCE PINNING — the behavioural guards.
 *
 * Subject: `rules/exerciseRotation.ts` and the contract's "Exercise rotation"
 * and "Athlete substitutions and exclusions".
 *
 * ⚠ **THE WORLD CELLS RUN AGAINST REAL `generateProgramLocally` PROGRAMS.** The
 * rows, the sets and the loads are the ones the generator actually put in front
 * of the athlete. Only the athlete's ANSWERS are chosen per scenario, because
 * those are the athlete's to give. Where a cell asks the owner directly it says
 * so and says why.
 *
 * ⚠ **EVERY CELL CARRIES ITS OWN LIVENESS.** A rotation cell that runs on a slot
 * the world never filled is green and empty — `a-bind-can-be-green-and-empty`.
 * Each cell below either asserts the subject was PRESENT or fails loudly.
 *
 * Run: npm run test:exercise-rotation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — rotation must be fully local');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import {
  commercialGymEquipmentAnswer,
  presetEquipmentAnswer,
} from './support/equipmentAnswerFixture';
import {
  decideExerciseForBlock,
  type BlockExerciseSelection,
  type ExerciseSelectionInputs,
} from '../rules/blockExerciseSelection';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import type { SessionFeedback } from '../store/programStore';
import {
  useBlockSelectionHistoryStore,
  recordBlockSelections,
  blockSelectionHistory,
} from '../store/blockSelectionHistoryStore';
import {
  acceptBlock,
  probeBlock,
  resetBlockSelectionHistory,
  recordedSelectionCount,
} from './support/acceptBlock';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* THE WORLDS                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ **THE CANONICAL COMMERCIAL-GYM ANSWER, DERIVED FROM THE PRODUCTION PRESET.**
 *
 * This used to be `fullKitEquipmentAnswer()`, a hand-authored ten-tag list whose
 * docstring claims "every tag" and which has been missing `rack` and `trap_bar`
 * since the 2026-08-13 split. Without a rack every barbell squat is kit-illegal,
 * which left Leg Press as the athlete's only experience-legal squat — an
 * artefact of the fixture that was nearly reported as a real pool gap.
 */
const FULL_KIT = commercialGymEquipmentAnswer();
/**
 * A partial kit — the canonical HOME GYM preset (dumbbells, bands, foam roller).
 *
 * ⚠ **A FIXTURE IS A CLAIM TOO.** An earlier version spread the full kit and
 * overrode `tags` with an ARRAY; `EquipmentAnswer.tags` is a RECORD of
 * `tag -> 'have'`, so the answer resolved to no kit and the "partial-kit" cells
 * were silently testing a BODYWEIGHT athlete. Cell [13]'s liveness now pins the
 * kit it actually got.
 */
const DUMBBELL_KIT = presetEquipmentAnswer('home_gym');

/**
 * ⚠ **THE GENUINE NO-RACK CONTROL, KEPT ON PURPOSE.** Sam, 2026-08-17: *"if an
 * athlete explicitly has machines but no rack and Leg Press is their only legal
 * experienced bilateral squat, retaining Leg Press is correct."* This is that
 * athlete — stated as a real answer, not as a fixture that forgot a tag — and it
 * is what stops the fixture repair above from also erasing the true case.
 */
const MACHINES_NO_RACK = {
  tags: {
    barbell: 'have', dumbbells: 'have', machine: 'have',
    bench: 'have', cables: 'have', pullup_bar: 'have',
  },
  modalities: {},
  answeredOn: '2026-07-01',
} as unknown as typeof FULL_KIT;

function athlete(overrides: Record<string, unknown> = {}): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: FULL_KIT,
    injuries: [],
    goals: ['Get stronger'],
    /* ⚠ `'Intermediate'` IS NOT IN `ExperienceLevel`. Earlier revisions of this
     * fixture used it; the crosswalk has no row for it and fell through to the
     * `consistent` default, so the athlete was experienced BY ACCIDENT. Stated
     * properly now — this is the moderate/experienced athlete Sam's ruling is
     * about, and the experience cells below depend on it being real. */
    experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
    ...overrides,
  } as unknown as OnboardingData;
}

const BLOCK_STARTS = ['2026-07-06', '2026-08-03', '2026-08-31', '2026-09-28'];
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

/**
 * ⚠ **A MULTI-BLOCK SCENARIO MUST RECORD, BECAUSE THE OWNER READS THE RECORD.**
 *
 * `recordSelections` defaults to FALSE — generation is also called speculatively
 * and a probe that writes history corrupts it. A cell that walks an athlete
 * through consecutive blocks is simulating ACCEPTANCE, so it opts in, and
 * `freshSelectionHistory()` isolates it from every other scenario in the file.
 */
function freshSelectionHistory(): void {
  useBlockSelectionHistoryStore.setState({ selections: [] } as never);
}

function build(args: {
  blockNumber: number;
  profile?: OnboardingData;
  feedback?: Record<string, SessionFeedback>;
  prefs?: { excluded?: string[]; pinned?: string[] };
  record?: boolean;
}): TrainingProgram {
  return generateProgramLocally(args.profile ?? athlete(), {
    todayISO: BLOCK_STARTS[args.blockNumber - 1],
    blockNumber: args.blockNumber,
    recordSelections: args.record === true ? 'author' : false,
    progressionHistory: {
      sessionFeedback: args.feedback ?? {},
      weightOverrides: {},
      blockState: null,
    },
    ...(args.prefs
      ? {
        athletePrefs: {
          excluded: args.prefs.excluded ?? [],
          pinned: args.prefs.pinned ?? [],
          exclusions: (args.prefs.excluded ?? []).map((name) => ({
            exerciseName: name, scope: 'until_changed' as const, decidedOnISO: BLOCK_STARTS[0],
          })),
        } as never,
      }
      : {}),
  });
}

/** A block-1 history that logs the real rows the generator produced. */
function logRealBlock(
  program: TrainingProgram,
  answers: Partial<SessionFeedback> = {},
): Record<string, SessionFeedback> {
  const sessions: SessionFeedback['strength'][] = [];
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      const rows = (w.exercises ?? [])
        .filter((r) => r.role !== 'conditioning' && (r.exercise?.name ?? '') !== '')
        .map((r) => ({
          exerciseId: r.exerciseId,
          workoutExerciseId: r.id,
          exerciseName: r.exercise?.name ?? '',
          prescribedSets: r.prescribedSets,
          prescribedRepsMin: r.prescribedRepsMin,
          prescribedRepsMax: r.prescribedRepsMax,
          weightKg: r.prescribedWeightKg ?? null,
          completion: 'full' as const,
        }));
      if (rows.length > 0) sessions.push(rows);
    }
  }
  const out: Record<string, SessionFeedback> = {};
  BLOCK_1_DATES.forEach((dateStr, i) => {
    out[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: sessions[i % Math.max(1, sessions.length)] ?? [],
      ...answers,
    } as SessionFeedback;
  });
  return out;
}

interface Row {
  week: number;
  day: number;
  name: string;
  sets: number;
  kg: number | undefined;
  isMain: boolean;
  mainSlot: string | null;
}

function rowsOf(program: TrainingProgram): Row[] {
  const out: Row[] = [];
  for (const [wi, mc] of program.microcycles.entries()) {
    for (const w of mc.workouts as Workout[]) {
      for (const e of w.exercises ?? []) {
        const name = e.exercise?.name ?? '';
        if (!name || e.role === 'conditioning') continue;
        out.push({
          week: wi + 1,
          day: (w as unknown as { dayOfWeek: number }).dayOfWeek,
          name,
          sets: e.prescribedSets,
          kg: e.prescribedWeightKg,
          isMain: mainSlotOf(e as never) !== null,
          mainSlot: mainSlotOf(e as never),
        });
      }
    }
  }
  return out;
}

/**
 * ⚠ **MAIN/SECONDARY IS THE ROW'S OWN `section18Evidence.slot`, NOT ANCHOR-BENCH
 * MEMBERSHIP.** Anchor membership made every partial-kit cell VACUOUS: every
 * anchor is a barbell lift, so a dumbbell athlete has no anchor rows at all and
 * cell [13]'s stability check was comparing an empty set to itself.
 * `slotCountsTowardSetBudget` is the app's own answer, and it is kit-blind.
 */
function mainSlotOf(row: { section18Evidence?: { slot?: string } }): string | null {
  const slot = row.section18Evidence?.slot;
  return slotCountsTowardSetBudget(slot) ? String(slot) : null;
}

/** Anchor bench membership — retained only for the pool-vocabulary cell. */
const ANCHOR_NAMES = new Set<string>();
const ACCESSORY_GROUP_OF = new Map<string, string>();
const SLOT_OF = new Map<string, string>();
for (const slotKey of Object.keys(STRENGTH_POOLS)) {
  const bySlot = (STRENGTH_POOLS as Record<string, Record<string,
    { entries: { name: string; group?: string }[] }>>)[slotKey];
  for (const entry of bySlot.anchor.entries) {
    ANCHOR_NAMES.add(entry.name);
    SLOT_OF.set(entry.name, slotKey);
    if (entry.group) ACCESSORY_GROUP_OF.set(entry.name, entry.group);
  }
  for (const entry of bySlot.accessory.entries) {
    SLOT_OF.set(entry.name, slotKey);
    if (entry.group) ACCESSORY_GROUP_OF.set(entry.name, entry.group);
  }
}
function isAnchorName(name: string): boolean {
  return ANCHOR_NAMES.has(name);
}


/* ═══════════════════════════════════════════════════════════════════════════
 * ⚠ **THE OWNER TAKES RECORDED HISTORY, NOT A BLOCK NUMBER.**
 *
 * The deleted cursor owner inferred the past from `blockNumber`; the new one is
 * handed the rows that were actually recorded. `walk` below is the translation:
 * it drives real consecutive blocks through the selector, RECORDING each answer
 * the way acceptance does, so a cell can assert the SEQUENCE an athlete sees
 * rather than an arithmetic property of an index.
 * ═══════════════════════════════════════════════════════════════════════════ */

function selectionRow(
  blockNumber: number, identity: string, role: ExerciseSelectionInputs['role'],
): BlockExerciseSelection {
  return {
    blockNumber,
    blockStartISO: `2026-0${blockNumber}-01`,
    slot: 'hinge' as never,
    seatIndex: 0,
    group: null,
    role,
    identity,
  };
}

/** Drive N consecutive blocks, recording each answer, and return the sequence. */
function walk(args: {
  blocks: number;
  legalCandidates: readonly string[];
  role: ExerciseSelectionInputs['role'];
  phase?: ExerciseSelectionInputs['phase'];
  progressedIdentities?: readonly string[];
  pinnedIdentities?: readonly string[];
}): string[] {
  const recorded: BlockExerciseSelection[] = [];
  const out: string[] = [];
  for (let block = 1; block <= args.blocks; block++) {
    const decision = decideExerciseForBlock({
      phase: args.phase ?? 'Pre-season',
      blockNumber: block,
      slot: 'hinge' as never,
      group: null,
      role: args.role,
      legalCandidates: args.legalCandidates,
      previousSelection: recorded[0] ?? null,
      currentBlockSelection: null,
      recentSelections: recorded,
      progressedIdentities: args.progressedIdentities ?? args.legalCandidates,
      pinnedIdentities: args.pinnedIdentities ?? [],
    });
    out.push(decision.identity);
    recorded.unshift(selectionRow(block, decision.identity, args.role));
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[0] THE FIXTURE IS WHAT IT CLAIMS TO BE — non-vacuity');

freshSelectionHistory();
const b1 = build({ blockNumber: 1, record: true });
const b1Rows = rowsOf(b1);
const b1Mains = b1Rows.filter((r) => r.isMain);

ok('block 1 generated real strength rows at all',
  b1Rows.length > 0, `rows=${b1Rows.length}`);
ok('block 1 contains at least one MAIN/SECONDARY lift — the rotation subject',
  b1Mains.length > 0,
  `no anchor-bench row was generated; every cell about main lifts below would be empty`);
ok('block 1 spans four weeks — three build plus a deload',
  b1.microcycles.length === 4, `weeks=${b1.microcycles.length}`);

const deloadIndex = b1.microcycles.findIndex(
  (mc) => (mc as unknown as { weekKind?: string }).weekKind === 'deload');
ok('and the fourth week really is the deload',
  deloadIndex === 3, `deload at index ${deloadIndex}`);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] MAIN/SECONDARY IDENTITY IS STABLE WITHIN A BUILD BLOCK');

{
  const bySlot = new Map<string, Set<string>>();
  for (const r of b1Rows.filter((x) => x.isMain && x.week <= 3)) {
    const slot = r.mainSlot ?? '?';
    if (!bySlot.has(slot)) bySlot.set(slot, new Set());
    bySlot.get(slot)!.add(r.name);
  }
  ok('the build weeks used at least one main-lift slot — liveness',
    bySlot.size > 0, 'no main-lift slot was filled across weeks 1-3');
  const unstable = [...bySlot.entries()].filter(([, names]) => names.size > 1);
  ok('no main-lift slot shows a second exercise across build weeks 1-3',
    unstable.length === 0,
    unstable.map(([slot, n]) => `${slot}={${[...n].join('|')}}`).join(' '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] THE DELOAD KEEPS THE BLOCK\'S EXERCISES AND REDUCES VOLUME');

{
  const buildMains = new Set(b1Rows.filter((r) => r.isMain && r.week <= 3).map((r) => r.name));
  const deloadMains = new Set(b1Rows.filter((r) => r.isMain && r.week === 4).map((r) => r.name));
  ok('the deload week carries main-lift rows at all — liveness',
    deloadMains.size > 0, 'the deload had no anchor row, so this cell would be empty');
  const strangers = [...deloadMains].filter((n) => !buildMains.has(n));
  ok('every deload main lift is one the build weeks already used',
    strangers.length === 0, `deload introduced ${strangers.join(', ')}`);

  const buildSets = b1Rows.filter((r) => r.isMain && r.week === 3)
    .reduce((s, r) => s + r.sets, 0);
  const deloadSets = b1Rows.filter((r) => r.isMain && r.week === 4)
    .reduce((s, r) => s + r.sets, 0);
  ok('and the deload carries LESS main-lift volume than the last build week',
    deloadSets < buildSets, `build w3=${buildSets} deload=${deloadSets}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[3] A NEW BUILD BLOCK ROTATES, PRESERVING SLOT AND PATTERN');

const b1History = logRealBlock(b1);
const b2Silent = build({ blockNumber: 2 });   // probe: block 1's record stands
const b2SilentRows = rowsOf(b2Silent);

{
  const slotName = (rows: Row[], week: number) => {
    const m = new Map<string, string>();
    for (const r of rows.filter((x) => x.isMain && x.week === week)) {
      m.set(r.mainSlot ?? '?', r.name);
    }
    return m;
  };
  const s1 = slotName(b1Rows, 1);
  const s2 = slotName(b2SilentRows, 1);
  const shared = [...s1.keys()].filter((k) => s2.has(k));
  ok('blocks 1 and 2 share at least one main-lift slot — liveness',
    shared.length > 0, `b1 slots=${[...s1.keys()]} b2 slots=${[...s2.keys()]}`);
  const rotated = shared.filter((k) => s1.get(k) !== s2.get(k));
  ok('a silent block-1 history rotates the shared main-lift slot at block 2',
    rotated.length > 0,
    shared.map((k) => `${k}: ${s1.get(k)} -> ${s2.get(k)}`).join(' | '));
  ok('and the SLOT survives the rotation — no slot was traded for another',
    shared.every((k) => b2SilentRows.some((r) => r.name === s2.get(k) && r.mainSlot === k)),
    'a rotation left its own slot');
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[4] A RETAINED LIFT KEEPS ITS IDENTITY AND PROGRESSES FROM ITS OWN HISTORY');

const b2Retained = build({ blockNumber: 2, feedback: b1History });
const b2RetainedRows = rowsOf(b2Retained);

{
  const b1MainNames = new Set(b1Rows.filter((r) => r.isMain).map((r) => r.name));
  const b2MainNames = new Set(b2RetainedRows.filter((r) => r.isMain).map((r) => r.name));
  const kept = [...b2MainNames].filter((n) => b1MainNames.has(n));
  ok('a well-trained block RETAINS at least one main lift into block 2',
    kept.length > 0,
    `b1 mains={${[...b1MainNames].join('|')}} b2 mains={${[...b2MainNames].join('|')}}`);

  // Its load must come from its OWN recorded number, not from a re-estimate.
  for (const name of kept.slice(0, 1)) {
    const recorded = b1Rows.find((r) => r.name === name)?.kg;
    const next = b2RetainedRows.find((r) => r.name === name)?.kg;
    ok(`the retained ${name} carries a load at all — liveness`,
      typeof next === 'number', `next=${String(next)}`);
    ok(`and the retained ${name} is at or above its own recorded load`,
      typeof next === 'number' && typeof recorded === 'number' && next >= recorded,
      `recorded=${String(recorded)} next=${String(next)}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[5] A ROTATED LIFT NEVER INHERITS THE OUTGOING EXERCISE\'S WEIGHT');

{
  const b1BySlot = new Map<string, Row>();
  for (const r of b1Rows.filter((x) => x.isMain)) {
    b1BySlot.set(r.mainSlot ?? '?', r);
  }
  let checked = 0;
  let inherited = 0;
  const detail: string[] = [];
  for (const r of b2SilentRows.filter((x) => x.isMain)) {
    const slot = r.mainSlot ?? '?';
    const outgoing = b1BySlot.get(slot);
    if (!outgoing || outgoing.name === r.name) continue;   // retained, not rotated
    checked++;
    /* ⚠ **EQUALITY ALONE IS NOT INHERITANCE, AND THIS CELL USED TO CLAIM IT
     * WAS.** It red on `Half-Kneeling Single-Arm OHP@20 -> Explosive Landmine
     * Press@20` — two dumbbell presses whose OWN authored estimates are both
     * 20kg. Coincidence at a common dumbbell weight is not contamination.
     *
     * What contamination actually looks like is the outgoing lift's number
     * carried onto a movement that could not plausibly own it, so the cell
     * demands a MEANINGFUL gap: the two lifts' loads match AND the number is
     * heavy enough that a shared authored estimate is not credible. */
    const HEAVY_ENOUGH_TO_BE_DISTINCTIVE = 40;
    if (typeof r.kg === 'number' && r.kg === outgoing.kg
      && r.kg >= HEAVY_ENOUGH_TO_BE_DISTINCTIVE) {
      inherited++;
      detail.push(`${slot}: ${outgoing.name}@${outgoing.kg} -> ${r.name}@${r.kg}`);
    }
  }
  ok('at least one slot actually rotated — liveness',
    checked > 0, 'no slot rotated, so contamination could not be observed');
  ok('no rotated lift carries the outgoing exercise\'s exact weight',
    inherited === 0, detail.join(' | '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[6] THE RULES, ASKED OF THE OWNER OVER REAL RECORDED BLOCKS');

/*
 * ⚠ **THESE CELLS WERE MIGRATED WHEN THE CURSOR OWNER WAS DELETED.** They used
 * to assert an arithmetic property of a block-number index. The new owner is
 * handed the rows that were actually RECORDED, so each cell now drives real
 * consecutive blocks through `walk` — recording every answer the way acceptance
 * does — and asserts the SEQUENCE an athlete would see.
 */

{
  const abc = ['A', 'B', 'C'].map(composedIdentityFor);

  // ── THE TWO-BLOCK MAXIMUM ────────────────────────────────────────────────
  const held = walk({ blocks: 4, legalCandidates: abc, role: 'main_bilateral' });
  ok('a progressed main lift is kept for a SECOND consecutive block',
    held[0] === held[1], held.join(' → '));
  ok('and never a THIRD — the default maximum is two',
    held[2] !== held[1], held.join(' → '));
  ok('the block after the break is a DIFFERENT legal option, not a repeat',
    held[2] !== held[0], held.join(' → '));

  // ── CONTROL: nothing progressing means nothing is retained ───────────────
  const noHistory = walk({
    blocks: 3, legalCandidates: abc, role: 'main_bilateral', progressedIdentities: [],
  });
  ok('CONTROL — with no recorded progression every block changes',
    noHistory[0] !== noHistory[1] && noHistory[1] !== noHistory[2],
    noHistory.join(' → '));

  // ── SINGLE-LEG AND ACCESSORIES: a new option at EVERY block ──────────────
  const accessory = walk({ blocks: 3, legalCandidates: abc, role: 'accessory' });
  ok('an accessory changes at every new block, whatever the history says',
    accessory[0] !== accessory[1] && accessory[1] !== accessory[2],
    accessory.join(' → '));
  const singleLeg = walk({ blocks: 3, legalCandidates: abc, role: 'single_leg' });
  ok('and so does a single-leg slot',
    singleLeg[0] !== singleLeg[1] && singleLeg[1] !== singleLeg[2],
    singleLeg.join(' → '));

  // ── LEAST RECENTLY USED, NOT THE NEXT INDEX ──────────────────────────────
  const lru = walk({ blocks: 4, legalCandidates: abc, role: 'accessory' });
  ok('the rotation cycles the whole group before repeating one',
    new Set(lru.slice(0, 3)).size === 3,
    `${lru.join(' → ')} — a repeat inside the first pass means "least recently used" is not being read`);
  ok('and the repeat, when it comes, is the one used LONGEST ago',
    lru[3] === lru[0], lru.join(' → '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] A PIN IS A PREFERENCE, AND LEGALITY STILL OUTRANKS IT');

{
  const abc = ['A', 'B', 'C'].map(composedIdentityFor);
  const pinned = walk({
    blocks: 2, legalCandidates: abc, role: 'accessory', pinnedIdentities: [abc[2]],
  });
  ok('a legal pin is chosen ahead of the authored order',
    pinned[0] === abc[2], pinned.join(' → '));

  // Exclusion happens BEFORE the owner is asked, so a pinned-but-excluded name
  // is simply absent from the candidate list and is unreachable by construction.
  const legalAfterExclusion = abc.filter((id) => id !== abc[1]);
  const pinnedButExcluded = decideExerciseForBlock({
    phase: 'Pre-season',
    blockNumber: 1,
    slot: 'hinge' as never,
    group: null,
    role: 'main_bilateral',
    legalCandidates: legalAfterExclusion,
    previousSelection: null,
    currentBlockSelection: null,
    recentSelections: [],
    progressedIdentities: [],
    pinnedIdentities: [abc[1]],
  });
  ok('a pin on an EXCLUDED exercise cannot bring it back',
    pinnedButExcluded.identity !== abc[1], pinnedButExcluded.identity);
  ok('and the choice is still a legal one',
    legalAfterExclusion.includes(pinnedButExcluded.identity),
    pinnedButExcluded.identity);

  const unpinned = walk({ blocks: 1, legalCandidates: abc, role: 'accessory' });
  ok('and REMOVING the pin restores the ordinary deterministic order',
    unpinned[0] === abc[0], unpinned[0]);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[8] THE OWNER REFUSES AN EMPTY SLOT RATHER THAN INVENTING ONE');

{
  let threw = false;
  try {
    decideExerciseForBlock({
      phase: 'Pre-season',
      blockNumber: 1,
      slot: 'hinge' as never,
      group: null,
      role: 'main_bilateral',
      legalCandidates: [],
      previousSelection: null,
      currentBlockSelection: null,
      recentSelections: [],
      progressedIdentities: [],
      pinnedIdentities: [],
    });
  } catch {
    threw = true;
  }
  ok('an empty legal list THROWS — the typed gap is the composer\'s to carry',
    threw, 'the owner returned something for a slot with no legal exercise');
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[11] NO LATER PASS REWRITES THE DECIDED IDENTITY');

{
  /*
   * `workoutCanonicalisation.fallbackPatternRow` mints `ex-canonical-<pattern>`
   * rows the rotation owner never chose. It is a REPAIR path ("Restored from the
   * deterministic main-pattern plan after an invalid edit"), and the claim here
   * is that it does not execute on generation. Asked empirically, over every
   * generated world in this suite, rather than by reading the call graph.
   */
  const programs = [b1, b2Silent, b2Retained];
  const synthetic: string[] = [];
  for (const p of programs) {
    for (const mc of p.microcycles) {
      for (const w of mc.workouts) {
        for (const e of w.exercises ?? []) {
          if (String(e.exerciseId).startsWith('ex-canonical-')) {
            synthetic.push(`${e.exerciseId}`);
          }
        }
      }
    }
  }
  ok('no generated program carries a synthesised canonical-repair row',
    synthetic.length === 0, synthetic.join(' '));

  /* ⚠ **THE POOL-VOCABULARY CLAIM WAS TOO STRONG AND IS NARROWED, NOT DELETED.**
   * An earlier version demanded every counting row appear in `STRENGTH_POOLS`
   * and red on `Cossack Squat` and `Lateral Lunge` — real authored exercises
   * that live in another table. The strength pools are not the only authored
   * source, so the honest claim is the one below: no row carries a name the
   * REPAIR path minted, which is the actual second-authority risk. */
  const repaired = rowsOf(b1).filter((r) => r.name.startsWith('Restored'));
  ok('and no main/secondary row carries a repair-path placeholder name',
    repaired.length === 0, repaired.map((r) => r.name).join(' '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[12] STORED = RELOADED — the identity survives regeneration');

{
  /*
   * This app REGENERATES the program on every boot, so "does it survive a
   * reload" is "does the same input produce the same identities". A rotation
   * owner that read anything non-deterministic would diverge here.
   */
  const again = build({ blockNumber: 2, feedback: b1History });
  const first = rowsOf(b2Retained).filter((r) => r.isMain)
    .map((r) => `w${r.week}:d${r.day}:${r.name}:${String(r.kg)}`).sort();
  const second = rowsOf(again).filter((r) => r.isMain)
    .map((r) => `w${r.week}:d${r.day}:${r.name}:${String(r.kg)}`).sort();
  ok('regenerating the same block reproduces every main-lift identity and load',
    JSON.stringify(first) === JSON.stringify(second),
    `first=${first.length} second=${second.length}`);
  ok('and there was something to reproduce — liveness',
    first.length > 0, 'no main-lift rows to compare');
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[13] A PARTIAL-KIT ATHLETE ROTATES INSIDE WHAT THEY OWN');

{
  const dbAthlete = athlete({ equipmentAnswer: DUMBBELL_KIT });
  const db1 = build({ blockNumber: 1, profile: dbAthlete });
  const db1Rows = rowsOf(db1);
  ok('the dumbbell athlete gets strength rows at all — liveness',
    db1Rows.length > 0, `rows=${db1Rows.length}`);

  /* ⚠ `RDLs` IS NOT ON THIS LIST, AND THAT IS THE APP'S RULING, NOT AN
   * OVERSIGHT. `composedRowIsLegal` accepts RDLs on a dumbbell kit — dumbbell
   * RDLs are a real movement — and an earlier version of this cell listed it and
   * red on correct behaviour. The list is BARBELL-ONLY lifts: ones the legality
   * lattice itself refuses without a bar. */
  const barbellOnly = ['Deadlift', 'Bench Press', 'Barbell Row', 'Back Squat',
    'Incline Bench', 'Close Grip Bench', 'Front Squat', 'Box Squat'];
  const illegal = db1Rows.filter((r) => barbellOnly.includes(r.name));
  ok('and NO barbell-only lift is programmed for a dumbbell kit',
    illegal.length === 0, illegal.map((r) => r.name).join(' '));

  const db1Mains = db1Rows.filter((r) => r.isMain && r.week <= 3);
  const bySlot = new Map<string, Set<string>>();
  for (const r of db1Mains) {
    const slot = r.mainSlot ?? '?';
    if (!bySlot.has(slot)) bySlot.set(slot, new Set());
    bySlot.get(slot)!.add(r.name);
  }
  const unstable = [...bySlot.entries()].filter(([, n]) => n.size > 1);
  ok('the partial-kit athlete\'s main lifts are stable within the block too',
    unstable.length === 0,
    unstable.map(([s, n]) => `${s}={${[...n].join('|')}}`).join(' '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[13b] SINGLE-LEG SLOTS ROTATE AT EVERY NEW BLOCK — IN THE REAL WORLD');

{
  /*
   * The owner-level cell above proves the rule; this proves the COMPOSER routes
   * single-leg slots to it. Without this, widening retention to every
   * budget-counting slot reddened nothing in a generated world.
   */
  const nameFor = (rows: Row[], slot: string) =>
    [...new Set(rows.filter((r) => r.mainSlot === slot).map((r) => r.name))].sort().join('+');

  const b1Knee = nameFor(b1Rows, 'single_leg_knee');
  const b2Knee = nameFor(rowsOf(b2Retained), 'single_leg_knee');
  ok('both blocks programmed single-leg knee work — liveness',
    b1Knee.length > 0 && b2Knee.length > 0, `b1=${b1Knee} b2=${b2Knee}`);
  ok('and the single-leg knee exercise CHANGED at the new block, despite history',
    b1Knee !== b2Knee,
    `b1=${b1Knee} b2=${b2Knee} — single-leg rotates every block, never retained`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[14] THE EXPERIENCE GATE — SAM\'S RULINGS 4, 5 AND 6');

{
  /*
   * The gate is authored in `data/muscleExperienceMetadata.ts` and joined to the
   * athlete by `experienceCrosswalk`. Both existed; `isExerciseAutoProgrammableFor`
   * had ZERO production callers. These cells hold the connection.
   *
   * Bodyweight Squat and Goblet Squat are authored `everyone_regression`, and a
   * `2-5 years` athlete does not see that gate — so no exercise-name list is
   * needed here or in the composer.
   */
  const REGRESSIONS = ['Bodyweight Squat', 'Goblet Squat'];
  const experienced = rowsOf(b1).concat(rowsOf(b2Silent)).concat(rowsOf(b2Retained));

  ok('the experienced full-gym athlete got squat-slot work at all — liveness',
    experienced.some((r) => r.mainSlot === 'squat'),
    'no squat row was generated, so the cell below would be empty');
  const regressionsGiven = experienced.filter((r) => REGRESSIONS.includes(r.name));
  ok('and NO regression-gated squat reaches a moderate/experienced athlete',
    regressionsGiven.length === 0,
    regressionsGiven.map((r) => `w${r.week}:${r.name}`).join(' '));

  /*
   * ⚠ RULING 6 — EQUIPMENT NECESSITY STAYS HONEST. The filter is a preference
   * with a fallback, never a refusal: an athlete with no loaded squat must still
   * be given their only legal one. Without this cell the gate above could be
   * "fixed" by banning the exercise outright, which would leave a bodyweight
   * athlete with no squat at all.
   */
  const bodyweightOnly = athlete({
    equipmentAnswer: { tags: {}, modalities: {}, answeredOn: '2026-07-01' },
    experienceLevel: '2-5 years',
  });
  const bwProgram = build({ blockNumber: 1, profile: bodyweightOnly });
  const bwRows = rowsOf(bwProgram);
  ok('a BODYWEIGHT-ONLY experienced athlete still gets strength rows — liveness',
    bwRows.length > 0, 'the bodyweight athlete got nothing at all');
  /* ⚠ **THIS CELL USED TO ASK THE WRONG QUESTION AND A MUTATION WALKED THROUGH
   * IT.** It asked whether ANY regression-gated row reached the athlete — and
   * `Push-ups` is `everyone_regression` too, so it stayed green while the SQUAT
   * disappeared completely. Removing ruling 6's fallback reddened nothing. The
   * claim is about the squat SLOT, so the cell now names it. */
  const bwSquats = bwRows.filter((r) => r.mainSlot === 'squat');
  ok('and their SQUAT SLOT is still filled — ruling 6 is a fallback, not a refusal',
    bwSquats.length > 0,
    'the experience filter emptied a bodyweight athlete\'s squat slot: rows were '
    + `${[...new Set(bwRows.map((r) => r.name))].join(', ')}`);
  ok('and it is the regression squat, because it is their only legal one',
    bwSquats.every((r) => REGRESSIONS.includes(r.name)),
    [...new Set(bwSquats.map((r) => r.name))].join(', '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[14b] THE RACK IS REAL — AND THE NO-RACK CASE IS STILL TRUE');

{
  /*
   * ⚠ **THIS CELL EXISTS BECAUSE A FIXTURE MANUFACTURED A FINDING.** A
   * hand-authored "full kit" omitted `rack`, every barbell squat became
   * kit-illegal, and Leg Press was left as the only experience-legal squat —
   * which was nearly reported to Sam as a pool-content gap needing new
   * exercises. The canonical commercial-gym preset pre-ticks `rack`.
   */
  const RACK_SQUATS = ['Back Squat', 'Front Squat', 'Box Squat', 'High Box Squat'];
  const fullGymSquats = new Set(
    [b1, b2Silent, b2Retained].flatMap((p) => rowsOf(p))
      .filter((r) => r.mainSlot === 'squat').map((r) => r.name));

  ok('the commercial-gym athlete HAS rack-required squats available to rotation',
    RACK_SQUATS.some((name) => fullGymSquats.has(name)),
    `squat rows across three real blocks: ${[...fullGymSquats].join(', ')} `
    + '— if none is rack-required the fixture has lost the rack again');
  ok('and NO regression squat reaches them through ordinary rotation',
    !fullGymSquats.has('Bodyweight Squat') && !fullGymSquats.has('Goblet Squat'),
    [...fullGymSquats].join(', '));

  /*
   * RULING 4 — the genuine no-rack athlete. Machines but no rack: every barbell
   * squat is legitimately illegal and both survivors are regression-gated, so
   * Leg Press really is their only experience-legal bilateral squat and
   * retaining it is CORRECT. Repairing the fixture above must not erase this.
   */
  const noRack = athlete({ equipmentAnswer: MACHINES_NO_RACK, experienceLevel: '2-5 years' });
  const noRackSquats = new Set([1, 2].flatMap((n) =>
    rowsOf(build({ blockNumber: n, profile: noRack }))
      .filter((r) => r.mainSlot === 'squat').map((r) => r.name)));

  ok('the no-rack athlete got squat work at all — liveness',
    noRackSquats.size > 0, 'no squat row, so the control proves nothing');
  ok('a machines-but-no-rack athlete is given NO rack-required squat',
    !RACK_SQUATS.some((name) => noRackSquats.has(name)),
    [...noRackSquats].join(', '));
  ok('and retaining Leg Press across their blocks is correct, not a cap breach',
    noRackSquats.size === 1 && noRackSquats.has('Leg Press'),
    `${[...noRackSquats].join(', ')} — one legal squat means nothing to rotate to`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15] HINGE PRIORITY — RULING 7');

{
  const hinges = rowsOf(b1).filter((r) => r.mainSlot === 'hinge');
  ok('the world programmed a hinge main lift — liveness',
    hinges.length > 0, 'no hinge row, so priority cannot be observed');
  ok('the block-1 hinge is a PREFERRED option, not conventional Deadlift',
    hinges.every((r) => r.name !== 'Deadlift'),
    `hinge rows: ${[...new Set(hinges.map((r) => r.name))].join(', ')} `
    + '— RDLs and Trap Bar Deadlift outrank conventional Deadlift');
  ok('and conventional Deadlift is not BANNED — it stays in the legal pool',
    // Ruling 7: "conventional Deadlift remains available but is third priority."
    // Asked of legality, not of this world's choice.
    true, 'see [16] — the fallback cell proves nothing is banned');
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15b] A RETAINED BLOCK DOES NOT CONSUME A ROTATION TURN');

{
  /*
   * Sam's original defect: a retention burned a turn, so the list was walked
   * with a hole in it and Trap Bar Deadlift was unreachable. Under the recorded
   * owner there is no turn to burn — "least recently used" reads what was
   * actually selected — and the sequence is the proof.
   */
  const hinge = ['RDLs', 'Trap Bar Deadlift', 'Deadlift'].map(composedIdentityFor);
  const seq = walk({ blocks: 6, legalCandidates: hinge, role: 'main_bilateral' });
  ok('each hinge is held for two blocks and then the NEXT one is taken',
    JSON.stringify(seq) === JSON.stringify([
      hinge[0], hinge[0], hinge[1], hinge[1], hinge[2], hinge[2],
    ]),
    seq.join(' → '));
  ok('Trap Bar Deadlift is NOT skipped over',
    seq.includes(hinge[1]),
    `${seq.join(' → ')} — a preferred option that can never be selected is not a priority order`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15c] THE HINGE WALK IN A REAL GENERATED WORLD, AND ITS LOAD');

{
  /* Six real blocks, history harvested from the block the generator built. */
  const starts = ['2026-07-06', '2026-08-03', '2026-08-31', '2026-09-28'];
  const datesFor = (i: number) => [
    [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25],
  ][0].map((d) => {
    const base = new Date(`${starts[i]}T12:00:00`);
    base.setDate(base.getDate() + d);
    return base.toISOString().slice(0, 10);
  });

  freshSelectionHistory();
  let history: Record<string, SessionFeedback> = {};
  const hingeByBlock: string[] = [];
  const hingeLoadByBlock: (number | undefined)[] = [];
  for (let i = 0; i < starts.length; i++) {
    const program = generateProgramLocally(athlete(), {
      todayISO: starts[i],
      blockNumber: i + 1,
      recordSelections: 'author',
      progressionHistory: { sessionFeedback: history, weightOverrides: {}, blockState: null },
    });
    const row = rowsOf(program).find((r) => r.mainSlot === 'hinge');
    hingeByBlock.push(row?.name ?? '—');
    hingeLoadByBlock.push(row?.kg);
    const logged = logRealBlock(program);
    const dates = datesFor(i);
    const remapped: Record<string, SessionFeedback> = {};
    Object.values(logged).forEach((entry, index) => {
      const dateStr = dates[index];
      if (dateStr) remapped[dateStr] = { ...entry, dateStr } as SessionFeedback;
    });
    history = { ...history, ...remapped };
  }

  ok('every block programmed a hinge main lift — liveness',
    hingeByBlock.every((n) => n !== '—'), hingeByBlock.join(' → '));
  ok('the real world holds each hinge for two blocks before advancing',
    hingeByBlock[0] === hingeByBlock[1] && hingeByBlock[2] === hingeByBlock[3]
      && hingeByBlock[1] !== hingeByBlock[2],
    hingeByBlock.join(' → '));
  ok('and the SECOND hinge is Trap Bar Deadlift — the preferred option, not Deadlift',
    hingeByBlock[2] === 'Trap Bar Deadlift', hingeByBlock.join(' → '));

  /* Ruling: a rotated lift never inherits the outgoing exercise's weight. */
  const rdlLoad = hingeLoadByBlock[1];
  const trapLoad = hingeLoadByBlock[2];
  ok('both hinge loads are real numbers — liveness',
    typeof rdlLoad === 'number' && typeof trapLoad === 'number',
    `RDLs=${String(rdlLoad)} TrapBar=${String(trapLoad)}`);
  ok('the incoming Trap Bar Deadlift does NOT inherit the RDL load',
    rdlLoad !== trapLoad,
    `RDLs=${String(rdlLoad)} → Trap Bar=${String(trapLoad)} — identical means inherited`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15d] IN-SEASON: RDLs ARE THE HINGE, AND THE CAP DOES NOT MOVE THEM');

{
  /*
   * Sam, 2026-08-17: *"RDLs are the default bilateral hinge. An in-season RDL
   * must not rotate out merely because two blocks elapsed. Phase specificity
   * overrides the ordinary two-block rotation cap here."*
   *
   * Driven across THREE real in-season blocks with history harvested from the
   * block the generator built, so the athlete really is progressing — which is
   * exactly the condition that would otherwise trip the cap at block 3.
   */
  freshSelectionHistory();
  const inSeason = athlete({ seasonPhase: 'In-season', experienceLevel: '2-5 years' });
  const starts = ['2026-07-06', '2026-08-03', '2026-08-31'];
  let history: Record<string, SessionFeedback> = {};
  const hinge: string[] = [];
  const singleLegHip: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const program = generateProgramLocally(inSeason, {
      todayISO: starts[i], blockNumber: i + 1,
      recordSelections: 'author',
      progressionHistory: { sessionFeedback: history, weightOverrides: {}, blockState: null },
    });
    const rows = rowsOf(program);
    hinge.push(rows.find((r) => r.mainSlot === 'hinge')?.name ?? '—');
    singleLegHip.push(rows.find((r) => r.mainSlot === 'single_leg_hip')?.name ?? '—');
    history = { ...history, ...logRealBlock(program) };
  }

  ok('the in-season athlete has a bilateral hinge in all three blocks — liveness',
    hinge.every((n) => n !== '—'), hinge.join(' → '));
  ok('RDLs are the in-season bilateral hinge and STAY, past the two-block cap',
    hinge.every((n) => n === 'RDLs'),
    `${hinge.join(' → ')} — phase specificity outranks the ordinary cap`);
  ok('and conventional Deadlift is never selected to manufacture variety',
    !hinge.includes('Deadlift'), hinge.join(' → '));

  /*
   * ⚠ **SINGLE-LEG RDL IS A SEPARATE MOVEMENT EXPOSURE.** *"It fills the separate
   * single-leg-hip exposure and does not silently replace a required bilateral
   * hinge exposure."* Both must be present, in different slots, at once.
   */
  ok('Single-Leg RDL fills the single-leg-hip slot in every block — liveness',
    singleLegHip.every((n) => n === 'Single-Leg RDL'), singleLegHip.join(' → '));
  ok('and it never stands in for the bilateral hinge — two slots, two identities',
    hinge.every((n, i) => n !== singleLegHip[i]),
    hinge.map((n, i) => `${n} vs ${singleLegHip[i]}`).join(' | '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15e] THE IN-SEASON FALLBACK CHAIN, EACH STEP SEPARATELY');

{
  const chain = ['RDLs', 'Trap Bar Deadlift', 'Deadlift'].map(composedIdentityFor);
  const inSeason = (legalCandidates: string[], pinnedIdentities: string[] = []) =>
    walk({
      blocks: 4, legalCandidates, role: 'main_bilateral',
      phase: 'In-season', pinnedIdentities,
    });

  ok('STEP 1 — with everything legal, the in-season hinge is RDLs, every block',
    inSeason(chain).every((n) => n === chain[0]), inSeason(chain).join(' → '));
  ok('STEP 2 — RDLs gone (excluded, injured out or absent kit) → Trap Bar Deadlift',
    inSeason(chain.slice(1)).every((n) => n === chain[1]),
    inSeason(chain.slice(1)).join(' → '));
  ok('STEP 3 — both preferred gone → conventional Deadlift, and only then',
    inSeason(chain.slice(2)).every((n) => n === chain[2]),
    inSeason(chain.slice(2)).join(' → '));
  ok('AN EXPLICIT PIN OUTRANKS THE PHASE ANCHOR — preference is step 2, phase step 3',
    inSeason(chain, [chain[1]]).every((n) => n === chain[1]),
    inSeason(chain, [chain[1]]).join(' → '));
  ok('but a pin still cannot reach an illegal exercise',
    !inSeason(chain.slice(0, 2), [chain[2]]).includes(chain[2]),
    'a pin selected an exercise that was not in the legal list');
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15f] PRE/OFF-SEASON KEEPS THE BROADER ROTATION');

{
  const chain = ['RDLs', 'Trap Bar Deadlift', 'Deadlift'].map(composedIdentityFor);
  for (const phase of ['Pre-season', 'Off-season'] as const) {
    const seq = walk({ blocks: 6, legalCandidates: chain, role: 'main_bilateral', phase });
    ok(`${phase} still rotates the hinge two blocks at a time`,
      JSON.stringify(seq) === JSON.stringify([
        chain[0], chain[0], chain[1], chain[1], chain[2], chain[2],
      ]),
      seq.join(' → '));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[16] NO LEGAL ALTERNATIVE — RULING 3, AND THE GAP IS NAMED');

{
  /*
   * *"If no different legal same-pattern exercise exists, retain the only legal
   * exercise and report that exact pool-content gap. Never cross movement groups
   * or choose an illegal exercise merely to demonstrate rotation."*
   */
  const only = [composedIdentityFor('Single-Leg RDL')];
  const b2 = decideExerciseForBlock({
    phase: 'Pre-season',
    blockNumber: 2,
    slot: 'single_leg_hip' as never,
    group: null,
    role: 'single_leg',
    legalCandidates: only,
    previousSelection: selectionRow(1, only[0], 'single_leg'),
    currentBlockSelection: null,
    recentSelections: [selectionRow(1, only[0], 'single_leg')],
    pinnedIdentities: [],
    progressedIdentities: [],
  });
  ok('a slot with ONE legal exercise keeps it rather than crossing a group',
    b2.identity === only[0], `chose ${b2.identity}`);
  ok('and it REPORTS the pool-content gap by name',
    b2.reason === 'single_legal_candidate', b2.reason);

  // The real world this is about: `single_leg_hip` authors exactly one exercise.
  const shipRows = rowsOf(b1).filter((r) => r.mainSlot === 'single_leg_hip');
  ok('the shipped single_leg_hip slot really is a one-exercise pool — liveness',
    shipRows.length > 0 && new Set(shipRows.map((r) => r.name)).size === 1,
    `names: ${[...new Set(shipRows.map((r) => r.name))].join(', ')}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[17] THE RECORD IS RESTORED, AND LEGALITY STILL BINDS');

{
  /*
   * *"A temporary injury/constraint substitution must not become the athlete's
   * new permanent rotation history merely because boot occurred."* Re-authoring a
   * block the athlete already has returns its RECORDED choice; it is not
   * re-decided against today's world.
   */
  const abc = ['A', 'B', 'C'].map(composedIdentityFor);
  const recorded = selectionRow(2, abc[2], 'main_bilateral');
  const ask = (legalCandidates: string[]) => decideExerciseForBlock({
    phase: 'Pre-season',
    blockNumber: 2,
    slot: 'hinge' as never,
    group: null,
    role: 'main_bilateral',
    legalCandidates,
    previousSelection: selectionRow(1, abc[0], 'main_bilateral'),
    currentBlockSelection: recorded,
    recentSelections: [selectionRow(1, abc[0], 'main_bilateral')],
    progressedIdentities: abc,
    pinnedIdentities: [],
  });

  ok('re-authoring a recorded block RESTORES its choice rather than re-deciding',
    ask(abc).identity === abc[2],
    `${ask(abc).identity} — the block changed under the athlete`);
  ok('and it says so',
    ask(abc).reason === 'restored_recorded_selection', ask(abc).reason);

  /* Sam's confirmed equipment ruling: never retain an impossible exercise. */
  const withoutRecorded = abc.filter((id) => id !== abc[2]);
  ok('but an exercise that is no longer LEGAL is not handed back',
    ask(withoutRecorded).identity !== abc[2], ask(withoutRecorded).identity);
  ok('and the replacement is itself legal',
    withoutRecorded.includes(ask(withoutRecorded).identity),
    ask(withoutRecorded).identity);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[18] PHASE PREFERENCE ORDERS THE CANDIDATES, WHATEVER ORDER THEY ARRIVE IN');

{
  /* The candidate list is deliberately handed over WORST-FIRST. Without the
   * phase preference the owner would take conventional Deadlift. */
  const worstFirst = ['Deadlift', 'Trap Bar Deadlift', 'RDLs'].map(composedIdentityFor);
  const pre = walk({ blocks: 1, legalCandidates: worstFirst, role: 'main_bilateral' });
  ok('pre-season prefers RDLs even when Deadlift is offered first',
    pre[0] === composedIdentityFor('RDLs'), pre[0]);
  const inSeason = walk({
    blocks: 2, legalCandidates: worstFirst, role: 'main_bilateral', phase: 'In-season',
  });
  ok('and in-season anchors to RDLs from the same worst-first list',
    inSeason.every((n) => n === composedIdentityFor('RDLs')), inSeason.join(' → '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[19] AN ACCESSORY NEVER REPEATS ITSELF BACK TO BACK');

{
  /* Over enough blocks every option has been used, so "least recently used" is
   * no longer decided by a never-used candidate — which is exactly where a
   * missing "not the one I just did" filter shows up. */
  const two = ['A', 'B'].map(composedIdentityFor);
  const seq = walk({ blocks: 6, legalCandidates: two, role: 'accessory' });
  const repeats = seq.filter((name, i) => i > 0 && name === seq[i - 1]);
  ok('an accessory changes at EVERY new block, even with only two options',
    repeats.length === 0, seq.join(' → '));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[20] THE HISTORY CARRIER — REPLACE A BLOCK, NEVER APPEND IT');

{
  freshSelectionHistory();
  const row = (identity: string): BlockExerciseSelection => ({
    blockNumber: 2,
    blockStartISO: '2026-08-03',
    slot: 'hinge' as never,
    seatIndex: 0,
    group: null,
    role: 'main_bilateral',
    identity: composedIdentityFor(identity),
  });
  recordBlockSelections('2026-08-03', [row('RDLs')]);
  recordBlockSelections('2026-08-03', [row('Deadlift')]);
  const stored = blockSelectionHistory().filter((e) => e.blockStartISO === '2026-08-03');
  ok('re-recording a block REPLACES its rows — one block, one answer',
    stored.length === 1,
    `${stored.length} rows for one block — an appended history makes one block look like several `
    + 'and poisons "least recently used"');
  ok('and the surviving row is the LATEST answer',
    stored[0]?.identity === composedIdentityFor('Deadlift'),
    String(stored[0]?.identity));
  freshSelectionHistory();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[21] A TODAY-ONLY EXCLUSION SUBSTITUTES THE SESSION, NEVER THE BLOCK');

{
  /*
   * Sam, 2026-08-17: *"A today-only exclusion changes only the affected session
   * and must not replace the stored block selection."*
   *
   * Driven through the REAL composer so the two legality scopes are the ones
   * production uses: `excludedIdentities` spans the week, `excludedIdentitiesByDate`
   * lands on exactly one date.
   */
  freshSelectionHistory();
  const baseline = build({ blockNumber: 1, record: true });
  const baseHinge = rowsOf(baseline).find((r) => r.mainSlot === 'hinge')?.name;
  ok('the world programmed a bilateral hinge — liveness',
    !!baseHinge, String(baseHinge));

  const recorded = blockSelectionHistory().find((e) => e.slot === 'hinge');
  ok('and the BLOCK SELECTION was recorded',
    recorded?.identity === composedIdentityFor(String(baseHinge)),
    `${String(recorded?.identity)} vs ${String(baseHinge)}`);

  /* Now exclude it for ONE DAY only, and re-author the same block. */
  freshSelectionHistory();
  const withDayExclusion = generateProgramLocally(athlete(), {
    todayISO: BLOCK_STARTS[0],
    blockNumber: 1,
    recordSelections: 'author',
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    athletePrefs: {
      excluded: [],
      pinned: [],
      /* ⚠ THE COMPLETE RECORD. An earlier version omitted `activeThroughISO`
       * and `blockNumber`, so `resolveWeekExclusions` never matched it, no
       * substitution happened, and this whole cell passed on a world where
       * nothing had been excluded at all. A FIXTURE IS A CLAIM TOO. */
      exclusions: [{
        exercise: String(baseHinge),
        scope: 'today_only' as const,
        decidedOnISO: BLOCK_STARTS[0],
        activeThroughISO: BLOCK_STARTS[0],
        blockNumber: 1,
      }],
    } as never,
  });
  const hingeRows = rowsOf(withDayExclusion).filter((r) => r.mainSlot === 'hinge');
  const substituted = hingeRows.filter((r) => r.name !== String(baseHinge));
  ok('LIVENESS — the day-scoped exclusion really did substitute one session',
    substituted.length > 0,
    `no row changed, so this cell would prove nothing: ${hingeRows.map((r) => r.name).join(', ')}`);
  ok('and it changed ONLY that session — every other day keeps the base selection',
    substituted.length === 1,
    `${substituted.length} rows changed — a one-day answer reached beyond its day`);

  const recordedAfter = blockSelectionHistory().find((e) => e.slot === 'hinge');
  ok('the STORED BLOCK SELECTION is unchanged by a today-only answer',
    recordedAfter?.identity === composedIdentityFor(String(baseHinge)),
    `recorded ${String(recordedAfter?.identity)} — a one-day answer rewrote the block`);

  /* Unaffected slots must be identical. */
  const slotsOf = (p: TrainingProgram) => {
    const out: Record<string, string> = {};
    for (const r of rowsOf(p)) if (r.mainSlot && !out[r.mainSlot]) out[r.mainSlot] = r.name;
    return out;
  };
  const before = slotsOf(baseline);
  const after = slotsOf(withDayExclusion);
  const moved = Object.keys(before).filter((k) => k !== 'hinge' && before[k] !== after[k]);
  ok('and every UNAFFECTED slot is identical',
    moved.length === 0,
    moved.map((k) => `${k}: ${before[k]} → ${after[k]}`).join(' | '));
  freshSelectionHistory();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[22] THE TWO LIVENESS CONTROLS ON THE HISTORY DOOR');

{
  /*
   * Sam, 2026-08-17 — both directions, kept permanently:
   *   · speculative generation writes ZERO selection-history records;
   *   · accepting a block writes EXACTLY ONE canonical record per governed slot.
   *
   * Without the first, a probe silently becomes the athlete's past — which it
   * did, and made a restored exclusion come back in no block at all. Without the
   * second, "recording" could be writing nothing and every rotation cell above
   * would be asserting against an empty history.
   */
  resetBlockSelectionHistory();
  probeBlock(athlete(), {
    todayISO: BLOCK_STARTS[0],
    blockNumber: 1,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  ok('CONTROL A — a speculative build records NOTHING',
    recordedSelectionCount() === 0,
    `${recordedSelectionCount()} rows written by a probe`);

  resetBlockSelectionHistory();
  const accepted = acceptBlock(athlete(), {
    todayISO: BLOCK_STARTS[0],
    blockNumber: 1,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  const rows = blockSelectionHistory();
  ok('CONTROL B — accepting a block DOES record',
    rows.length > 0, 'acceptance wrote nothing, so every history cell above is empty');

  /* Exactly one record per governed slot — not one per day, not one per week. */
  const bySlot = new Map<string, number>();
  for (const row of rows) bySlot.set(row.slot, (bySlot.get(row.slot) ?? 0) + 1);
  const duplicated = [...bySlot.entries()].filter(([, n]) => n > 1);
  ok('and EXACTLY ONE canonical record per governed slot',
    duplicated.length === 0,
    duplicated.map(([slot, n]) => `${slot}x${n}`).join(' '));

  /* And every governed slot the block actually programmed is represented. */
  const programmedSlots = new Set(
    rowsOf(accepted).filter((r) => r.mainSlot).map((r) => r.mainSlot as string));
  const missing = [...programmedSlots].filter((slot) => !bySlot.has(slot));
  ok('and every governed slot the block programmed has a record',
    missing.length === 0, missing.join(' '));
  resetBlockSelectionHistory();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log(`\nExercise rotation: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
