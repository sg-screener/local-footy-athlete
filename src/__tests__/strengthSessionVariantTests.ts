/**
 * THE SEVEN STRENGTH SESSIONS — one authored set, bound to every consumer.
 *
 * Sam's charter ruling, 2026-07-30: the generator's strength vocabulary is SEVEN
 * variants and the athlete's picker is THREE doors that resolve to them.
 *
 * WHAT WENT WRONG WITHOUT THIS GATE, because it is the reason the shape matters
 * more than the count. The seven already existed — `canonicalStrengthLabel` had
 * a name for each and the generator built each every week. The coach revision
 * registry listed FOUR. Nothing failed: the athlete's Lower Body door simply
 * handed back combined squat+hinge forever, and Lower Squat and Lower Hinge were
 * unreachable through any door in the app. Two representations of one decision,
 * neither able to see the other, and no assertion anywhere that they agreed.
 *
 * So this suite binds the set to its consumers in BOTH directions:
 *
 *   set -> naming      every variant's label is what the naming owner returns
 *                      for its patterns
 *   naming -> set      every name the naming owner can produce is a variant
 *   set -> registry    every variant has a template that BUILDS
 *   registry -> set    every strength template is a variant
 *   set -> doors       the three doors partition the seven, none empty
 *   doors -> set       every door offers only variants
 *   set -> generator   every strength session the generator places is one of
 *                      the seven, observed by GENERATING
 *
 * The last one is the claim that matters and the only one a document could not
 * make. It is also the one that would have caught the original gap from the
 * other side: a generator producing a session no door can reach.
 *
 * DEPTH (L13): 1-2 — generate, then build each template once. A vocabulary does
 * not accumulate with the length of an athlete's life; what a long life would
 * test is whether a well-worn week still names its sessions the same way, and
 * that is recorded as not covered.
 *
 * Run: npm run test:strength-variants
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
import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  STRENGTH_DOOR_IDS,
  STRENGTH_SESSION_VARIANTS,
  strengthVariantByTemplateId,
  strengthVariantForPatterns,
  strengthVariantsForDoor,
  type StrengthDoorId,
  type StrengthSessionVariant,
} from '../data/strengthSessionVariants';
import { pickTemplateForCategory } from '../utils/planChangeProducer';
import { canonicalStrengthLabel } from '../utils/sessionNaming';
import {
  buildCoachRevisionTemplateWorkout,
  listCoachRevisionTemplates,
} from '../utils/coachRevisionTemplates';
import { samExport8Profile } from './support/samDeviceExport8Fixture';

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

console.log('\n-- The seven strength sessions --');

// ──────────────────────────────────────────────────────────────────────────
// A. The set itself.
// ──────────────────────────────────────────────────────────────────────────

run('A1. there are exactly seven, and every id and templateId is unique', () => {
  assert(STRENGTH_SESSION_VARIANTS.length === 7,
    `${STRENGTH_SESSION_VARIANTS.length} strength variants, and Sam ruled seven`);
  const ids = new Set(STRENGTH_SESSION_VARIANTS.map((v) => v.id));
  const templateIds = new Set(STRENGTH_SESSION_VARIANTS.map((v) => v.templateId));
  const labels = new Set(STRENGTH_SESSION_VARIANTS.map((v) => v.label));
  assert(ids.size === 7, 'two variants share an id');
  assert(templateIds.size === 7, 'two variants share a templateId');
  assert(labels.size === 7, 'two variants share an athlete-facing name');
});

run('A2. every variant is internally coherent', () => {
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    assert(variant.plannedPatterns.length > 0, `${variant.id} plans no patterns`);
    assert(variant.plannedPatterns.includes(variant.primaryPattern),
      `${variant.id} leads with ${variant.primaryPattern}, which it does not plan`);
    const lower = variant.plannedPatterns.some((p) => p === 'squat' || p === 'hinge');
    const upper = variant.plannedPatterns.some((p) => p === 'push' || p === 'pull');
    const expected = lower && upper ? 'full_body' : lower ? 'lower' : 'upper';
    assert(variant.archetype === expected,
      `${variant.id} is archetype "${variant.archetype}" but plans ${variant.plannedPatterns.join('+')}`);
    assert(variant.description.trim().length > 0, `${variant.id} has no description`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// B. The naming owner, both directions.
// ──────────────────────────────────────────────────────────────────────────

run('B1. the naming owner returns each variant\'s own label for its patterns', () => {
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    const named = canonicalStrengthLabel([...variant.plannedPatterns] as never);
    assert(named === variant.label,
      `${variant.id} plans ${variant.plannedPatterns.join('+')} and the naming owner `
      + `calls that "${named}", not "${variant.label}"`);
  }
});

run('B2. every name the naming owner can produce is one of the seven', () => {
  // THE OTHER DIRECTION, and the one that would have caught the original gap:
  // a session the app can NAME but no door can reach. Swept over the whole
  // pattern space rather than the seven combinations the set already lists, so
  // an eighth name cannot appear without a red cell.
  const patterns = ['squat', 'hinge', 'push', 'pull'] as const;
  const labels = new Set(STRENGTH_SESSION_VARIANTS.map((v) => v.label));
  for (let mask = 1; mask < 16; mask += 1) {
    const subset = patterns.filter((_, index) => (mask & (1 << index)) !== 0);
    const named = canonicalStrengthLabel([...subset] as never);
    assert(named !== null, `the naming owner has no name for ${subset.join('+')}`);
    assert(labels.has(named),
      `${subset.join('+')} is named "${named}", which is not one of the seven`);
    assert(strengthVariantForPatterns(subset)?.label === named,
      `the set and the naming owner disagree about ${subset.join('+')}`);
  }
  assert(canonicalStrengthLabel([] as never) === null,
    'a session with no strength patterns was given a strength name');
});

run('B3. the seven names are PINNED, because collapsing the duplicate made B1 circular', () => {
  // FOUND BY MUTATION-TESTING THIS SUITE, and worth the words.
  //
  // B1 used to compare two independent representations, so renaming a session
  // failed it. Removing the duplicate — correct, and what the north star asks —
  // made B1 compare the set to itself: a mutation renaming "Lower Hinge" to
  // "Posterior Chain" passed all fourteen cells. De-duplication un-gated the
  // very values it tidied, which is the hazard AGENTS.md names, arriving through
  // the front door of a correct refactor.
  //
  // These seven strings are ATHLETE-VISIBLE and were all shipping before the
  // authored set existed, so this pins the status quo rather than inventing
  // wording. They go to Sam for explicit signing with the rest of the copy
  // (stage 5); until then, changing one is a deliberate red cell and not a
  // rename that nothing notices.
  const SIGNED_NAMES: Readonly<Record<string, string>> = {
    lower_squat: 'Lower Squat',
    lower_hinge: 'Lower Hinge',
    lower_combined: 'Lower Body Strength',
    upper_push: 'Upper Push',
    upper_pull: 'Upper Pull',
    upper_combined: 'Upper Body Strength',
    full_body: 'Full Body Strength',
  };
  assert(Object.keys(SIGNED_NAMES).length === STRENGTH_SESSION_VARIANTS.length,
    'the pin and the set disagree about how many sessions there are');
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    assert(SIGNED_NAMES[variant.id] === variant.label,
      `"${variant.id}" is named "${variant.label}"; the athlete has been reading `
      + `"${SIGNED_NAMES[variant.id]}". Renaming a session is Sam's to sign — see `
      + 'docs/COPY_SHEET_RULINGS_2026-07-30.md.');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// C. The registry, both directions — and every template must BUILD.
// ──────────────────────────────────────────────────────────────────────────

const strengthTemplates = listCoachRevisionTemplates().filter((t) => t.category === 'strength');

run('C1. the registry offers exactly the seven', () => {
  assert(strengthTemplates.length === 7,
    `the registry offers ${strengthTemplates.length} strength templates, not 7: `
    + `${strengthTemplates.map((t) => t.templateId).join(', ')}`);
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    const template = strengthTemplates.find((t) => t.templateId === variant.templateId);
    assert(template, `${variant.id} has no registry template`);
    assert(template.label === variant.label,
      `${variant.id} is "${variant.label}" in the set and "${template.label}" in the registry`);
  }
});

run('C2. every strength template traces back to a variant', () => {
  for (const template of strengthTemplates) {
    assert(strengthVariantByTemplateId(template.templateId),
      `registry template "${template.templateId}" is not one of the seven`);
  }
});

run('C3. every one of the seven BUILDS a real session', () => {
  // Not "is listed" — is BUILDABLE. A template the picker offers and the builder
  // returns null for is a door that fails at the moment the athlete taps it,
  // which is precisely the class of defect the three new variants could
  // introduce if they were listed and nothing else.
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    const workout = quiet(() =>
      buildCoachRevisionTemplateWorkout(variant.templateId, '2026-07-27'));
    assert(workout, `${variant.id} ("${variant.label}") builds nothing`);
    assert((workout.exercises ?? []).length > 0,
      `${variant.id} builds a session with no exercises`);
  }
});

run('C4. what each variant builds carries the patterns it promised', () => {
  // The set is a PROMISE about content, so the built session has to keep it.
  // Without this, a variant could be renamed into existence and prescribe
  // whatever the engine felt like.
  for (const variant of STRENGTH_SESSION_VARIANTS) {
    const workout = quiet(() =>
      buildCoachRevisionTemplateWorkout(variant.templateId, '2026-07-27'));
    assert(workout, `${variant.id} builds nothing`);
    const planned = workout.strengthIntent?.plannedPatterns ?? [];
    for (const pattern of variant.plannedPatterns) {
      assert(planned.includes(pattern),
        `${variant.id} promises ${pattern} and its built session plans ${planned.join('+') || 'nothing'}`);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D. The three doors are a PARTITION.
// ──────────────────────────────────────────────────────────────────────────

run('D1. the three doors partition the seven, and none is empty', () => {
  const seen = new Set<string>();
  for (const door of STRENGTH_DOOR_IDS) {
    const variants = strengthVariantsForDoor(door);
    assert(variants.length > 0,
      `"${door}" offers nothing — a door that offers nothing is a promise the app breaks`);
    for (const variant of variants) {
      assert(!seen.has(variant.id), `${variant.id} is behind more than one door`);
      seen.add(variant.id);
    }
  }
  assert(seen.size === 7,
    `${7 - seen.size} variant(s) are behind no door at all: `
    + STRENGTH_SESSION_VARIANTS.filter((v) => !seen.has(v.id)).map((v) => v.id).join(', '));
});

run('D2. Lower Body now reaches all three lower sessions', () => {
  // THE REGRESSION CELL FOR THE ORIGINAL DEFECT. Before the authored set, this
  // door matched one templateId and the athlete could never be handed Lower
  // Squat or Lower Hinge, though the generator builds both.
  const lower = strengthVariantsForDoor('strength_lower').map((v) => v.id).sort();
  assert(JSON.stringify(lower) === JSON.stringify(['lower_combined', 'lower_hinge', 'lower_squat']),
    `Lower Body offers ${JSON.stringify(lower)}`);
  const upper = strengthVariantsForDoor('strength_upper').map((v) => v.id).sort();
  assert(JSON.stringify(upper) === JSON.stringify(['upper_combined', 'upper_pull', 'upper_push']),
    `Upper Body offers ${JSON.stringify(upper)}`);
});

run('D3. THE ATHLETE\'S OWN DOOR HANDS BACK ALL SEVEN — driven, not read', () => {
  // R-054's row said "no suite named for the door's coverage of all seven", and
  // it was RIGHT while D1 and D2 sat green above it. Both of those ask
  // `strengthVariantsForDoor`, which is the authored set answering a question
  // about itself: it cannot see the athlete's door at all.
  //
  // Measured, 2026-08-13 (seat `arms`): reverting `CATEGORY_TEMPLATE_MATCH`
  // .strength_lower in `utils/planChangeProducer.ts` to the hand-written
  // `t.templateId === 'strength_lower'` — the exact original defect, the athlete's
  // Lower Body door able to hand back ONE of three — left D1, D2, E2 and every
  // other suite in the repo GREEN. A partition asserted only in the file that
  // declares it is a document, not a gate.
  //
  // So this cell drives `pickTemplateForCategory`, the function the athlete's tap
  // actually lands on ("Lower body" -> add_category -> resolveTemplatePlanChange
  // -> here), and sweeps dates because the resolution is date-seeded: the claim
  // is REACHABILITY, that some real day hands the athlete each of the seven.
  const reached = new Map<StrengthDoorId, Set<string>>(
    STRENGTH_DOOR_IDS.map((door) => [door, new Set<string>()] as const),
  );
  for (const door of STRENGTH_DOOR_IDS) {
    for (let day = 0; day < 90; day += 1) {
      const date = new Date(Date.UTC(2026, 6, 13) + day * 86_400_000)
        .toISOString().slice(0, 10);
      const template = quiet(() => pickTemplateForCategory({
        category: door,
        date,
        visibleWeek: [],
      }));
      if (template) reached.get(door)!.add(template.templateId);
    }
  }
  for (const door of STRENGTH_DOOR_IDS) {
    const expected = strengthVariantsForDoor(door).map((v) => v.templateId).sort();
    const actual = [...reached.get(door)!].sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected),
      `the "${door}" door hands back ${JSON.stringify(actual)} over 90 days, `
      + `and the seven say it owns ${JSON.stringify(expected)}`);
  }
  const everything = new Set([...reached.values()].flatMap((set) => [...set]));
  assert(everything.size === 7,
    `${7 - everything.size} of the seven cannot be reached through any athlete door: `
    + STRENGTH_SESSION_VARIANTS
      .filter((v) => !everything.has(v.templateId)).map((v) => v.id).join(', '));
});

// ──────────────────────────────────────────────────────────────────────────
// E. The generator, observed by generating.
// ──────────────────────────────────────────────────────────────────────────

const program = quiet(() => generateProgramLocally(samExport8Profile(), {
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

function plannedPatternsOf(workout: Workout): string[] {
  const intent = workout.strengthIntent?.plannedPatterns ?? [];
  if (intent.length > 0) return [...intent];
  return (workout.exercises ?? [])
    .map((row) => row.section18Evidence?.mainStrengthPattern)
    .filter((pattern): pattern is NonNullable<typeof pattern> => !!pattern);
}

const generatedStrength = program.microcycles.flatMap((microcycle) =>
  (microcycle.workouts ?? []).filter((workout) => plannedPatternsOf(workout as Workout).length > 0));

run('E0. the generator placed strength at all', () => {
  assert(generatedStrength.length >= 3,
    `only ${generatedStrength.length} generated strength sessions — too few to observe the vocabulary`);
});

run('E1. every strength session the generator places is one of the seven', () => {
  const strangers: string[] = [];
  for (const workout of generatedStrength) {
    const variant = strengthVariantForPatterns(plannedPatternsOf(workout as Workout));
    if (!variant) strangers.push(`${workout.name} [${plannedPatternsOf(workout as Workout).join('+')}]`);
  }
  assert(strangers.length === 0,
    `the generator placed strength sessions outside the seven: ${strangers.slice(0, 5).join(', ')}`);
});

run('E2. every generated strength session is reachable through a door', () => {
  // The claim the original defect broke, from the generator's side: a session
  // the app builds every week that no athlete door can hand back.
  const unreachable = new Set<string>();
  for (const workout of generatedStrength) {
    const variant = strengthVariantForPatterns(plannedPatternsOf(workout as Workout));
    if (!variant) continue;
    if (!STRENGTH_DOOR_IDS.includes(variant.door)) unreachable.add(variant.id);
  }
  assert(unreachable.size === 0,
    `the generator builds ${Array.from(unreachable).join(', ')} and no door offers them`);
});

run('E3. the generator\'s names are the set\'s names', () => {
  // NON-VACUITY for the whole suite: if the naming owner and the set agreed on
  // an empty intersection, every cell above would still pass. Here the actual
  // generated sessions have to carry the actual authored labels.
  const named = new Set<string>();
  for (const workout of generatedStrength) {
    const variant = strengthVariantForPatterns(plannedPatternsOf(workout as Workout));
    if (variant) named.add(variant.label);
  }
  assert(named.size >= 2,
    `the generated program used ${named.size} distinct strength names — too few to prove anything`);
  for (const label of named) {
    assert(STRENGTH_SESSION_VARIANTS.some((v) => v.label === label),
      `the generator produced "${label}", which is not an authored name`);
  }
});

console.log(`\nStrength session variants: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  seven variants, ${strengthTemplates.length} registry templates, `
  + `${STRENGTH_DOOR_IDS.length} doors, ${generatedStrength.length} generated strength sessions observed`);
console.log('  DEPTH (L13): 1-2 — generate, then build each template once. Whether a');
console.log('  well-worn week still names its sessions the same way is NOT covered.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
