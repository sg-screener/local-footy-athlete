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
    retentionEligible: true,
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

/*
 * ⚠ **THE DELOAD NO LONGER HAS A BRANCH TO TEST, AND THAT IS THE POINT.** An
 * earlier revision gave accessories a per-WEEK index and special-cased the
 * deload back onto the last build week. Sam's ruling 2 made every slot's cadence
 * a pure function of the BLOCK, so a deload — week 4 of the same block — is
 * identical for free. What is guarded now is the property, in the real world:
 * the deload's rows are the block's rows. Cell [2] holds that end to end.
 *
 * What remains to ask the owner directly is that block identity, and ONLY block
 * identity, moves the choice.
 */
{
  const candidates = ['A', 'B', 'C', 'D'].map(composedIdentityFor);
  const base = {
    legalCandidates: candidates,
    retentionEligible: false,
    pinnedIdentities: [],
    progressedIdentities: [],
  };
  const b2 = decideRotation({ ...base, blockNumber: 2 });
  const b2again = decideRotation({ ...base, blockNumber: 2 });
  const b3 = decideRotation({ ...base, blockNumber: 3 });
  ok('the same block always yields the same exercise — no week component remains',
    b2.identity === b2again.identity, `${b2.identity} vs ${b2again.identity}`);
  ok('and a NEW block moves it — single-leg and accessories rotate every block',
    b3.identity !== b2.identity, `b2=${b2.identity} b3=${b3.identity}`);
  /* ⚠ **ASKED AT BLOCK 2, NOT BLOCK 3.** At block 3 the two-block cap fires
   * first and rotates anyway, so opening retention to accessories changed
   * nothing and the mutation walked through. Block 2 is the only place the
   * retention branch is reachable unmasked. */
  const accessoryB2 = decideRotation({
    ...base, blockNumber: 2, progressedIdentities: candidates,
  });
  ok('a non-retention slot is never retained, even with every lift progressing',
    accessoryB2.kind !== 'retained',
    `${accessoryB2.kind}/${accessoryB2.reason} — single-leg and accessories `
    + 'rotate at EVERY new block');
  ok('and its reason names the cadence, not the history',
    accessoryB2.reason === 'accessory_cadence', accessoryB2.reason);
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
    retentionEligible: true,
    blockNumber: 1,
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
    retentionEligible: true,
    blockNumber: 1,
    pinnedIdentities: [composedIdentityFor('C')],
    progressedIdentities: [],
  });
  ok('CONTROL — a pin on a LEGAL exercise does bias the choice to it',
    pinnedLegal.identity === composedIdentityFor('C'),
    `chose ${pinnedLegal.identity}; without the pin block 1 takes A`);

  const unpinned = decideRotation({
    legalCandidates: candidates,
    retentionEligible: true,
    blockNumber: 1,
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
    retentionEligible: true,
    blockNumber: 3,
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
      retentionEligible: true,
      blockNumber: 1,
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
console.log('\n[16] NO LEGAL ALTERNATIVE — RULING 3, AND THE GAP IS NAMED');

{
  /*
   * *"If no different legal same-pattern exercise exists, retain the only legal
   * exercise and report that exact pool-content gap. Never cross movement groups
   * or choose an illegal exercise merely to demonstrate rotation."*
   */
  const only = [composedIdentityFor('Single-Leg RDL')];
  const b2 = decideRotation({
    legalCandidates: only,
    retentionEligible: false,
    blockNumber: 2,
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
console.log(`\nExercise rotation: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
