/**
 * THE FOUR-ANSWER GATE — a session type may not exist until Sam has ruled who
 * places it, who chooses it, how it counts, and who authored its contents.
 *
 * `rules/sessionTypeCharter.ts` holds the ruled answers. This suite binds them
 * to the code in BOTH directions, which is the only version of the gate worth
 * having: a charter checked one way is a wish list, and a charter checked the
 * other way is a mirror of whatever the code already does.
 *
 *   charter -> code   every ruled answer is true of the code, or is declared debt
 *   code -> charter   every door, every placed session and every counting
 *                     behaviour the code exhibits traces to a charter row
 *
 * AND FOUR MORE DIRECTIONS ON THE DEBT, because the charter records the RULED
 * end state and stages 2-4 are what bring the code to it:
 *
 *   1. satisfied answers stay satisfied
 *   2. every observed deviation is declared
 *   3. every declared deviation is still REAL — stale debt fails
 *   4. per-type ceilings hold with EQUALITY, so paying a debt means lowering the
 *      ceiling in the same commit and no ceiling carries slack
 *
 * Direction 3 is the one usually missing; direction 4 is the one my notes record
 * as the reason ratchets stop ratcheting (a global budget lets one unit spend
 * another's savings).
 *
 * HOW THE ANSWERS ARE OBSERVED, and why it is not a grep.
 *
 * AGENTS.md: "a gate that reads code rather than behaviour is coupled to the
 * code's SHAPE, and refactoring changes shape by definition." So counting is
 * observed by EVALUATING weeks — build one real session through the app's own
 * builder, put it alone in a week, and ask the Section 18 evaluator what
 * changed against an empty week. Placement is observed by GENERATING a program
 * and classifying every session the generator placed. Composition is bound to
 * the SIZE of the authored source, so a source that silently empties is a
 * composition that silently becomes invented.
 *
 * WHAT AN OBSERVATION CANNOT DO, stated rather than implied. A generated sample
 * can prove a type IS placed; it cannot prove one is NEVER placed, because the
 * sample is one athlete's program and not the space of all of them. So the
 * placement direction is asymmetric on purpose: "the charter says generator and
 * nothing was placed" is a FAILURE (an unearned claim), and "the charter says
 * athlete-only and the generator placed it" is a FAILURE (an observed
 * deviation), while silence about a type the charter says is athlete-only is
 * evidence and not proof. Stage 2 replaces the sampling half of that with a
 * structural one, when the generator's vocabulary becomes typed.
 *
 * DEPTH (L13): 1-2 — generate, then evaluate single-session weeks. The charter's
 * claims are about VOCABULARY (which types exist, what they count as), and a
 * vocabulary does not accumulate with the length of an athlete's life. What DOES
 * need depth is whether a long-lived week keeps answering the same way after
 * many edits, and that is recorded as not covered.
 *
 * Run: npm run test:session-type-charter
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

import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { buildCoachRevisionTemplateWorkout } from '../utils/coachRevisionTemplates';
import { PLAN_CHANGE_CATEGORY_IDS, type PlanChangeCategoryId } from '../utils/planChangeTypes';
import {
  CHARTER_DEBT,
  CHARTER_DEBT_CEILING,
  CHARTER_QUESTIONS,
  SESSION_TYPE_CHARTER,
  SESSION_TYPE_IDS,
  charterClaimedCategories,
  charterDebtCovers,
  charterDebtFor,
  type CharterQuestion,
  type SessionTypeId,
} from '../rules/sessionTypeCharter';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { listCoachRevisionTemplates } from '../utils/coachRevisionTemplates';
import {
  BREATHING_RESET_POOL,
  EASY_CARDIO_POOL,
  MOBILITY_POOL,
  TISSUE_QUALITY_POOL,
} from '../data/exercisePools';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import {
  BICEPS_POOL,
  TRICEPS_POOL,
  DELTS_POOL,
  GROIN_ADDUCTORS_POOL,
  CALVES_POOL,
  LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL,
  SHOULDER_HEALTH_POOL,
  HAMSTRING_LIGHT_POOL,
} from '../data/exercisePools';
import {
  samExport8Profile,
  samExport8EquipmentAnswerThroughTheDoor,
} from './support/samDeviceExport8Fixture';
import { useProfileStore } from '../store/profileStore';

// The template doors read the LIVE athlete context, and they are post-
// onboarding surfaces: a real athlete behind them always has an equipment
// answer (the step is required, 2026-07-31). The store's initial data is now
// honestly empty, so the suite seeds the same answered athlete it generates
// for — an unseeded store here would sample a world no athlete is in.
useProfileStore.setState({
  onboardingData: {
    ...samExport8Profile(),
    equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
  },
  isOnboardingComplete: true,
} as never);

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

// ──────────────────────────────────────────────────────────────────────────
// GROUP A — completeness. "No session type without four answers."
//
// The TYPE already makes a missing answer impossible to compile, so these cells
// assert the answers are SUBSTANTIVE: an empty placement list, a chooser that
// names no door, or a composition citing no source are each a way of writing
// "unanswered" while satisfying the type.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- A. every type answers all four questions --');

run('A1. the charter covers Sam\'s seven, and only his seven', () => {
  assert(SESSION_TYPE_IDS.length === 7, `charter has ${SESSION_TYPE_IDS.length} types, not 7`);
  for (const id of SESSION_TYPE_IDS) {
    assert(SESSION_TYPE_CHARTER[id]?.id === id, `charter row for "${id}" is missing or mislabelled`);
  }
  assert(Object.keys(SESSION_TYPE_CHARTER).length === 7,
    'the charter record has rows the id list does not name');
});

run('A2. (a) every type names who may place it', () => {
  for (const id of SESSION_TYPE_IDS) {
    assert(SESSION_TYPE_CHARTER[id].placedBy.length > 0,
      `"${id}" names nobody who may place it — a type nothing can place cannot exist`);
  }
});

run('A3. (b) every type names how the athlete reaches it', () => {
  for (const id of SESSION_TYPE_IDS) {
    const chooser = SESSION_TYPE_CHARTER[id].chosenBy;
    assert(chooser.categories.length > 0 || chooser.otherDoor !== null,
      `"${id}" has no chooser. "There is no door" is not an answer to (b) — either `
      + 'a category reaches it or a named door does');
  }
});

run('A4. (c) every type\'s counting answer is complete', () => {
  for (const id of SESSION_TYPE_IDS) {
    const counting = SESSION_TYPE_CHARTER[id].counting as unknown as Record<string, unknown>;
    for (const key of ['countsTowardLoad', 'canBeHardDay', 'required']) {
      assert(typeof counting[key] === 'boolean',
        `"${id}" does not answer counting.${key}`);
    }
  }
});

run('A5. (d) every type cites an authored source, or says it has no contents', () => {
  for (const id of SESSION_TYPE_IDS) {
    const composition = SESSION_TYPE_CHARTER[id].composition;
    assert(composition.source.trim().length > 0, `"${id}" cites no composition source`);
    if (composition.kind === 'authored') {
      assert(typeof composition.count === 'number' && composition.count > 0,
        `"${id}" claims authored contents but no population — an authored source `
        + 'with no entries is an invented one wearing a citation');
    } else {
      assert(composition.count === null,
        `"${id}" says it has no contents but counts some`);
    }
  }
});

run('A6. every row cites the ruling its four answers came from', () => {
  for (const id of SESSION_TYPE_IDS) {
    assert(SESSION_TYPE_CHARTER[id].ruling.trim().length > 20,
      `"${id}" has no ruling citation — provenance travels with the answer or the `
      + 'charter is just an opinion');
  }
});

run('A7. counting is internally coherent', () => {
  // A type that cannot be a hard day but counts toward load, or is required but
  // counts toward nothing, is a contradiction in the ruling itself — worth
  // catching in the charter before the code is asked to implement it.
  for (const id of SESSION_TYPE_IDS) {
    const { countsTowardLoad, canBeHardDay, required } = SESSION_TYPE_CHARTER[id].counting;
    assert(!(canBeHardDay && !countsTowardLoad),
      `"${id}" may be a hard day but counts toward no load — a hard day IS load`);
    assert(!(required && !countsTowardLoad),
      `"${id}" is required work that counts toward nothing — then nothing requires it`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GROUP B — (b) the chooser, equality-bound both directions.
//
// `PLAN_CHANGE_CATEGORY_IDS` is now the single declaration the union derives
// from, so a new door is a compile error at every switch AND a red cell here
// until Sam has ruled its four answers.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- B. the athlete\'s doors, both directions --');

run('B1. every door the app offers belongs to a charter type', () => {
  const claimed = new Set(charterClaimedCategories());
  const orphans = PLAN_CHANGE_CATEGORY_IDS.filter((id) => !claimed.has(id));
  assert(orphans.length === 0,
    `the athlete can choose ${orphans.join(', ')}, and the charter does not say `
    + 'what they place. A door is a promise about a session type.');
});

run('B2. every door a charter type claims actually exists', () => {
  const existing = new Set<PlanChangeCategoryId>(PLAN_CHANGE_CATEGORY_IDS);
  for (const id of SESSION_TYPE_IDS) {
    for (const category of SESSION_TYPE_CHARTER[id].chosenBy.categories) {
      assert(existing.has(category),
        `the charter says "${id}" is chosen through "${category}", and no such door exists`);
    }
  }
});

run('B3. a type with no category has declared debt or a real other door', () => {
  // The mobility gap in gate form: a charter row may say "no category" only
  // while the debt list is carrying it, or when the other door is genuinely
  // built (Rest's Remove). Otherwise the row is describing a door nobody built.
  for (const id of SESSION_TYPE_IDS) {
    const row = SESSION_TYPE_CHARTER[id];
    if (row.chosenBy.categories.length > 0) continue;
    const notBuilt = (row.chosenBy.otherDoor ?? '').includes('NOT BUILT');
    assert(!notBuilt || charterDebtCovers(id, 'chooser'),
      `"${id}" names a door that is not built and declares no chooser debt`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// THE OBSERVATION HARNESS.
//
// One generation, reused: it supplies the Contract v2 the evaluator needs AND
// the placement sample. Everything below asks the real evaluator real questions
// about weeks built from the app's own builders.
// ──────────────────────────────────────────────────────────────────────────

const WEEK = '2026-07-27';
const DATE_IN_WEEK = '2026-07-27';

// Sam's export predates the equipment door; the charter walks his profile
// through TODAY'S doors, so it answers the question the way he would — the
// same composition the walker's conformance target uses.
const program = quiet(() => generateProgramLocally({
  ...samExport8Profile(),
  equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
} as never, {
  todayISO: '2026-07-13',
  previousProgram: null,
  seasonPhaseClock: {
    protocolVersion: 1,
    selectedPhase: 'Pre-season',
    phaseEntryWeekStartISO: '2026-07-13',
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  },
})) as TrainingProgram;

const week = program.microcycles.find((m) => m.startDate.slice(0, 10) === WEEK)
  ?? program.microcycles[0];
const contract = week.exposureContractV2;

function evaluate(workouts: readonly Workout[]) {
  return quiet(() => evaluateSection18EffectiveWeek({
    contract: contract as never, workouts: workouts as never, weekStart: WEEK,
  }));
}

/** What the ledger says when the week is empty. Every observation is a delta from here. */
const EMPTY = evaluate([]);

/**
 * A day the CONTRACT does not already own.
 *
 * The contract's team-training anchors occupy their days whether or not a
 * workout sits on them, so placing a representative session on a fixed day 0
 * would measure the anchor and call it the session. Chosen from the empty week's
 * own rest days, which is the definition of "nothing here but this".
 */
const FREE_DAY = EMPTY.ledger.restStress.trueFullRestDays[0];
const ANCHOR_DAYS = new Set(
  (contract?.anchors ?? []).map((anchor: { dayOfWeek: number }) => anchor.dayOfWeek),
);

/** One representative session per type, built by the app itself — never by hand. */
const REPRESENTATIVE: Readonly<Record<SessionTypeId, readonly string[]>> = {
  rest: [],
  recovery: ['recovery_flow'],
  strength: ['strength_lower'],
  // Both, so `canBeHardDay` is observed against the template that could be hard.
  conditioning: ['easy_zone2_bike', 'metcon_offlegs'],
  // Mobility was UNOBSERVABLE until stage 4 built its door — no template, so no
  // session, so no way to check any of its four answers against behaviour. The
  // id is looked up rather than written down because there is one template per
  // authored flow and their ids follow the flows, not this list.
  mobility: listCoachRevisionTemplates()
    .filter((template) => template.category === 'mobility')
    .slice(0, 1)
    .map((template) => template.templateId),
  prehab: ['accessories_prehab'],
  gunshow: ['accessories_pump'],
};

function builtSession(templateId: string, dayOfWeek: number): Workout | null {
  const workout = quiet(() => buildCoachRevisionTemplateWorkout(templateId, DATE_IN_WEEK));
  if (!workout) return null;
  return { ...workout, dayOfWeek } as Workout;
}

interface ObservedCounting {
  readonly countsTowardLoad: boolean | null;
  readonly canBeHardDay: boolean | null;
  readonly required: boolean | null;
}

const UNOBSERVABLE: ObservedCounting = {
  countsTowardLoad: null, canBeHardDay: null, required: null,
};

/**
 * What does the ledger do when this type is the only thing in the week?
 *
 * `required` is read from the rest quota directly: the day the session sits on
 * either counts as rest or does not, and that IS the Rest law's question.
 */
function observeCounting(type: SessionTypeId): ObservedCounting {
  if (type === 'rest') {
    // Rest's own observation is the empty week read at a free day: nothing
    // placed, nothing counted, and the day still rest. If that is not true the
    // harness is broken, not the charter.
    return {
      countsTowardLoad: false,
      canBeHardDay: EMPTY.ledger.restStress.hardDays.includes(FREE_DAY),
      required: !EMPTY.ledger.restStress.trueFullRestDays.includes(FREE_DAY),
    };
  }
  const templates = REPRESENTATIVE[type];
  if (templates.length === 0) return UNOBSERVABLE;

  let countsTowardLoad = false;
  let canBeHardDay = false;
  let required = false;
  let observedAny = false;

  for (const templateId of templates) {
    const session = builtSession(templateId, FREE_DAY);
    if (!session) continue;
    observedAny = true;
    const load = evaluate([session]).ledger;
    // A HARD DAY IS LOAD. Reading only the exposure totals would call a session
    // that consumes the week's hard-day budget "invisible to the ledger", which
    // is the opposite of what the athlete's week experiences.
    const madeItsDayHard = load.restStress.hardDays.includes(FREE_DAY);
    if (
      madeItsDayHard ||
      load.mainStrength.achievedCount > EMPTY.ledger.mainStrength.achievedCount ||
      load.conditioning.coreCount > EMPTY.ledger.conditioning.coreCount ||
      load.conditioning.optionalFlushCount > EMPTY.ledger.conditioning.optionalFlushCount ||
      load.sprintHighSpeed.achievedCount > EMPTY.ledger.sprintHighSpeed.achievedCount ||
      load.power.achievedPrimerCount > EMPTY.ledger.power.achievedPrimerCount
    ) countsTowardLoad = true;
    if (madeItsDayHard) canBeHardDay = true;
    if (!load.restStress.trueFullRestDays.includes(FREE_DAY)) required = true;
  }
  if (!observedAny) return UNOBSERVABLE;
  return { countsTowardLoad, canBeHardDay, required };
}

const OBSERVED_COUNTING: Readonly<Record<SessionTypeId, ObservedCounting>> =
  Object.fromEntries(SESSION_TYPE_IDS.map((id) => [id, observeCounting(id)])) as never;

// ──────────────────────────────────────────────────────────────────────────
// GROUP C — (c) counting, observed by evaluating real weeks.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- C. what each type counts as, observed --');

run('C0. the harness can count at all', () => {
  // NON-VACUITY. Every cell below would pass on a build where the ledger counted
  // nothing, and that is precisely the un-gating hazard AGENTS.md names.
  const expectedRest = 7 - ANCHOR_DAYS.size;
  assert(EMPTY.ledger.restStress.trueFullRestDays.length === expectedRest,
    `an empty week reports ${EMPTY.ledger.restStress.trueFullRestDays.length} rest days `
    + `against ${ANCHOR_DAYS.size} contract anchors, so ${expectedRest} was expected — `
    + 'the harness is not measuring what it thinks');
  assert(typeof FREE_DAY === 'number' && !ANCHOR_DAYS.has(FREE_DAY),
    'no anchor-free day to observe on — every observation below would be measuring an anchor');
  assert(OBSERVED_COUNTING.strength.countsTowardLoad === true,
    'a real strength session moved no load number — the ledger is not counting, so '
    + 'every neutrality claim below is meaningless');
});

for (const type of SESSION_TYPE_IDS) {
  run(`C1.${type} — load, hard day and required match the ruling`, () => {
    const ruled = SESSION_TYPE_CHARTER[type].counting;
    const seen = OBSERVED_COUNTING[type];
    if (seen.countsTowardLoad === null) {
      assert(charterDebtCovers(type, 'counting'),
        `"${type}" cannot be observed at all — no session builder reaches it — and `
        + 'no counting debt is declared. An unobservable answer is an unchecked one.');
      return;
    }
    const mismatches: string[] = [];
    if (seen.countsTowardLoad !== ruled.countsTowardLoad) {
      mismatches.push(`countsTowardLoad ruled ${ruled.countsTowardLoad}, observed ${seen.countsTowardLoad}`);
    }
    if (seen.canBeHardDay !== ruled.canBeHardDay) {
      mismatches.push(`canBeHardDay ruled ${ruled.canBeHardDay}, observed ${seen.canBeHardDay}`);
    }
    if (seen.required !== ruled.required) {
      mismatches.push(`required ruled ${ruled.required}, observed ${seen.required}`);
    }
    if (mismatches.length === 0) return;
    assert(charterDebtCovers(type, 'counting'),
      `"${type}" counts differently from the ruling and declares no debt:\n      `
      + mismatches.join('\n      '));
  });
}

run('C2. nothing outside strength and conditioning counts toward load', () => {
  // The ruling that binds four types at once, asserted as a class rather than
  // four times: if a fifth type ever starts counting, this is what catches it.
  for (const type of SESSION_TYPE_IDS) {
    const seen = OBSERVED_COUNTING[type];
    if (seen.countsTowardLoad === null) continue;
    if (type === 'strength' || type === 'conditioning') continue;
    if (seen.countsTowardLoad === false) continue;
    assert(charterDebtCovers(type, 'counting'),
      `"${type}" moved a Section 18 load number. Only strength and conditioning are `
      + 'load (Sam, ruling 3), and no counting debt is declared.');
  }
});

run('C3. the Accessories door is never a hard day (ruling 2)', () => {
  // THE PIN, PAID. This cell asserted TODAY's behaviour with the defect named:
  // `accessories_prehab` classified as `lower_strength` at HIGH stress and took
  // a hard day off the week's budget, against Sam's ruling 2. The pin's own
  // failure message said to rewrite it to the ruling when the door was fixed,
  // and stage 4 fixed it.
  //
  // THE FIX WAS TYPED EVIDENCE, NOT A NAME RULE. The rows carried no Section 18
  // evidence at all, so every consumer inferred — and the session draws Cossack
  // Squat from the groin pool, so one accessory movement re-typed the whole
  // session as lower strength. Accessory rows now declare
  // `role: 'strength_accessory'`, and the ledger stops guessing.
  //
  // STILL TRUE, AND STILL DEBT: the visible CLASSIFIER (`classifyVisibleSession`)
  // continues to read the session as `upper_strength`/`lower_strength` rather
  // than `gunshow_prehab`, because it works from names and exercises. That is
  // the prehab/gunshow placement debt, and it is why this cell asserts the
  // LEDGER — which is what the week's hard-day budget actually reads.
  const prehab = builtSession('accessories_prehab', FREE_DAY);
  const pump = builtSession('accessories_pump', FREE_DAY);
  assert(prehab && pump, 'the Accessories door builds nothing — the cell has no subject');
  for (const [name, session] of [['prehab', prehab], ['gunshow', pump]] as const) {
    const ledger = evaluate([session]).ledger;
    assert(!ledger.restStress.hardDays.includes(FREE_DAY),
      `an Accessories session (${name}) still takes a hard day. Ruling 2: gunshow, `
      + 'accessories, recovery and prehab are never hard days.');
    assert(ledger.mainStrength.achievedCount === EMPTY.ledger.mainStrength.achievedCount,
      `an Accessories session (${name}) earned main-strength credit`);
    assert(ledger.mainStrength.accessoryOnlySessionCount >
      EMPTY.ledger.mainStrength.accessoryOnlySessionCount,
      `${name} is not counted as accessory work at all — it is invisible to the `
      + 'ledger rather than typed as accessory, which is a different thing');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GROUP D — (d) composition, bound to the SIZE of the authored source.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- D. who authored the contents --');

/**
 * What a recovery session actually draws from.
 *
 * The charter used to cite the ten flow bundles here. It was never true —
 * `buildDerivedSession('recovery')` composes from these four pools — and retiring
 * the bundles (2026-07-30) is what surfaced it.
 */
const RECOVERY_POOLS = [
  TISSUE_QUALITY_POOL, MOBILITY_POOL, EASY_CARDIO_POOL, BREATHING_RESET_POOL,
];

const PREHAB_POOLS = [
  GROIN_ADDUCTORS_POOL, CALVES_POOL, LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL, SHOULDER_HEALTH_POOL, HAMSTRING_LIGHT_POOL,
];

/** The live population of each cited source, counted from the source itself. */
const AUTHORED_POPULATION: Readonly<Record<SessionTypeId, number | null>> = {
  rest: null,
  recovery: RECOVERY_POOLS.reduce((total, pool) => total + pool.length, 0),
  strength: Object.keys(STRENGTH_POOLS).length,
  conditioning: CONDITIONING_TEMPLATES.length,
  mobility: MOBILITY_POOL.length,
  prehab: PREHAB_POOLS.reduce((total, pool) => total + pool.length, 0),
  gunshow: BICEPS_POOL.length + TRICEPS_POOL.length + DELTS_POOL.length,
};

/**
 * The AUTHORED NAMES each type may draw from — the runtime form of its (d).
 *
 * Strength's source is the locked list rather than STRENGTH_POOLS alone: a
 * strength session legitimately fills accessory slots from the curated prehab
 * and arms pools, and `selectableExerciseNames()` is already the app's single
 * owner of "which exercises exist" (exerciseLockedListTests §5). Re-deriving a
 * narrower list here would be a second representation of that answer, and it
 * would red on a session that is in fact perfectly authored.
 */
const AUTHORED_NAMES: Readonly<Record<SessionTypeId, ReadonlySet<string> | null>> = {
  rest: null,
  recovery: new Set(RECOVERY_POOLS.flat().map((entry) => canonicalExerciseName(entry.name))),
  strength: new Set(selectableExerciseNames().map(canonicalExerciseName)),
  conditioning: new Set(CONDITIONING_TEMPLATES.map(
    (template) => canonicalExerciseName(template.name))),
  mobility: new Set(MOBILITY_POOL.map((entry) => canonicalExerciseName(entry.name))),
  prehab: new Set(PREHAB_POOLS.flat().map((entry) => canonicalExerciseName(entry.name))),
  gunshow: new Set([...BICEPS_POOL, ...TRICEPS_POOL, ...DELTS_POOL].map(
    (entry) => canonicalExerciseName(entry.name))),
};

/**
 * Rows in this type's representative session that its cited source does NOT
 * contain — the whole of question (d), asked of behaviour.
 *
 * Names are canonicalised before comparing, because "Face Pulls" and "Face Pull"
 * are the same movement and a gate that says otherwise reports noise. What it
 * does NOT do is canonicalise across movements: "Face Pull" and "Cable Face
 * Pull" are two authored entries in two different pools, and collapsing them
 * would hide exactly the cross-family draw Sam's no-top-ups ruling forbids.
 */
function untracedRows(type: SessionTypeId): string[] | null {
  const source = AUTHORED_NAMES[type];
  if (!source) return [];
  const templates = REPRESENTATIVE[type];
  if (templates.length === 0) return null;
  const untraced: string[] = [];
  for (const templateId of templates) {
    const session = builtSession(templateId, FREE_DAY);
    if (!session) return null;
    for (const row of session.exercises ?? []) {
      const name = (row as { exercise?: { name?: string } }).exercise?.name;
      if (!name) continue;
      if (!source.has(canonicalExerciseName(name))) untraced.push(name);
    }
  }
  return untraced;
}

const UNTRACED: Readonly<Record<SessionTypeId, string[] | null>> =
  Object.fromEntries(SESSION_TYPE_IDS.map((id) => [id, untracedRows(id)])) as never;

/** Registry templates that build a session of this type, for `sessionVariants`. */
function registryVariants(type: SessionTypeId): number | null {
  const registry = listCoachRevisionTemplates();
  switch (type) {
    case 'strength': return registry.filter((t) => t.category === 'strength').length;
    case 'conditioning':
      return registry.filter((t) => t.category === 'flush' || t.category === 'work_capacity').length;
    case 'recovery': return registry.filter((t) => t.category === 'recovery').length;
    case 'prehab': case 'gunshow':
      return registry.filter((t) => t.category === 'accessories').length;
    default: return null;
  }
}

run('D1. every cited source is the size the charter says it is', () => {
  for (const type of SESSION_TYPE_IDS) {
    const ruled = SESSION_TYPE_CHARTER[type].composition.count;
    const actual = AUTHORED_POPULATION[type];
    assert(ruled === actual,
      `"${type}" cites ${ruled} authored entries and its source holds ${actual}. `
      + `Source: ${SESSION_TYPE_CHARTER[type].composition.source}`);
  }
});

run('D2. Sam\'s two signed censuses are exactly as delivered', () => {
  // He signed these numbers off by hand. They are pinned per-pool, not as a
  // total, because a total can stay right while two pools move in opposite
  // directions — and the pools are what the sessions draw from.
  assert(BICEPS_POOL.length === 5, `biceps ${BICEPS_POOL.length}, signed 5`);
  assert(TRICEPS_POOL.length === 5, `triceps ${TRICEPS_POOL.length}, signed 5`);
  assert(DELTS_POOL.length === 6, `delts ${DELTS_POOL.length}, signed 6`);
  assert(PREHAB_POOLS.length === 6, `prehab draws on ${PREHAB_POOLS.length} pools, signed 6`);
  const prehabTotal = PREHAB_POOLS.reduce((total, pool) => total + pool.length, 0);
  assert(prehabTotal === 36, `prehab census ${prehabTotal}, signed 36`);
});

run('D3. shoulder health is prehab\'s, and pump delts are the gunshow\'s', () => {
  // Sam's ruling of 2026-07-30, as a boundary rather than a comment: the two
  // shoulder pools do different jobs and neither may quietly become the other.
  const health = new Set(SHOULDER_HEALTH_POOL.map((entry) => entry.name));
  const pump = new Set(DELTS_POOL.map((entry) => entry.name));
  const overlap = Array.from(health).filter((name) => pump.has(name));
  assert(overlap.length === 0,
    `${overlap.join(', ')} is in both the shoulder-health pool and the pump delts `
    + 'pool. Sam ruled gunshow "shoulders" means DELTS_POOL and shoulder health '
    + 'stays with Accessories; an exercise in both erases the distinction.');
  assert(PREHAB_POOLS.includes(SHOULDER_HEALTH_POOL),
    'shoulder health left the prehab census');
});

for (const type of SESSION_TYPE_IDS) {
  run(`D4.${type} — its contents come from the source it cites`, () => {
    const untraced = UNTRACED[type];
    if (untraced === null) {
      assert(charterDebtCovers(type, 'composition'),
        `"${type}" builds no session at all, so nothing can check where its contents `
        + 'come from, and no composition debt is declared');
      return;
    }
    if (untraced.length === 0) return;
    assert(charterDebtCovers(type, 'composition'),
      `"${type}" prescribes ${Array.from(new Set(untraced)).join(', ')}, which its `
      + `cited source does not contain (${SESSION_TYPE_CHARTER[type].composition.source}), `
      + 'and no composition debt is declared. The app is choosing words Sam did not author.');
  });
}

run('D5. an app that offers fewer sessions than Sam ruled says so', () => {
  for (const type of SESSION_TYPE_IDS) {
    const ruled = SESSION_TYPE_CHARTER[type].composition.sessionVariants;
    if (ruled === null) continue;
    const actual = registryVariants(type);
    if (actual === ruled) continue;
    assert(charterDebtCovers(type, 'composition'),
      `"${type}" offers ${actual} authored sessions where ${ruled} were ruled, and `
      + 'declares no composition debt. Every exercise in those sessions is authored, '
      + 'which is why no exercise-level gate can see this.');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GROUP E — (a) placement, observed by generating.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- E. who placed it --');

/**
 * EVERY charter type this generated session contains — never the first match.
 *
 * A day carrying lower strength AND aerobic conditioning is both, and a
 * first-match classifier would have reported this program as containing no
 * conditioning at all. That is not a small slip: it would have made the
 * charter's "the generator places conditioning" claim look unearned and sent
 * stage 3 chasing a gap that does not exist.
 */
function charterTypesOf(workout: Workout): {
  types: SessionTypeId[]; anchor: boolean; ambiguous: boolean; named: boolean;
} {
  const tier = (workout as { sessionTier?: string }).sessionTier;
  const classification = quiet(() => classifyVisibleSession(workout));
  const categories = new Set<string>(classification.categories);
  const types: SessionTypeId[] = [];
  if (workout.workoutType === 'Recovery' || tier === 'recovery' || categories.has('recovery')) {
    types.push('recovery');
  }
  if (
    categories.has('lower_strength') || categories.has('upper_strength') ||
    categories.has('full_body_strength')
  ) types.push('strength');
  if (
    categories.has('aerobic_base') || categories.has('tempo_conditioning') ||
    categories.has('hard_conditioning') || categories.has('sprint')
  ) types.push('conditioning');
  if (categories.has('rest')) types.push('rest');
  // ATTRIBUTABLE SINCE THE SPLIT (Sam, 2026-07-30). The survey's finding 6 was that
  // ONE category covered two of Sam's types, so a placed accessory session could not
  // be attributed to prehab or to gunshow and BOTH owed placement debt. The taxonomy
  // now names them separately, so each placement attributes to exactly one type and
  // `ambiguous` has no producer left.
  if (categories.has('gunshow')) types.push('gunshow');
  if (categories.has('prehab')) types.push('prehab');
  const anchor = categories.has('game') || categories.has('team_training');
  return { types, anchor, ambiguous: false, named: types.length > 0 || anchor };
}

/**
 * A SECOND PLACEMENT SAMPLE, because one could not see the G-1 Gunshow.
 *
 * The program above is a PRE-SEASON no-game program, and the authored Gunshow is an
 * IN-SEASON, fixture-relative placement (Bible `:153`, G-1). So the charter's claim
 * "the generator places gunshow" had no subject in this observation and read as
 * unearned — the same shape as the assertion this suite removed once before for having
 * no reachable subject. The answer is to make the observation able to see it rather
 * than to excuse the claim: placement is now observed over BOTH programs.
 */
const inSeasonProgram = quiet(() => generateProgramLocally({
  ...samExport8Profile(),
  equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
  seasonPhase: 'In-season',
  usualGameDay: 'Saturday',
  gameDay: 'Saturday',
} as never, {
  todayISO: '2026-07-13',
  previousProgram: null,
  seasonPhaseClock: {
    protocolVersion: 1,
    selectedPhase: 'In-season',
    phaseEntryWeekStartISO: '2026-07-13',
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  },
})) as TrainingProgram;

const placedTypes = new Set<SessionTypeId>();
let ambiguousPlacements = 0;
const unclassifiable: string[] = [];
for (const microcycle of [...program.microcycles, ...inSeasonProgram.microcycles]) {
  for (const workout of microcycle.workouts ?? []) {
    const seen = charterTypesOf(workout as Workout);
    if (seen.ambiguous) ambiguousPlacements += 1;
    for (const type of seen.types) placedTypes.add(type);
    if (!seen.named) unclassifiable.push(workout.name ?? '(unnamed)');
  }
  // REST IS PLACED BY ABSENCE, and that is the ruled shape rather than a gap.
  //
  // A stored rest session would be a stored DERIVED OUTPUT, which
  // docs/NORTH_STAR.md presumes wrong — so the generator expresses "nothing is
  // required of you today" by requiring nothing, and the Rest law's quota reads
  // it. The observation has to match: a generated week that leaves a day free
  // IS the generator placing rest, and looking for a rest WORKOUT would report
  // a correctly-converged design as a defect.
  const occupied = new Set((microcycle.workouts ?? []).map((workout) => workout.dayOfWeek));
  if ([0, 1, 2, 3, 4, 5, 6].some((day) => !occupied.has(day))) placedTypes.add('rest');
}

/**
 * Prehab and Gunshow are TWO classifications, and that is a fact about the code
 * rather than about this sample.
 *
 * Read from a produced classification's own shape — it must carry BOTH a `gunshow`
 * and a `prehab` contribution — so it stays true on a program that happens to contain
 * no accessory session at all. Keying it on "did we see one" would let a week with
 * none report the split as done.
 *
 * It was `ACCESSORY_TYPES_SPLIT` and asserted the opposite. The split is Sam's
 * ruling of 2026-07-30 and it is what paid both placement debts, so the constant is
 * inverted rather than deleted: the direction that must not silently return is the
 * collapse.
 */
const ACCESSORY_TYPES_SPLIT = (() => {
  const sample = program.microcycles[0]?.workouts?.[0];
  if (!sample) return false;
  const keys = Object.keys(
    quiet(() => classifyVisibleSession(sample as Workout)).contributions);
  return keys.includes('gunshow') && keys.includes('prehab');
})();

run('E0. the placement sample is real', () => {
  assert(program.microcycles.length >= 2,
    `only ${program.microcycles.length} generated weeks — too small a sample to observe placement`);
  assert(placedTypes.size >= 2,
    'the generator placed fewer than two distinguishable types — the classifier is not classifying');
});

run('E1. the generator places nothing the charter says it may not', () => {
  const violations = Array.from(placedTypes).filter(
    (type) => !SESSION_TYPE_CHARTER[type].placedBy.includes('generator')
      && !charterDebtCovers(type, 'placement'),
  );
  assert(violations.length === 0,
    `the generator placed ${violations.join(', ')}, which the charter says only the `
    + 'athlete may choose, and no placement debt is declared');
});

run('E2. every "the generator places it" claim is earned', () => {
  // An unfalsified claim is not a true one. A type the charter says the generator
  // places, that no generated week contains, is a claim nothing supports.
  const unearned = SESSION_TYPE_IDS.filter(
    (type) => SESSION_TYPE_CHARTER[type].placedBy.includes('generator')
      && !placedTypes.has(type)
      && !charterDebtCovers(type, 'placement'),
  );
  assert(unearned.length === 0,
    `the charter says the generator places ${unearned.join(', ')} and no generated `
    + 'week contains one. Either the claim is wrong or the observation cannot see it — '
    + 'both are answers the charter owes.');
});

run('E3. every session the generator places has a charter type', () => {
  assert(unclassifiable.length === 0,
    `the generator placed ${unclassifiable.length} sessions the charter cannot name: `
    + `${Array.from(new Set(unclassifiable)).slice(0, 5).join(', ')}. A session outside `
    + 'Sam\'s seven is a type nobody ruled.');
});

run('E4. prehab and gunshow are SEPARATE classifications', () => {
  // THE DEBT THIS PAID. Both types recorded their placement answer as unattributable
  // for one reason: a single `gunshow_prehab` category could not say which of them a
  // placed session was. Sam split the door and the taxonomy on 2026-07-30, so each
  // placement attributes to exactly one type — and neither may declare placement debt
  // any more, which direction 3 of the ratchet enforces from the other side.
  assert(ACCESSORY_TYPES_SPLIT,
    'the classifier carries a `gunshow` contribution with no `prehab` counterpart. The '
    + 'collapse is back, and with it the unattributable placement it caused.');
  assert(ambiguousPlacements === 0,
    `${ambiguousPlacements} placed sessions are still classified ambiguously`);
  for (const type of ['prehab', 'gunshow'] as const) {
    assert(!charterDebtCovers(type, 'placement'),
      `"${type}" still declares placement debt, but the split that caused it is paid`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GROUP F — the debt ratchet, four directions.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- F. the debt ratchet --');

/** Does the code deviate from the ruling on this (type, question)? */
function deviates(type: SessionTypeId, question: CharterQuestion): boolean {
  const row = SESSION_TYPE_CHARTER[type];
  switch (question) {
    case 'chooser': {
      const notBuilt = (row.chosenBy.otherDoor ?? '').includes('NOT BUILT');
      const missing = row.chosenBy.categories.some(
        (category) => !PLAN_CHANGE_CATEGORY_IDS.includes(category),
      );
      return notBuilt || missing;
    }
    case 'counting': {
      const seen = OBSERVED_COUNTING[type];
      if (seen.countsTowardLoad === null) return true;
      return seen.countsTowardLoad !== row.counting.countsTowardLoad ||
        seen.canBeHardDay !== row.counting.canBeHardDay ||
        seen.required !== row.counting.required;
    }
    case 'placement': {
      // THE ACCESSORY SPECIAL CASE IS GONE. It read "while ONE category covers both,
      // neither type's placement can be attributed however many programs are
      // generated" and returned `true` unconditionally. The split made that false, so
      // both types fall through to the ordinary observation below — and E4 asserts the
      // split itself, so a return to one category fails there rather than silently
      // re-enabling a special case here.
      if (!ACCESSORY_TYPES_SPLIT && (type === 'prehab' || type === 'gunshow')) return true;
      // Mobility has no door and no builder, so nothing can place it at all.
      if (type === 'mobility') return true;
      const claimsGenerator = row.placedBy.includes('generator');
      if (claimsGenerator) return !placedTypes.has(type);
      return placedTypes.has(type);
    }
    case 'composition': {
      const untraced = UNTRACED[type];
      if (untraced === null) return true;
      if (untraced.length > 0) return true;
      const ruled = row.composition.sessionVariants;
      return ruled !== null && registryVariants(type) !== ruled;
    }
  }
}

const observedDeviations: Array<{ type: SessionTypeId; question: CharterQuestion }> = [];
for (const type of SESSION_TYPE_IDS) {
  for (const question of CHARTER_QUESTIONS) {
    if (deviates(type, question)) observedDeviations.push({ type, question });
  }
}

run('F1. every declared debt is still real', () => {
  // STALE DEBT IS HOW A RATCHET STOPS RATCHETING. An entry whose deviation has
  // been fixed keeps excusing a cell that no longer needs excusing, so the next
  // regression in that cell passes silently.
  const stale = CHARTER_DEBT.filter((entry) => !observedDeviations.some(
    (deviation) => deviation.type === entry.type && deviation.question === entry.question,
  ));
  assert(stale.length === 0,
    `these debts are PAID and still declared — delete them and lower the ceiling in `
    + `the same commit:\n      ${stale.map((e) => `${e.type}/${e.question}`).join('\n      ')}`);
});

run('F2. every observed deviation is declared', () => {
  const undeclared = observedDeviations.filter(
    (deviation) => !charterDebtCovers(deviation.type, deviation.question),
  );
  assert(undeclared.length === 0,
    `the code deviates from the charter here and nothing says so:\n      `
    + undeclared.map((d) => `${d.type}/${d.question}`).join('\n      '));
});

run('F3. every debt entry names the stage that pays it', () => {
  for (const entry of CHARTER_DEBT) {
    assert(entry.paidBy.trim().length > 0,
      `${entry.type}/${entry.question} declares no payer — debt with no payer is a `
      + 'permanent exception wearing a temporary word');
    assert(entry.deviation.trim().length > 10,
      `${entry.type}/${entry.question} does not say what the code does instead`);
  }
});

run('F4. per-type ceilings hold with EQUALITY', () => {
  // NOT a budget. A budget lets one type spend another's savings, and then the
  // total stays flat while a regression lands. Equality means paying a debt
  // REQUIRES lowering the ceiling in the same commit — visible in the diff.
  for (const type of SESSION_TYPE_IDS) {
    const actual = charterDebtFor(type).length;
    const ceiling = CHARTER_DEBT_CEILING[type];
    assert(actual === ceiling,
      `"${type}" declares ${actual} debts against a ceiling of ${ceiling}. `
      + (actual < ceiling
        ? 'Lower the ceiling — a ceiling with slack is where the next regression hides.'
        : 'Raising a ceiling is Sam\'s call, and it belongs in its own diff.'));
  }
});

run('F5. no (type, question) is declared twice', () => {
  const seen = new Set<string>();
  for (const entry of CHARTER_DEBT) {
    const key = `${entry.type}/${entry.question}`;
    assert(!seen.has(key), `${key} is declared twice — the ceiling would count it twice`);
    seen.add(key);
  }
});

console.log(`\nSession type charter totals: ${passed} passed, ${failed} failed`);
console.log(`  declared debt: ${CHARTER_DEBT.length} across ${SESSION_TYPE_IDS.length} types`);
console.log(`  observed deviations: ${observedDeviations.length}`);
console.log('  DEPTH (L13): 1-2 — generate, then evaluate single-session weeks. The');
console.log('  charter\'s claims are about VOCABULARY, which does not accumulate with');
console.log('  the length of an athlete\'s life. Whether a long-lived, many-times-edited');
console.log('  week still answers the same way is NOT covered.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
