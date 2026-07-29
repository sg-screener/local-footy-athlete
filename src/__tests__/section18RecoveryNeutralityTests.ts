/**
 * RECOVERY COUNTS TOWARD NOTHING — proven, not asserted green.
 *
 * Sam's ruling 3, 2026-07-30: "Not strength, not conditioning, no exposure total,
 * no maximum, no hard-day count. First-class for rendering, menus, and editing;
 * invisible to the load ledger." And: "§18 counting must be proven unchanged by
 * the promotion with explicit tests — the de-dup-un-gates hazard is live here."
 *
 * WHY THIS SUITE EXISTS BEFORE THE PROMOTION, NOT AFTER. "Prove counting
 * unchanged" needs a referent: a baseline captured while recovery is still a
 * FALLBACK in `getSessionComponents` (`if (components.length === 0 &&
 * isRecoveryWorkout(workout))`). Land the promotion first and the only available
 * baseline is the promoted one, which proves nothing. So the ledger's answers are
 * pinned here, now, and the promotion has to reproduce them exactly.
 *
 * THE HAZARD, NAMED. AGENTS.md: "de-duplication can silently un-gate the values it
 * tidies… a gate that reads code rather than behaviour is coupled to the code's
 * SHAPE, and refactoring changes shape by definition." Promoting recovery from a
 * fallback to a first-class part changes what every consumer of
 * `getSessionComponents` sees. A suite that merely ran green afterwards could not
 * distinguish "counting is unchanged" from "counting changed and no assertion was
 * watching". These cells watch the NUMBERS.
 *
 * WHAT THIS SUITE FOUND, BEFORE ANY PROMOTION — the hazard was real. Recovery is
 * NOT neutral today, and the way it counts is precise:
 *
 *     before      trueFullRestDays [0,4,6]  activeRecoveryDays []
 *     +1 recovery trueFullRestDays [4,6]    activeRecoveryDays [0]
 *     +3 recovery trueFullRestDays [4]      activeRecoveryDays [0,6]
 *                 findings ["default_target_miss:full_rest:...:1"]
 *
 * Every LOAD number — strength, conditioning, power, sprint/high-speed, hard days
 * — is byte-identical. What moves is REST: a recovery session converts a true full
 * rest day into an active-recovery day, and enough recovery makes the week miss its
 * full-rest target and raise a finding.
 *
 * OPEN QUESTION FOR SAM, NOT DECIDED HERE. Two of his rulings meet at this line
 * and I will not pick between them:
 *   - Ruling 3: "recovery counts toward NOTHING… invisible to the load ledger."
 *   - The projection ruling: "REST is complete rest", and recovery is a real
 *     session — so a day holding one is arguably not a rest day at all, which
 *     makes the `restStress` movement correct rather than a violation.
 * The part that is hard to read either way is the FINDING: a week that misses
 * `full_rest` because the athlete added recovery is recovery affecting compliance,
 * which reads like counting. Recorded in the boundary report as a ruling owed.
 *
 * SO THE CELLS ARE SCOPED TO WHAT RULING 3 UNAMBIGUOUSLY SAYS — the load domains
 * — and the rest interaction is PINNED AS-IS rather than asserted either way. That
 * is deliberately not the same as loosening: pinning it means the promotion cannot
 * change it silently while the question is open, which is exactly what the
 * un-gating hazard would otherwise do.
 *
 * WHAT IS PINNED — behaviour, never shape:
 *   1. Adding a recovery session to a week moves NO ledger number. Every count,
 *      total and breach is byte-identical before and after.
 *   2. Recovery earns no conditioning credit, no strength credit, no hard day.
 *   3. Removing recovery from a week moves no ledger number either — the
 *      neutrality is symmetric, so a week cannot be made compliant by adding
 *      recovery or non-compliant by removing it.
 *   4. Non-recovery work still counts. Without this the suite would pass on a
 *      build where NOTHING counts.
 *
 * DEPTH (L13): these cells run at depth 2-3 — generate, then add or remove one
 * recovery session. Ledger neutrality is a per-week arithmetic property, so depth
 * is not what would falsify it; a long life is still owed for the promotion's
 * RENDERING claims and is recorded as not covered.
 *
 * Run: npm run test:section18-recovery-neutrality
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
import { PART_COUNTS_TOWARD_LOAD } from '../rules/visibleProjection';
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

const WEEK = '2026-07-27';

function generated(): TrainingProgram {
  localStorageData.clear();
  return quiet(() => generateProgramLocally(samExport8Profile(), {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: { protocolVersion: 1, selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: '2026-07-13', originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state' },
  })) as TrainingProgram;
}

/**
 * THE LEDGER'S ANSWERS, as a comparable value.
 *
 * Deliberately the whole ledger plus every finding code — not a chosen subset.
 * Picking fields would let the promotion move a number nobody thought to compare,
 * which is the un-gating hazard in miniature.
 */
function evaluate(workouts: readonly Workout[], contract: unknown) {
  return quiet(() => evaluateSection18EffectiveWeek({
    contract: contract as never, workouts: workouts as never, weekStart: WEEK,
  }));
}

/**
 * The LOAD domains only — what ruling 3 unambiguously covers.
 *
 * `restStress` is excluded and pinned separately, because whether a recovery day
 * is still a rest day is a ruling Sam owes, not something this suite may assume.
 * Everything else is compared WHOLE — no chosen subset within a domain, or the
 * promotion could move a number nobody thought to name.
 */
function loadFingerprint(workouts: readonly Workout[], contract: unknown): string {
  const evaluation = evaluate(workouts, contract);
  const ledger = evaluation.ledger as unknown as Record<string, unknown>;
  return JSON.stringify({
    mainStrength: ledger.mainStrength,
    strengthPatterns: ledger.strengthPatterns,
    conditioning: ledger.conditioning,
    sprintHighSpeed: ledger.sprintHighSpeed,
    power: ledger.power,
    anchors: ledger.anchors,
    hardDays: (ledger.restStress as { hardDays?: unknown })?.hardDays,
    findings: evaluation.findings
      .filter((f) => f.domain !== 'full_rest')
      .map((f) => `${f.code}:${f.domain}`).sort(),
  });
}

/** The rest interaction, pinned exactly as it behaves today. */
function restFingerprint(workouts: readonly Workout[], contract: unknown): string {
  const ledger = evaluate(workouts, contract).ledger as unknown as Record<string, unknown>;
  return JSON.stringify((ledger.restStress as Record<string, unknown>));
}

/** A recovery session, shaped the way the app's own recovery sessions are. */
function recoverySession(dayOfWeek: number): Workout {
  return {
    id: `neutrality-recovery-${dayOfWeek}`,
    microcycleId: 'neutrality',
    dayOfWeek,
    name: 'Recovery Session',
    description: 'Recovery',
    durationMinutes: 30,
    intensity: 'Light',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [],
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'planner_and_canonical_content',
    },
  } as unknown as Workout;
}

console.log('\n-- Section 18 recovery neutrality (ruling 3, pre-promotion baseline) --');

const program = generated();
const week = program.microcycles.find((m) => m.startDate.slice(0, 10) === WEEK)
  ?? program.microcycles[0];
const contract = week.exposureContractV2;
const base = week.workouts.filter((w) => w.workoutType !== 'Recovery'
  && (w as { sessionTier?: string }).sessionTier !== 'recovery');

run('the fixture is usable — a real contract and real work to count', () => {
  assert(contract, 'the generated week carries no Contract v2 to evaluate against');
  assert(base.length >= 2,
    `only ${base.length} non-recovery sessions in the week — nothing to count, so `
    + 'neutrality would be vacuous');
});

run('adding recovery moves no LOAD number', () => {
  const before = loadFingerprint(base, contract);
  const after = loadFingerprint([...base, recoverySession(0)], contract);
  assert(before === after,
    'adding a recovery session changed the §18 ledger. Recovery counts toward '
    + `nothing (Sam, ruling 3).\n      before ${before}\n      after  ${after}`);
});

run('adding SEVERAL recovery sessions still moves no LOAD number', () => {
  // One could be absorbed by a rounding or a cap. Three cannot be an accident.
  const before = loadFingerprint(base, contract);
  const after = loadFingerprint(
    [...base, recoverySession(0), recoverySession(3), recoverySession(6)],
    contract,
  );
  assert(before === after,
    'three recovery sessions changed the §18 ledger where one did not — a cap or a '
    + `rounding is absorbing recovery rather than ignoring it.\n      before ${before}\n      after  ${after}`);
});

run('removing recovery moves no LOAD number either', () => {
  // Symmetry. Without it a week could be made compliant by ADDING recovery, or
  // non-compliant by removing it, which is a load claim wearing a rest day.
  const withRecovery = [...base, recoverySession(0)];
  assert(loadFingerprint(withRecovery, contract) === loadFingerprint(base, contract),
    'recovery neutrality is not symmetric — removing recovery moved a load number');
});

run('BLOCKED — recovery never breaks rest (ruling 1 vs a prior fix)', () => {
  // SAM RULED IT, I IMPLEMENTED IT, AND IT COLLIDED WITH A DOCUMENTED PRIOR FIX.
  // Reverted pending his call. `section18ContractV2Tests` fails three cells the
  // moment recovery counts toward full rest:
  //   8a. active recovery is excluded from true rest
  //   8b. legacy recovery-as-rest miscount is detected
  //   P5  recovery days can never become full-rest days   <- a PROPERTY
  // and that suite's own comment at :487 reads "8. Recovery workouts WERE reported
  // as full rest" — past tense, i.e. a defect somebody deliberately closed.
  //
  // Reversing a property test against a documented fix, on my reading of a chat
  // message, is the move this repo's laws exist to stop. So the production change
  // is out and this cell asserts TODAY's behaviour with the conflict named, rather
  // than asserting the ruling and going red, or asserting the ruling and flipping
  // three gates to make it green.
  //
  // TO CLOSE: Sam decides whether the prior fix was about a different concern —
  // most likely a week LOOKING compliant on rest because recovery inflated the
  // count — in which case the two can coexist by separating "the athlete rested"
  // from "the contract's rest target was met". See
  // docs/RECOVERY_DAY_PROVENANCE_TRACE_2026-07-30.md.
  const plainToday = JSON.parse(restFingerprint(base, contract)) as { trueFullRestDays: number[] };
  const withOneToday = JSON.parse(restFingerprint([...base, recoverySession(0)], contract)) as {
    trueFullRestDays: number[]; activeRecoveryDays: number[];
  };
  assert(JSON.stringify(withOneToday.trueFullRestDays) !== JSON.stringify(plainToday.trueFullRestDays),
    'recovery now counts toward full rest. If that is the resolution Sam chose, '
    + 'update this cell AND section18ContractV2Tests 8a/8b/P5 together, citing his '
    + 'ruling — never one without the others.');
  assert(withOneToday.activeRecoveryDays.includes(0),
    'the recovery session is no longer reported as active recovery');
});

run('RECORDED, pending ruling — what recovery does to the full-rest finding', () => {
  // The failure the baseline caught: at three, the week missed its full-rest target
  // and raised `default_target_miss:full_rest`. Under the ruling it must not.
  const evaluation = evaluate(
    [...base, recoverySession(0), recoverySession(3), recoverySession(6)],
    contract,
  );
  const restFindings = evaluation.findings.filter((f) => f.domain === 'full_rest');
  // Recorded, not asserted, while the conflict above is open. Today's answer is
  // that recovery DOES raise this finding; that is the exact cost of the conflict
  // and it is what Sam is ruling on.
  console.log(`      today: full_rest findings with 3 recovery sessions = `
    + `${JSON.stringify(restFindings.map((f) => f.code))}`);
  assert(true, 'recorded');
});

run('non-recovery work still counts', () => {
  // NON-VACUITY, and the cell that matters most. Every assertion above would pass
  // on a build where the ledger counted nothing at all.
  const fewer = base.slice(0, base.length - 1);
  assert(loadFingerprint(base, contract) !== loadFingerprint(fewer, contract),
    'removing a real session did not move the §18 ledger — the ledger is not '
    + 'counting, so recovery neutrality is meaningless');
});

run('the projection agrees with the ledger about what counts', () => {
  // The two owners of "does this count" must not drift: `PART_COUNTS_TOWARD_LOAD`
  // is what surfaces and the projection read, the evaluator is what the Bible
  // reads, and a disagreement between them is two representations of one ruling.
  assert(PART_COUNTS_TOWARD_LOAD.recovery === false,
    'the projection thinks recovery counts toward load');
  for (const kind of ['strength', 'conditioning', 'power', 'speed'] as const) {
    assert(PART_COUNTS_TOWARD_LOAD[kind] === true,
      `the projection stopped counting ${kind} — ruling 3 was about recovery only`);
  }
});

console.log(`\nSection 18 recovery neutrality totals: ${passed} passed, ${failed} failed`);
console.log('  DEPTH (L13): 2-3 — generate, then add/remove recovery. Ledger');
console.log('  neutrality is per-week arithmetic; the promotion\'s RENDERING claims');
console.log('  still owe a long-life walk and are recorded as not covered.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
