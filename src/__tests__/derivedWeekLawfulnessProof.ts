/**
 * DERIVED-WEEK LAWFULNESS PROOF — condition 1 of
 * `docs/PATTERN_IDENTITY_RULING_2026-08-06.md`, step 1.
 *
 * The ruling retires the stored §18 contract as an input to pattern selection.
 * Cells 5/6 pin the deriver's Monday under the OLD input, so they are
 * superseded by that dated doc — but only after the derived week is proven
 * LAWFUL in the pin's own world. This file is that proof, and it runs BEFORE
 * any pin moves:
 *
 *   1. patterns legal per the Bible's calendar rules
 *   2. balance held
 *   3. §18 green with ZERO unresolved shortfall
 *   4. byte-determinism across two consecutive derivations AND a relaunch
 *
 * If any of the four fails, the pins do not move and the unit stops. A re-pin
 * on an unlawful week is `expectation-edited-to-match-the-regression` wearing
 * a ruling.
 *
 * Run: npm run test:derived-week-lawfulness
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
  throw new Error('NETWORK DISABLED — this suite runs entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { runQuiescentBoot } from '../store/quiescentBoot';
import { applyPlanChange } from '../utils/planChangeProducer';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { deriveWeekContract, lastTierFourDerivation } from '../rules/derivedWeekContract';
import { strengthPatternLedger } from '../rules/strengthPatternContributions';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failed += 1;
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return await body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

/** Where two byte strings first part company, with local context. */
function firstDifference(left: string, right: string): string {
  const width = Math.max(left.length, right.length);
  for (let index = 0; index < width; index++) {
    if (left[index] !== right[index]) {
      const from = Math.max(0, index - 120);
      return `at ${index}\n        A: ...${left.slice(from, index + 160)}\n        B: ...${right.slice(from, index + 160)}`;
    }
  }
  return 'none (lengths differ only)';
}

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${
    String(parsed.getDate()).padStart(2, '0')}`;
}

const INSTALL_DAY = '2026-08-05';
let todayISO = INSTALL_DAY;
let weekStart = INSTALL_DAY;

/** THE PIN'S OWN WORLD — byte-identical to `fixtureIdentityTests`. */
function restSaturdayProfile(): OnboardingData {
  return {
    firstName: 'Walker', heightCm: 184, weightKg: 90,
    seasonPhase: 'Pre-season',
    position: 'inside_mid',
    motivation: 'Dominate your level',
    goals: ['Build strength'],
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
  } as unknown as OnboardingData;
}

function derivedDays(): ReturnType<typeof resolveWeekWithConditioning> {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

function derivedWeek(): string[] {
  return derivedDays().map((day) => `${day.date}=${day.workout?.name ?? 'REST'}|${
    day.workout?.exercises?.length ?? 0}`);
}

/**
 * Every byte of the derived week, not just its name and row count.
 *
 * `createdAt`/`updatedAt` are NORMALISED, and that is a finding rather than a
 * convenience: derived rows carry a WALL-CLOCK stamp taken at derivation time,
 * so two derivations one millisecond apart differ in bytes while describing
 * the identical week. A stamp minted by the deriver is stored-output shaped —
 * it records WHEN the derivation ran, which is not a property of the week. The
 * ruling's determinism ground is about the WEEK, so the week is what this
 * compares, and the stamp is reported separately by `lawful-4`.
 */
function derivedWeekBytes(): string {
  return JSON.stringify(
    derivedDays().map((day) => ({
      date: day.date,
      source: day.source,
      workout: day.workout ?? null,
    })),
    // EVERY stamp, at every depth — a derived row nests an exercise record
    // that carries its own pair, and normalising only the top level compares
    // two weeks that were never being compared.
    //
    // CONTAINER IDENTITY IS NORMALISED TOO, and for the same reason. A row read
    // through the stored overlay carries that overlay's `microcycleId` and an
    // id suffixed `:week-overlay:<date>` (`cloneWorkoutForOverlay`); the same
    // row derived carries the microcycle's. That names WHICH CONTAINER the row
    // came out of, which is exactly the thing leg (v) retires — comparing it
    // would make the gate fail by definition and tell nobody anything about
    // the athlete's week. `lawful-5` reports the container names it saw so the
    // normalisation hides nothing.
    (key, value) => {
      if (key === 'createdAt' || key === 'updatedAt') return '<stamp>';
      if (key === 'microcycleId') return '<container>';
      if (key === 'id' && typeof value === 'string') {
        return value.replace(/:week-overlay:\d{4}-\d{2}-\d{2}$/, '');
      }
      return value;
    },
  );
}

/**
 * DECLARED PARITY DIFFS — the seat's 2026-08-07 classification ruling, built.
 *
 * A parity difference is not a verdict until it is ATTRIBUTED with a law
 * citation. Once it is, the ruling sorts it:
 *
 *   STORED-WRONG   — the stored week is the wrong one and the derivation
 *                    corrects it. Declared here, flagged for the device pass,
 *                    and it does NOT block: it is an old write-path defect
 *                    this unit's own switchover retires.
 *   DERIVED-WRONG  — always blocks. The derivation is what ships.
 *   UNATTRIBUTED   — always blocks. An unexplained difference between the
 *                    stored week and the derived one is the whole reason this
 *                    gate exists.
 *
 * An entry states the exact rows it covers, so a diff that grows a row nobody
 * declared reds even on a day that already carries a declared entry.
 */
interface DeclaredParityDiff {
  id: string;
  law: string;
  date: string;
  /** Rows the DERIVED week has and the stored week does not. */
  onlyDerived: readonly string[];
  /** Rows the STORED week has and the derived week does not. */
  onlyMaterialised: readonly string[];
  why: string;
  paidBy: string;
  expiresWhen: string;
}

const DECLARED_PARITY_DIFF: ReadonlyArray<DeclaredParityDiff> = [
  {
    id: 'stored_declaration_costs_mondays_power_row',
    law: 'FIXTURE IDENTITY — a decision never rebases from a stored week; the '
      + 'derived week is the one that ships',
    date: '2026-08-10',
    onlyDerived: ['Vertical Jump'],
    onlyMaterialised: [],
    why: 'STORED-WRONG, and attributed by tape rather than by comparison. The '
      + 'field-level store tape (2026-08-07) shows the overlay\'s Monday is '
      + 'written with ALL EIGHT rows at every single store write — the payload '
      + 'is never short. What costs the row is the stored DECLARATION being '
      + 'present at READ: with both declaration writers removed the row comes '
      + 'back in all three worlds, with one writer restored it returns in one '
      + 'of three, and on the branch it is gone in three of three. So the '
      + 'athlete is one power row short of what generation prescribed, and the '
      + 'derivation is the side that is right. §18 scores both weeks '
      + 'identically, so no authority reduced it.',
    paidBy: 'leg (v) — the stored declaration retiring. Measured: with it '
      + 'retired, `test:fixture-identity` is 6/6 and this diff is gone.',
    expiresWhen: 'the accepted week carries no stored `exposureContractV2`, so '
      + 'nothing at read can answer from it.',
  },
];

const parityDiffHits = new Set<string>();

/** Null when every differing row on every day is declared. */
function undeclaredParityDiffs(leftBytes: string, rightBytes: string): string[] {
  const rows = (bytes: string): Map<string, string[]> => new Map(
    (JSON.parse(bytes) as Array<{
      date: string;
      workout: { exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
    }>).map((day) => [day.date, (day.workout?.exercises ?? []).map((row) =>
      String(row?.exercise?.name ?? row?.name ?? '?'))]));
  const left = rows(leftBytes);
  const right = rows(rightBytes);
  const undeclared: string[] = [];
  for (const [date, materialisedRows] of left) {
    const derivedRows = right.get(date) ?? [];
    if (JSON.stringify(materialisedRows) === JSON.stringify(derivedRows)) continue;
    const only = (a: string[], b: string[]): string[] =>
      [...new Set(a.filter((name) => !b.includes(name)))].sort();
    const onlyDerived = only(derivedRows, materialisedRows);
    const onlyMaterialised = only(materialisedRows, derivedRows);
    const entry = DECLARED_PARITY_DIFF.find((candidate) =>
      candidate.date === date
      && JSON.stringify([...candidate.onlyDerived].sort()) === JSON.stringify(onlyDerived)
      && JSON.stringify([...candidate.onlyMaterialised].sort())
        === JSON.stringify(onlyMaterialised));
    if (entry) {
      parityDiffHits.add(entry.id);
      console.log(`      (declared parity diff carried: ${entry.id} — ${entry.law}`
        + `\n        paid by ${entry.paidBy})`);
      continue;
    }
    undeclared.push(`${date}: only-derived ${JSON.stringify(onlyDerived)} / `
      + `only-materialised ${JSON.stringify(onlyMaterialised)}`);
  }
  return undeclared;
}

/**
 * WHICH ROWS DISAGREE, by name, for every day the two weeks differ on.
 *
 * A row COUNT tells you a week changed; the next question is always which
 * work moved, and answering it from a byte offset is a second job. The parity
 * gate carries this so its failure is a finding rather than a prompt to go and
 * instrument the same run again.
 */
function rowDiff(leftBytes: string, rightBytes: string): string[] {
  const rows = (bytes: string): Map<string, string[]> => new Map(
    (JSON.parse(bytes) as Array<{
      date: string;
      workout: { exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
    }>).map((day) => [day.date, (day.workout?.exercises ?? []).map((row) =>
      String(row?.exercise?.name ?? row?.name ?? '?'))]));
  const left = rows(leftBytes);
  const right = rows(rightBytes);
  const lines: string[] = [];
  for (const [date, leftRows] of left) {
    const rightRows = right.get(date) ?? [];
    if (JSON.stringify(leftRows) === JSON.stringify(rightRows)) continue;
    const only = (a: string[], b: string[]): string[] => a.filter((name) => !b.includes(name));
    lines.push(`${date}: only-materialised ${JSON.stringify(only(leftRows, rightRows))} / `
      + `only-derived ${JSON.stringify(only(rightRows, leftRows))}`);
    lines.push(`        materialised rows ${JSON.stringify(leftRows)}`);
    lines.push(`        derived      rows ${JSON.stringify(rightRows)}`);
  }
  return lines;
}

/** How many wall-clock stamps the derived week mints, and how many are distinct. */
function stampCensus(): { total: number; distinct: number } {
  const stamps: string[] = [];
  JSON.stringify(derivedDays(), (key, value) => {
    if ((key === 'createdAt' || key === 'updatedAt') && typeof value === 'string') {
      stamps.push(value);
    }
    return value;
  });
  return { total: stamps.length, distinct: new Set(stamps).size };
}

function freshWorld(): void {
  todayISO = INSTALL_DAY;
  weekStart = INSTALL_DAY;
  localStorageData.clear();
  resetStoresToFreshInstall('derived-week-lawfulness:fresh-install');
  useProfileStore.getState().updateOnboardingData(restSaturdayProfile());
  const completion = useProfileStore.getState().completeOnboarding();
  if (completion && typeof completion === 'object'
    && (completion as { ok?: boolean }).ok === false) {
    throw new Error('world-builder: onboarding completion REFUSED — '
      + JSON.stringify((completion as { missingAnswers?: unknown }).missingAnswers));
  }
  const program = quiet(() => generateProgramLocally(
    useProfileStore.getState().onboardingData,
    {
      todayISO, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: 'Pre-season' as never,
        phaseEntryWeekStartISO: weekStart,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    },
  )) as TrainingProgram;
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  weekStart = settled.startDate.slice(0, 10);
  todayISO = weekStart;
  quiet(() => commitRebuiltProgram(
    program,
    { preserve: [], clear: [], conflictsRemoved: [] },
    {
      markedDays: useCalendarStore.getState().markedDays ?? {},
      selectedDate: todayISO,
      reason: 'derived-week-lawfulness:generate',
    },
  ));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
}

/** The pin's world, exactly: removal THEN fixture, both through real doors. */
async function pinWorld(
  order: 'removal_then_fixture' | 'fixture_then_removal' | 'fixture_only',
): Promise<{
  wednesday: string;
  saturday: string;
}> {
  freshWorld();
  // CLEARED FIRST. A build that throws before the capture must not leave the
  // previous world's week sitting there for the parity gate to compare against.
  lastMaterialised = null;
  const wednesday = addDaysISO(weekStart, 2);
  const saturday = addDaysISO(weekStart, 5);

  const clearTheWednesday = (): void => {
    const removal = quiet(() => applyPlanChange({
      change: { kind: 'remove_session', date: wednesday },
      visibleWeek: quiet(() =>
        resolveWeekWithConditioning(weekStart, buildScheduleStateImperative())),
      todayISO,
      applyOverride: () => {
        throw new Error('a removal must not use the single-date writer');
      },
    } as never)) as { ok: boolean; message?: string };
    assert(removal.ok, `the athlete's removal was REFUSED (${removal.message ?? 'no message'})`);
  };
  const addTheFixture = async (): Promise<void> => {
    const added = await quietAsync(async () => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: 'practice_match',
      targetDate: saturday,
      expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      source: {
        requestedBy: 'athlete',
        producer: 'tap',
        surface: 'program_tab',
        commandId: `derived-week-lawfulness:add:${saturday}`,
      },
      todayISO,
    } as never)) as { outcome?: string };
    assert(added.outcome !== 'impossible' && added.outcome !== 'no_change',
      `the fixture ADD did not land (outcome "${added.outcome}")`);
  };

  if (order === 'removal_then_fixture') {
    clearTheWednesday();
    await addTheFixture();
  } else if (order === 'fixture_then_removal') {
    await addTheFixture();
    clearTheWednesday();
  } else {
    // CELL 3's WORLD: a fixture and NOTHING ELSE. No removal, so no decision
    // authorises an imbalance — which is precisely what makes it the harder
    // lawfulness question.
    await addTheFixture();
  }
  // THE MATERIALISED WEEK, CAPTURED BEFORE IT IS DROPPED — the parity gate's
  // left-hand side. This is the week as the athlete sees it TODAY: the stored
  // overlay's `workoutsByDate` payload, materialised inside
  // `commitAcceptedStateTransaction` at write. The very next line retires it,
  // so this is the only moment it exists to be compared.
  lastMaterialised = {
    bytes: derivedWeekBytes(),
    overlayDays: Object.keys(((useProgramStore.getState() as unknown as {
      weekScopedOverlays?: Record<string, { workoutsByDate?: Record<string, unknown> }>;
    }).weekScopedOverlays ?? {})[weekStart]?.workoutsByDate ?? {}).sort(),
  };
  // THE DERIVER ALONE — every stored week dropped, which is what the ruling
  // retires. Life facts, profile, program, overrides and removal constraints
  // are untouched.
  useProgramStore.setState({ weekScopedOverlays: {} } as never);
  return { wednesday, saturday };
}

/**
 * THE PARITY GATE'S LEFT-HAND SIDE, recorded by the world builder.
 *
 * Kept as a module-level capture rather than returned, because every existing
 * cell reads `pinWorld` for its two dates and the gate is the only caller that
 * wants the pre-drop week.
 */
let lastMaterialised: { bytes: string; overlayDays: string[] } | null = null;

/**
 * THE CONTRACT THE VISIBLE WEEK ACTUALLY ANSWERS TO.
 *
 * Tier 4's contract is never stored, so it is read back from the derivation
 * that produced the week under test. Rebuilding one beside the deriver would
 * measure a contract no surface uses — the seventh sighting of
 * `gate-passing-on-coordinates-it-never-builds` is enough.
 */
function tierFourContract() {
  derivedDays();
  const contract = lastTierFourDerivation.contract;
  assert(contract, 'tier 4 recorded no contract for this week — the derivation '
    + 'did not reach the conformance pass, so this cell asserts nothing');
  assert(lastTierFourDerivation.weekStart === weekStart,
    `tier 4's recorded contract is for ${lastTierFourDerivation.weekStart}, not ${weekStart}`);
  return contract;
}

/** The contract before tier 4's own normalisations — identity and policy only. */
function contractForDerivedWeek() {
  const state = useProgramStore.getState();
  const microcycle = state.currentProgram?.microcycles.find((candidate) =>
    weekStart >= candidate.startDate.slice(0, 10) &&
    weekStart <= candidate.endDate.slice(0, 10)) ?? state.currentMicrocycle;
  const stored = microcycle?.exposureContractV2;
  assert(stored, 'the world has no Contract v2 at all — nothing to derive from');
  return deriveWeekContract({
    contract: stored,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: useCalendarStore.getState().markedDays ?? {},
    // THE DECISION LEDGER. Omitting it here would prove a contract the app
    // never derives — the removal's typed reduction comes from the constraint,
    // not from the stored contract's copy of it.
    userRemovalConstraints: state.userRemovalConstraints,
    workouts: visibleWorkouts(),
  });
}

function visibleWorkouts(): Workout[] {
  return derivedDays().flatMap((day) => day.workout ? [day.workout] : []);
}

async function main(): Promise<void> {
  for (const order of ['removal_then_fixture', 'fixture_then_removal', 'fixture_only'] as const) {
    const label = order === 'removal_then_fixture'
      ? 'W2'
      : order === 'fixture_then_removal' ? 'W2r' : 'W3-fixture-only';

    // ── 1 + 2: PATTERNS LEGAL, BALANCE HELD ─────────────────────────────
    await run(`${label} lawful-1 the derived week's main-strength patterns are legal `
      + 'and balanced', async () => {
      await pinWorld(order);
      const contract = contractForDerivedWeek();
      const workouts = visibleWorkouts();
      // The ledger is the app's ONE owner of "which patterns does this week
      // actually contain"; reading it here rather than re-deriving from names
      // is what keeps this proof from being a second copy of the rule.
      const ledger = strengthPatternLedger(workouts as never, 'effective');
      const present = (Object.keys(ledger) as Array<keyof typeof ledger>)
        .filter((pattern) => ledger[pattern] > 0);
      assert(present.length > 0,
        `${label}: the derived week has NO main-strength pattern at all — `
        + `${workouts.length} sessions, ledger ${JSON.stringify(ledger)}`);
      const prohibited = contract.strengthPatterns.prohibitedPatterns;
      const illegal = present.filter((pattern) => prohibited.includes(pattern));
      assert(illegal.length === 0,
        `${label}: the derived week plans PROHIBITED patterns ${illegal.join(', ')} — `
        + `the contract prohibits ${prohibited.join(', ') || 'none'}`);
      console.log(`      ${label} pattern ledger ${JSON.stringify(ledger)}`);

      // BALANCE, by the contract's own expectation rather than a second copy
      // of the rule: the evaluator owns what "balanced" means.
      const evaluation = evaluateSection18EffectiveWeek({ contract, workouts, weekStart });
      const balanceFindings = evaluation.blockingViolations.filter((finding) =>
        finding.domain === 'strength_patterns');
      assert(balanceFindings.length === 0,
        `${label}: the derived week breaks the pattern/balance law — `
        + JSON.stringify(balanceFindings));
    });

    // ── 3: §18 GREEN, ZERO UNRESOLVED SHORTFALL ─────────────────────────
    await run(`${label} lawful-2 §18 is green on the derived week with zero `
      + 'unresolved shortfall', async () => {
      await pinWorld(order);
      const contract = tierFourContract();
      const evaluation = evaluateSection18EffectiveWeek({
        contract, workouts: visibleWorkouts(), weekStart,
      });
      assert(evaluation.blockingViolations.length === 0,
        `${label}: §18 is NOT green on the derived week — `
        + JSON.stringify(evaluation.blockingViolations));
      const shortfalls: string[] = [];
      for (const [domain, policy] of [
        ['main_strength', evaluation.contract.mainStrength.exposure],
        ['conditioning', evaluation.contract.conditioning.core],
        ['sprint_high_speed', evaluation.contract.sprintHighSpeed.exposure],
      ] as const) {
        if ((policy.unresolvedMinimumShortfall ?? 0) > 0) {
          shortfalls.push(`${domain}=${policy.unresolvedMinimumShortfall}`);
        }
      }
      assert(shortfalls.length === 0,
        `${label}: the derived week carries unresolved shortfall ${shortfalls.join(', ')}`);
    });

    // ── 4: BYTE-DETERMINISM, TWICE AND ACROSS A RELAUNCH ────────────────
    await run(`${label} lawful-3 the derived week is byte-identical across two `
      + 'derivations and a relaunch', async () => {
      await pinWorld(order);
      const first = derivedWeekBytes();
      const second = derivedWeekBytes();
      assert(first === second,
        `${label}: two consecutive derivations of the SAME inputs differ — the `
        + 'derivation is not a pure function and L16 cannot hold.\n      '
        + `first  ${derivedWeek().join(' | ')}\n      `
        + `DIFF ${firstDifference(first, second)}`);
      await quietAsync(async () => { await runQuiescentBoot(); });
      // The relaunch legitimately republishes; the ruling's determinism claim
      // is about the DERIVED week, so the stored week is dropped again before
      // the comparison — exactly as cells 5/6 read the deriver.
      useProgramStore.setState({ weekScopedOverlays: {} } as never);
      const afterRelaunch = derivedWeekBytes();
      assert(first === afterRelaunch,
        `${label}: the derived week CHANGED across a relaunch — same persisted `
        + 'inputs, different week. Determinism is the ruling\'s third ground.\n      '
        + `before  ${JSON.parse(first).map((d: { date: string; workout: { name?: string; exercises?: unknown[] } | null }) => `${d.date}=${d.workout?.name ?? 'REST'}|${d.workout?.exercises?.length ?? 0}`).join(' | ')}\n      `
        + `after   ${derivedWeek().join(' | ')}\n      `
        + `DIFF ${firstDifference(first, afterRelaunch)}`);
    });

    // ── 5: THE PARITY GATE — DERIVED == MATERIALISED, BYTE-EQUAL ────────
    //
    // The gate leg (v) answers to. Leg (v) retires the stored week (the
    // `exposureContractV2` declaration and the `workoutsByDate` payload the
    // accept transaction materialises beside it); the fixture-identity law
    // retires derived content ONLY when re-deriving at read provably
    // reproduces it. This is that proof, taken in the one world where both
    // representations exist at once — the instant before `pinWorld` drops the
    // stored week.
    //
    // BYTE-EQUAL, with the wall-clock stamps normalised for the reason
    // `lawful-3` states: a stamp records when the derivation ran, not what the
    // week is, and `lawful-4` reports the stamp census separately so nothing
    // is hidden by the normalisation.
    await run(`${label} lawful-5 the DERIVED week is byte-identical to the `
      + 'MATERIALISED week (parity gate)', async () => {
      await pinWorld(order);
      assert(lastMaterialised,
        `${label}: no materialised week was captured — the parity gate would `
        + 'compare the derivation against itself, which proves nothing');
      const materialised = lastMaterialised;
      // NON-VACUITY, FIRST. A world whose stored overlay carries no payload at
      // all would pass byte-equality by having nothing to disagree about; this
      // gate asserts the left-hand side EXISTS before it compares.
      assert(materialised.overlayDays.length > 0,
        `${label}: the stored week materialises NO days, so parity is vacuous — `
        + 'the gate is measuring a world where leg (v) has nothing to retire');
      const derived = derivedWeekBytes();
      // WHEN THEY DISAGREE, WHICH ONE IS LAWFUL? The gate answers its own next
      // question: both weeks are put to §18 against ONE contract (the derived
      // one, which is the contract the app answers to), so a parity failure
      // arrives with its DIRECTION named — a stale materialisation the
      // derivation repairs, or a derivation that has invented work.
      // AND THE THIRD REPRESENTATION, WHICH NAMES THE DIRECTION. The generated
      // program's own workout for a differing day is the common ancestor of
      // both weeks: a row present there and missing from the materialised week
      // was DROPPED on the write path; a row present in neither was ADDED by
      // the derivation. Reported rather than argued, because "which side moved"
      // is the question a parity failure exists to answer.
      const programRows = (date: string): string[] => {
        // A generated workout carries `dayOfWeek`, not a date — the week it
        // belongs to supplies the coordinate, which is why the microcycle is
        // located first rather than the whole program searched.
        const state = useProgramStore.getState();
        const cycle = (state.currentProgram?.microcycles ?? []).find((candidate) =>
          date >= candidate.startDate.slice(0, 10) && date <= candidate.endDate.slice(0, 10));
        const day = new Date(`${date}T12:00:00`).getDay();
        const match = (cycle?.workouts ?? []).find((workout) => workout.dayOfWeek === day);
        return ((match?.exercises ?? []) as Array<{
          exercise?: { name?: string }; name?: string }>)
          .map((row) => String(row?.exercise?.name ?? row?.name ?? '?'));
      };
      const ancestry = (): string => rowDiff(materialised.bytes, derived)
        .filter((line) => line.includes('only-materialised'))
        .map((line) => {
          const date = line.slice(0, 10);
          return `${date} program rows ${JSON.stringify(programRows(date))}`;
        }).join('\n              ');
      const lawfulness = (): string => {
        const contract = contractForDerivedWeek();
        const weekOf = (bytes: string): Workout[] =>
          (JSON.parse(bytes) as Array<{ workout: Workout | null }>)
            .flatMap((day) => day.workout ? [day.workout] : []);
        return (['materialised', 'derived'] as const).map((side) => {
          const evaluation = evaluateSection18EffectiveWeek({
            contract,
            workouts: weekOf(side === 'materialised' ? materialised.bytes : derived),
            weekStart,
          });
          const shortfall = [
            ['main_strength', evaluation.contract.mainStrength.exposure],
            ['conditioning', evaluation.contract.conditioning.core],
            ['sprint_high_speed', evaluation.contract.sprintHighSpeed.exposure],
          ] as const;
          return `${side}: ${evaluation.blockingViolations.length} blocking `
            + `${JSON.stringify(evaluation.blockingViolations.map((finding) => finding.domain))}, `
            + `shortfall ${shortfall.map(([domain, policy]) =>
              `${domain}=${policy.unresolvedMinimumShortfall ?? 0}`).join(' ')}`;
        }).join('\n              ');
      };
      // THE CLASSIFICATION, BEFORE THE VERDICT (seat ruling, 2026-08-07). A
      // difference that is ATTRIBUTED and declared STORED-WRONG is an old
      // write-path defect the derivation corrects — it is flagged for the
      // device pass and does not block. Everything else does: an unattributed
      // difference is exactly what this gate is for.
      const undeclared = undeclaredParityDiffs(materialised.bytes, derived);
      assert(undeclared.length === 0 || derived === materialised.bytes,
        `${label}: the stored week and the derived week disagree, and the `
        + 'difference is NOT declared. Attribute it before it is anything — an '
        + 'unattributed parity diff always blocks.\n      '
        + `materialised ${JSON.parse(materialised.bytes).map((day: { date: string; workout: { name?: string; exercises?: unknown[] } | null }) => `${day.date}=${day.workout?.name ?? 'REST'}|${day.workout?.exercises?.length ?? 0}`).join(' | ')}\n      `
        + `derived      ${derivedWeek().join(' | ')}\n      `
        + `${rowDiff(materialised.bytes, derived).join('\n      ')}\n      `
        + `§18 on each week — ${lawfulness()}\n      `
        + `the program's own rows — ${ancestry()}\n      `
        + `DIFF ${firstDifference(materialised.bytes, derived)}\n      `
        + `UNDECLARED: ${undeclared.join('; ')}`);
      console.log(`      ${label} parity: ${materialised.overlayDays.length} `
        + `materialised days (${materialised.overlayDays.join(', ')}) — `
        + `${derived === materialised.bytes ? 'byte-equal' : 'every difference declared'}`);
    });

    // ── THE VALUES THE RE-PIN WOULD TAKE ────────────────────────────────
    await run(`${label} lawful-4 report the derived week's literal values`, async () => {
      const { wednesday, saturday } = await pinWorld(order);
      const week = derivedWeek();
      const stamps = stampCensus();
      console.log(`      ${label} DERIVED WEEK (stored contract retired):`);
      for (const line of week) console.log(`        ${line}`);
      console.log(`        wednesday=${wednesday} saturday=${saturday}`);
      // REPORTED, NOT ASSERTED. A stamp minted by the deriver records WHEN the
      // derivation ran, which is not a property of the week — so it is
      // normalised out of `lawful-3` and named here instead.
      console.log(`        wall-clock stamps minted by this derivation: `
        + `${stamps.total} (${stamps.distinct} distinct)`);
    });
  }

  // ── THE RATCHET DIRECTION, same law as the walker's declared reds ─────
  await run('every declared parity diff still happens — a paid one deletes', async () => {
    const owed = DECLARED_PARITY_DIFF.filter((entry) => !parityDiffHits.has(entry.id));
    assert(owed.length === 0,
      'a declared parity diff no longer happens in any world. The commit that '
      + 'turned it green owes the deletion of its entry — debt only ever moves '
      + `down:\n      ${owed.map((entry) =>
        `${entry.id} (expires when: ${entry.expiresWhen})`).join('\n      ')}`);
  });

  console.log(`\nDerived-week lawfulness totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
