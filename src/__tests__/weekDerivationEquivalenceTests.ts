/**
 * S1 OF THE ONE-OWNER REBUILD (R-229) — the equivalence harness.
 *
 * THE LAW BEING MEASURED: a door-committed week must equal the boot-derived
 * week for the same ledger, and every door must keep working after a
 * relaunch. Launch-audit finding #1 root B measured the violation on device:
 * a swap on a relaunched moved session was rolled back by the transaction's
 * own re-derivation (`reduction_contradiction`), because two rebuilders of
 * one week disagree. Sam ruled ONE OWNER (R-229, 2026-08-26); this suite is
 * the plan's S1 — measure before moving anything
 * (`docs/ONE_OWNER_REBUILD_PLAN_2026-08-26.md`).
 *
 * WORLDS ARE ACTED, NEVER SEEDED (fixture-fidelity law): a real generated
 * program, real doors, and `rebuildDerivedWorld` standing in for the
 * relaunch — the same instrument the exclusion-scope suite uses for its
 * relaunch cells.
 *
 * S2 PAID ITS RED (2026-08-26, same day): the re-gate write-back is retired
 * and the move-placement copy yields to a later override (dayPrecedence),
 * so every cell here is green and the suite joined the bible chain. A red
 * here now means a SECOND rebuilder has crept back in.
 *
 * Run: npm run test:week-derivation-equivalence
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass++; console.log(`  PASS ${name}`); }
  else {
    fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const info = console.info; const debug = console.debug;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.info = () => {}; console.debug = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.info = info; console.debug = debug;
  }
}

const WEEK = '2026-08-03';   // Monday
const TODAY = WEEK;

/** The audit's own athlete shape: in-season, game Saturday, TT Tue/Thu. */
function athlete(): OnboardingData {
  return {
    gender: 'male', seasonPhase: 'In-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [], goals: ['Get stronger'], experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

function installWorld(): TrainingProgram {
  return quiet(() => {
    resetStoresToFreshInstall('week-derivation-equivalence');
    const profile = athlete();
    useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true } as never);
    const program = generateProgramLocally(profile, {
      todayISO: WEEK,
      blockNumber: 2,
    }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program,
      currentMicrocycle: program.microcycles[0],
      blockState: { blockStartDate: WEEK, blockNumber: 2 },
      generationAnchorISO: WEEK,
    } as never);
    return program;
  });
}

function fingerprint(): string {
  const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
    date: string;
    workout?: { name?: string; exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
  }>;
  return week.map((day) =>
    `${day.date.slice(8)}=${day.workout?.name ?? 'Rest'}[${(day.workout?.exercises ?? [])
      .map((row) => row.exercise?.name ?? row.name ?? '?').join(',')}]`).join(' | ');
}

/** The relaunch, by the app's own instrument. */
async function relaunch(): Promise<void> {
  await quiet(async () => { await rebuildDerivedWorld(); });
}

const source = { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' } as const;
const shared = {
  source, scope: 'today_only', requiresRebuild: false,
  createsActiveModifier: false, oneOffOnly: true,
} as const;

function visibleWeekArg(): never {
  return resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as never;
}

async function door(action: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  return quiet(() => executeProgramControlActionDurably(
    { ...shared, ...action } as never,
    { visibleWeek: visibleWeekArg(), todayISO: TODAY } as never,
  )) as Promise<{ ok: boolean; message?: string }>;
}

/** First app-owned strength day (not team training, has exercises). */
function strengthDate(): string | null {
  const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
    date: string;
    workout?: { name?: string; workoutType?: string; exercises?: unknown[] } | null;
  }>;
  return week.find((day) => (day.workout?.exercises?.length ?? 0) > 0
    && !/team|game/i.test(String(day.workout?.name ?? '')))?.date ?? null;
}

/** The team-training night (the audit's own destination: Wed strength → Thu TT). */
function teamNightDate(): string | null {
  const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
    date: string; workout?: { name?: string; exercises?: unknown[] } | null;
  }>;
  return week.find((day) => /team training/i.test(String(day.workout?.name ?? ''))
    && (day.workout?.exercises?.length ?? 0) === 0)?.date ?? null;
}

function firstExerciseNameOn(date: string): string | null {
  const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
    date: string;
    workout?: { exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
  }>;
  const rows = week.find((day) => day.date === date)?.workout?.exercises ?? [];
  return rows[0]?.exercise?.name ?? rows[0]?.name ?? null;
}

async function main(): Promise<void> {
  console.log('\n[1] CONTROL — an untouched world derives the same week twice');
  installWorld();
  const virgin = fingerprint();
  await relaunch();
  ok('an untouched week survives the boot derivation byte-identical',
    fingerprint() === virgin, `before: ${virgin}\nafter:  ${fingerprint()}`);

  console.log('\n[2] MOVE — door-committed equals boot-derived');
  // The audit's own move: a strength day onto the bare team night (the
  // doubling law's combined-day landing). The empty days of an in-season
  // week are G-1/G+1 and legally refuse a whole-day move — learned on the
  // first run of this harness. R-226's ask is answered `keep_regular` so
  // content is byte-conserved for the fingerprint comparison.
  installWorld();
  const from = strengthDate();
  const to = teamNightDate();
  ok('CONTROL: the world offers a strength day and a bare team night',
    !!from && !!to, `from=${from} to=${to}`);
  if (from && to) {
    const moved = await door({
      type: 'move_session',
      payload: { fromDate: from, toDate: to, scope: 'whole_day' },
      teamNightContentRoute: 'keep_regular',
    });
    ok('the move lands', moved.ok === true, moved.message);
    const afterDoor = fingerprint();
    await relaunch();
    ok('the relaunched week equals the door-committed week (move)',
      fingerprint() === afterDoor, `door:   ${afterDoor}\nreplay: ${fingerprint()}`);
  }

  console.log('\n[3] BIN — door-committed equals boot-derived');
  installWorld();
  const binDate = strengthDate();
  if (binDate) {
    const binned = await door({ type: 'bin_session', payload: { date: binDate, scope: 'whole_day' } });
    ok('the bin lands', binned.ok === true, binned.message);
    const afterDoor = fingerprint();
    await relaunch();
    ok('the relaunched week equals the door-committed week (bin)',
      fingerprint() === afterDoor, `door:   ${afterDoor}\nreplay: ${fingerprint()}`);
  }

  console.log('\n[4] ROOT B — the audit case: edit, relaunch, then keep editing');
  installWorld();
  const rootFrom = strengthDate();
  const rootTo = teamNightDate();
  if (rootFrom && rootTo) {
    await door({
      type: 'move_session',
      payload: { fromDate: rootFrom, toDate: rootTo, scope: 'whole_day' },
      teamNightContentRoute: 'keep_regular',
    });
    await relaunch();
    // A real replacement, same slot — the device case swapped a chosen
    // alternative, not a blank ("Exercise swap needs a selected replacement
    // exercise" — learned on the first run).
    const target = firstExerciseNameOn(rootTo);
    ok('CONTROL: the moved session still has a first exercise after relaunch',
      !!target, fingerprint());
    if (target) {
      const beforeSwap = fingerprint();
      const swapFrom = (resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
        date: string;
        workout?: { exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
      }>).find((day) => day.date === rootTo)?.workout?.exercises
        ?.map((row) => row.exercise?.name ?? row.name ?? '')
        .find((name) => /squat|leg press/i.test(name)) ?? target;
      const swapped = await door({
        type: 'swap_exercise',
        payload: {
          date: rootTo,
          fromExercise: swapFrom,
          toExercise: { name: 'Goblet Squat' },
        },
      });
      // ⚠ EXPECTED RED UNTIL S2 (the re-gate retirement). Device-measured
      // 2026-08-25: this exact shape rolled back with
      // `reduction_contradiction:main_strength` — the transaction's internal
      // re-derivation contradicts the week the athlete sees.
      const swapDetail = `${swapped.message ?? ''} ${JSON.stringify(
        (swapped as { rejected?: unknown }).rejected
        ?? (swapped as { refusal?: unknown }).refusal ?? null)}`;
      ok('S2 TARGET: a swap on a relaunched moved session lands',
        swapped.ok === true, swapDetail);
      if (!swapped.ok) {
        ok('the refused swap at least left the week untouched (no corruption)',
          fingerprint() === beforeSwap,
          `before: ${beforeSwap}\nafter:  ${fingerprint()}`);
      } else {
        ok('the landed swap actually changed the visible week',
          fingerprint() !== beforeSwap, fingerprint());
        const afterSwap = fingerprint();
        await relaunch();
        ok('and the landed swap SURVIVES the boot derivation byte-identical',
          fingerprint() === afterSwap,
          `door:   ${afterSwap}\nreplay: ${fingerprint()}`);
      }
    }
  }

  console.log('\n[5] ROOT B, SECOND SHAPE — bin then move, relaunch, then a health door');
  installWorld();
  const binFirst = strengthDate();
  if (binFirst) {
    await door({ type: 'bin_session', payload: { date: binFirst, scope: 'whole_day' } });
    const secondStrength = strengthDate();
    const landing = teamNightDate();
    if (secondStrength && landing) {
      await door({
        type: 'move_session',
        payload: { fromDate: secondStrength, toDate: landing, scope: 'whole_day' },
        teamNightContentRoute: 'keep_regular',
      });
    }
    await relaunch();
    const afterReplay = fingerprint();
    // The audit's #1A shape (sick/flat on an edited world) is guarded by
    // test:forward-decision-acceptance; here the question is narrower: does
    // the derived world survive ANOTHER derivation unchanged?
    await relaunch();
    ok('a twice-derived edited world is stable (derivation is idempotent)',
      fingerprint() === afterReplay,
      `first:  ${afterReplay}\nsecond: ${fingerprint()}`);
  }

  console.log(`\nWeek derivation equivalence: ${pass} passed, ${fail} failed`);
  for (const line of failures) console.log(`  ✗ ${line}`);
  totalsPrinted(fail);
  process.exit(fail > 0 ? 1 : 0);
}

void main().catch((error) => {
  console.error('SUITE DIED:', (error as Error).message);
  totalsPrinted(1);
  process.exit(1);
});
