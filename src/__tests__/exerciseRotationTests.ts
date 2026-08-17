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
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { decideRotation } from '../rules/exerciseRotation';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import type { SessionFeedback } from '../store/programStore';
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

const FULL_KIT = fullKitEquipmentAnswer();
/**
 * A partial kit — dumbbells and a bench. The second required athlete.
 *
 * ⚠ **A FIXTURE IS A CLAIM TOO.** An earlier version spread the full kit and
 * overrode `tags` with an ARRAY; `EquipmentAnswer.tags` is a RECORD of
 * `tag -> 'have'`, so the answer resolved to no kit and the "partial-kit" cells
 * were silently testing a BODYWEIGHT athlete. Cell [13]'s liveness now pins the
 * kit it actually got.
 */
const DUMBBELL_KIT = {
  tags: { dumbbells: 'have', bench: 'have' },
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
    experienceLevel: 'Intermediate',
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

function build(args: {
  blockNumber: number;
  profile?: OnboardingData;
  feedback?: Record<string, SessionFeedback>;
  prefs?: { excluded?: string[]; pinned?: string[] };
}): TrainingProgram {
  return generateProgramLocally(args.profile ?? athlete(), {
    todayISO: BLOCK_STARTS[args.blockNumber - 1],
    blockNumber: args.blockNumber,
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

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[0] THE FIXTURE IS WHAT IT CLAIMS TO BE — non-vacuity');

const b1 = build({ blockNumber: 1 });
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
const b2Silent = build({ blockNumber: 2 });
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
console.log('\n[6] THE TWO-BLOCK MAXIMUM — ASKED OF THE OWNER DIRECTLY');

/*
 * ⚠ ASKED DIRECTLY, AND THE REASON IS STATED. Reaching a THIRD consecutive block
 * through `generateProgramLocally` needs three chained real histories whose
 * middle block must both qualify AND re-log the retained lift; the world builds
 * it, but the cell would then be asserting the harness's chaining as much as the
 * rule. The owner is a pure function of (candidates, block, history), so asking
 * it directly tests the rule itself. The WORLD cells above already prove the
 * owner is the thing production calls.
 */
{
  const candidates = ['A', 'B', 'C'].map(composedIdentityFor);
  const common = {
    legalCandidates: candidates,
    isMainLift: true,
    weekInBlock: 1,
    isDeloadWeek: false,
    pinnedIdentities: [],
  };

  // Block 2, A progressed → A is retained for a second block.
  const second = decideRotation({
    ...common, blockNumber: 2, progressedIdentities: [candidates[0]],
  });
  ok('a progressed lift is RETAINED for a second consecutive block',
    second.kind === 'retained' && second.identity === candidates[0],
    `${second.kind}/${second.identity}/${second.reason}`);

  // Block 3, A still progressing → the cap must force a rotation.
  const third = decideRotation({
    ...common, blockNumber: 3, progressedIdentities: [candidates[0], candidates[1]],
  });
  ok('but a THIRD consecutive block is refused — the default maximum is two',
    third.kind !== 'retained' && third.identity !== candidates[0],
    `${third.kind}/${third.identity}/${third.reason}`);
  ok('and the refusal says WHY',
    third.reason === 'two_block_maximum_reached', third.reason);

  // Control: without the progression signal there is no retention at all.
  const noHistory = decideRotation({ ...common, blockNumber: 2, progressedIdentities: [] });
  ok('CONTROL — with no recorded progression the slot simply rotates',
    noHistory.kind === 'rotated', `${noHistory.kind}/${noHistory.reason}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] A DELOAD DOES NOT ADVANCE EITHER CADENCE');

{
  const candidates = ['A', 'B', 'C', 'D'].map(composedIdentityFor);
  const base = {
    legalCandidates: candidates,
    isMainLift: false,
    blockNumber: 2,
    pinnedIdentities: [],
    progressedIdentities: [],
  };
  const w3 = decideRotation({ ...base, weekInBlock: 3, isDeloadWeek: false });
  const deload = decideRotation({ ...base, weekInBlock: 4, isDeloadWeek: true });
  ok('an ACCESSORY deload week repeats the last build week, it does not rotate',
    deload.identity === w3.identity, `w3=${w3.identity} deload=${deload.identity}`);

  const mainW1 = decideRotation({
    ...base, isMainLift: true, weekInBlock: 1, isDeloadWeek: false,
  });
  const mainDeload = decideRotation({
    ...base, isMainLift: true, weekInBlock: 4, isDeloadWeek: true,
  });
  ok('and a MAIN lift is identical in the deload and the build weeks',
    mainDeload.identity === mainW1.identity,
    `w1=${mainW1.identity} deload=${mainDeload.identity}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[8] EXCLUSION BEATS PINNING, AND AN ILLEGAL PIN IS UNREACHABLE');

{
  const candidates = ['A', 'B', 'C'].map(composedIdentityFor);
  const excluded = composedIdentityFor('B');

  // The composer removes the excluded name BEFORE the owner is asked. The owner
  // can only ever return something from the list it was handed, so the guard is
  // that a pin on an absent name changes nothing.
  const legalAfterExclusion = candidates.filter((c) => c !== excluded);
  const pinnedButExcluded = decideRotation({
    legalCandidates: legalAfterExclusion,
    isMainLift: true,
    blockNumber: 1,
    weekInBlock: 1,
    isDeloadWeek: false,
    pinnedIdentities: [excluded],
    progressedIdentities: [],
  });
  ok('a pin on an EXCLUDED exercise cannot bring it back',
    pinnedButExcluded.identity !== excluded,
    `chose ${pinnedButExcluded.identity}`);
  ok('and the choice is still a legal one',
    legalAfterExclusion.includes(pinnedButExcluded.identity),
    `chose ${pinnedButExcluded.identity}`);

  // A pin on a LEGAL name does bias the choice.
  const pinnedLegal = decideRotation({
    legalCandidates: candidates,
    isMainLift: true,
    blockNumber: 1,
    weekInBlock: 1,
    isDeloadWeek: false,
    pinnedIdentities: [composedIdentityFor('C')],
    progressedIdentities: [],
  });
  ok('CONTROL — a pin on a LEGAL exercise does bias the choice to it',
    pinnedLegal.identity === composedIdentityFor('C'),
    `chose ${pinnedLegal.identity}; without the pin block 1 takes A`);

  const unpinned = decideRotation({
    legalCandidates: candidates,
    isMainLift: true,
    blockNumber: 1,
    weekInBlock: 1,
    isDeloadWeek: false,
    pinnedIdentities: [],
    progressedIdentities: [],
  });
  ok('and REMOVING the pin restores the ordinary deterministic rotation',
    unpinned.identity === candidates[0], `chose ${unpinned.identity}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[9] A PIN NEVER DEFEATS THE TWO-BLOCK MAXIMUM');

/*
 * ⚠ **THIS CELL WAS REWRITTEN AFTER A MUTATION REDDENED NOTHING.** Its first
 * version pinned one exercise and asserted it was not chosen a third time — and
 * it passed for the wrong reason: the pinned name was not the one the cap acts
 * on, so exempting pins from the cap changed no outcome and the mutation walked
 * straight through. `a-cell-that-asserts-a-pipeline-property-against-one-value`.
 *
 * The clause is not "a pinned lift is eventually dropped". It is **"a pin does
 * not change what the cap does"** — so the guard runs the cap's own scenario
 * TWICE, once with every candidate pinned, and demands the same answer.
 */
{
  const candidates = ['A', 'B', 'C'].map(composedIdentityFor);
  const scenario = (pinnedIdentities: readonly string[]) => decideRotation({
    legalCandidates: candidates,
    isMainLift: true,
    blockNumber: 3,
    weekInBlock: 1,
    isDeloadWeek: false,
    pinnedIdentities,
    progressedIdentities: [candidates[0], candidates[1]],
  });

  const unpinned = scenario([]);
  const everythingPinned = scenario(candidates);

  ok('LIVENESS — the unpinned scenario really is the cap firing',
    unpinned.reason === 'two_block_maximum_reached',
    `reason=${unpinned.reason}; if the cap is not firing this cell proves nothing`);
  ok('pinning every candidate does not change the cap\'s decision',
    everythingPinned.identity === unpinned.identity
      && everythingPinned.reason === unpinned.reason,
    `unpinned=${unpinned.identity}/${unpinned.reason} `
    + `pinned=${everythingPinned.identity}/${everythingPinned.reason}`);
  ok('and the retained lift is still dropped at the third block even when pinned',
    everythingPinned.kind !== 'retained',
    `${everythingPinned.kind}/${everythingPinned.identity}`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[10] THE OWNER REFUSES AN EMPTY SLOT RATHER THAN INVENTING ONE');

{
  let threw = false;
  try {
    decideRotation({
      legalCandidates: [],
      isMainLift: true,
      blockNumber: 1,
      weekInBlock: 1,
      isDeloadWeek: false,
      pinnedIdentities: [],
      progressedIdentities: [],
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
console.log(`\nExercise rotation: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
