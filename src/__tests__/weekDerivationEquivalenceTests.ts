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

function fingerprint(weekStart: string = WEEK): string {
  const week = resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()) as Array<{
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
      payload: {
        fromDate: from, toDate: to, scope: 'whole_day',
        teamNightContentRoute: 'keep_regular',
      },
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
      payload: {
        fromDate: rootFrom, toDate: rootTo, scope: 'whole_day',
        teamNightContentRoute: 'keep_regular',
      },
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
        payload: {
          fromDate: secondStrength, toDate: landing, scope: 'whole_day',
          teamNightContentRoute: 'keep_regular',
        },
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

  console.log('\n[10] AWAY — the trip takes the club off, keeps the gym, and survives boot');
  // The audit's NOT-COVERED item 1, now covered by the same equivalence law
  // as every door: away next Mon-Fri via the real door
  // (set_schedule_modifier + awaySpan, Sam's item-28 shape).
  installWorld();
  {
    const NEXT_WEEK = '2026-08-10';
    const thisWeekBefore = fingerprint(WEEK);
    const awayResult = await door({
      type: 'set_schedule_modifier',
      scope: 'current_week',
      payload: { date: NEXT_WEEK, todayISO: TODAY, awaySpan: { from: '2026-08-10', until: '2026-08-14' } },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    });
    ok('the away door lands', awayResult.ok === true, awayResult.message);
    const nextWeek = () => resolveWeekWithConditioning(NEXT_WEEK, buildScheduleStateImperative()) as Array<{
      date: string; workout?: { name?: string } | null;
    }>;
    const clubDaysAway = nextWeek().filter((day) =>
      day.date >= '2026-08-10' && day.date <= '2026-08-14'
      && /team training/i.test(String(day.workout?.name ?? '')));
    ok('AWAY: the club days inside the trip carry no Team Training',
      clubDaysAway.length === 0,
      nextWeek().map((day) => `${day.date.slice(8)}=${day.workout?.name ?? 'Rest'}`).join(' '));
    ok('AWAY: the current week is untouched',
      fingerprint(WEEK) === thisWeekBefore);
    const awayWeekAfterDoor = fingerprint(NEXT_WEEK);
    await relaunch();
    ok('AWAY: the trip survives the boot derivation byte-identical',
      fingerprint(NEXT_WEEK) === awayWeekAfterDoor,
      `door:   ${awayWeekAfterDoor}\nreplay: ${fingerprint(NEXT_WEEK)}`);
  }

  console.log('\n[11] ADD A GAME — the fixture lands, the week reshapes, and it survives boot');
  // The audit's NOT-COVERED item 2, through the one fixture door.
  installWorld();
  {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { executeFixtureMutationTransaction } = require('../store/fixtureMutationTransaction');
    // The add door serves NO-GAME weeks (a week with a fixture offers move,
    // not add — the transaction's own refusal, learned on the first run). So
    // the athlete's real sequence: remove Saturday's game, then add Wednesday
    // — which covers the REMOVE door as well.
    const removed = await quiet(() => executeFixtureMutationTransaction({
      action: 'remove', fixtureKind: 'game', sourceDate: '2026-08-08',
      source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'equivalence-remove-game' },
    })) as { outcome: string; error?: unknown };
    ok('the remove-game door lands', removed.outcome === 'accepted' || removed.outcome === 'applied',
      `${removed.outcome} ${String((removed.error as Error)?.message ?? '')}`);
    const added = await quiet(() => executeFixtureMutationTransaction({
      action: 'add', fixtureKind: 'game', targetDate: '2026-08-05',
      source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'equivalence-add-game' },
    })) as { outcome: string; error?: unknown };
    ok('the add-a-game door lands on the now-gameless week', added.outcome === 'accepted' || added.outcome === 'applied',
      `${added.outcome} ${String((added.error as Error)?.message ?? '')}`);
    const midweekGame = (resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
      date: string; workout?: { name?: string } | null;
    }>).find((day) => day.date === '2026-08-05');
    ok('ADD GAME: the target day resolves as a game day',
      /game/i.test(String(midweekGame?.workout?.name ?? '')),
      fingerprint(WEEK));
    const afterAdd = fingerprint(WEEK);
    await relaunch();
    ok('ADD GAME: the reshaped week survives the boot derivation byte-identical',
      fingerprint(WEEK) === afterAdd,
      `door:   ${afterAdd}\nreplay: ${fingerprint(WEEK)}`);
  }

  console.log('\n[9] R-231 — the sorer full-body shape lands OFF the club night');
  // Sam, 2026-08-26: "they get the real exercises - just spread throughout the
  // week instead of all on one night." The R-093 pair's B shape carries the
  // Bible :156 families (hinge + single-leg-knee: heavy RDLs, Bulgarians);
  // its assignment must prefer the non-team-night strength day. The exercises
  // stay REAL — asserted present in the week — just not stacked pre-club.
  // A world where exactly ONE strength day coincides with a club night:
  // club Wed/Fri, gym Mon/Wed — Wednesday combines, Monday stays plain.
  quiet(() => {
    resetStoresToFreshInstall('week-derivation-equivalence-r231');
    const profile = {
      ...athlete(),
      trainingDaysPerWeek: 2,
      preferredTrainingDays: ['Monday', 'Wednesday'],
      teamTrainingDays: ['Wednesday', 'Friday'],
    } as unknown as OnboardingData;
    useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true } as never);
    const program = generateProgramLocally(profile, { todayISO: WEEK, blockNumber: 2 }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program,
      currentMicrocycle: program.microcycles[0],
      blockState: { blockStartDate: WEEK, blockNumber: 2 },
      generationAnchorISO: WEEK,
    } as never);
  });
  {
    const week = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()) as Array<{
      date: string;
      workout?: { name?: string; exercises?: Array<{ exercise?: { name?: string }; name?: string }> } | null;
    }>;
    const names = (day: typeof week[number]): string[] =>
      (day.workout?.exercises ?? []).map((row) => row.exercise?.name ?? row.name ?? '');
    const ttDay = week.find((day) => /team training/i.test(String(day.workout?.name ?? ''))
      && (day.workout?.exercises?.length ?? 0) > 0);
    const gymDay = week.find((day) => (day.workout?.exercises?.length ?? 0) > 0
      && !/team|game/i.test(String(day.workout?.name ?? '')));
    ok('CONTROL: the week has a combined club night and a plain strength day',
      !!ttDay && !!gymDay, fingerprint());
    if (ttDay && gymDay) {
      const ttNames = names(ttDay);
      const weekNames = week.flatMap(names);
      ok('the Bulgarians are NOT on the club night',
        !ttNames.includes('Bulgarian Split Squats'), ttNames.join(', '));
      ok('and the athlete still trains them that week — real exercises, spread',
        weekNames.includes('Bulgarian Split Squats'), weekNames.join(', '));
      ok('the heavy hinge main is NOT on the club night',
        !ttNames.includes('RDLs'), ttNames.join(', '));
    }
  }

  console.log('\n[6] S3 — the override writer\'s outcome FLOWS (source anchors)');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const coachActionsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'utils', 'coachActions.ts'), 'utf8');
  ok('writeCoachOverride returns the writer\'s outcome, not void',
    /function writeCoachOverride\([\s\S]{0,200}\): ProgramOverrideWriteOutcome/.test(coachActionsSrc),
    'the wrapper is void again — the discarded-outcome shape (R-229 S3)');
  const bareCalls = coachActionsSrc.split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s+writeCoachOverride\(/.test(line));
  ok('no call site discards the outcome (every call is consumed)',
    bareCalls.length === 0,
    `statement-position writeCoachOverride at line(s) ${bareCalls.map((c) => c.index + 1).join(', ')}`);

  console.log('\n[8] S4c — the healthy week judges as itself again');
  // The accept-and-reduce world, acted: bin, properly sick (week-scoped),
  // relaunch, then CLEAR. Measured 2026-08-26: the sick week stamps
  // optional_week/core.min=0 into both stored contract homes and the clear
  // restores neither — so the write boundary must judge the DERIVED contract,
  // whose fact-input being gone is exactly what makes the week healthy again.
  installWorld();
  const s4cBin = strengthDate();
  if (s4cBin) {
    await door({ type: 'bin_session', payload: { date: s4cBin, scope: 'whole_day' } });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readinessActionForKind } = require('../utils/weekReadinessActions');
    const sick = await quiet(() => executeProgramControlActionDurably(
      readinessActionForKind('illness_severe', { anchorDateISO: WEEK, todayISO: TODAY }),
      { visibleWeek: visibleWeekArg(), todayISO: TODAY } as never,
    )) as { ok: boolean };
    ok('CONTROL: the severe illness lands', sick.ok === true);
    await relaunch();
    const facts = (useProgramStore.getState() as never as {
      acceptedMaterialContext?: { temporarySourceFacts?: Array<{ factId: string; factKind?: string; kind?: string }> };
    }).acceptedMaterialContext?.temporarySourceFacts ?? [];
    const illnessFact = facts.find((fact) => (fact.factKind ?? fact.kind) === 'illness');
    ok('CONTROL: the illness fact survived the relaunch', !!illnessFact);
    const clearedResult = await door({
      type: 'clear_fatigue_status', scope: 'current_week',
      payload: { modifierId: illnessFact?.factId ?? 'unknown', date: WEEK },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    });
    ok('CONTROL: the clear lands', clearedResult.ok === true, clearedResult.message);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { selectStoredWeekDeclaration } = require('../rules/storedWeekDeclaration');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { deriveWeekContract } = require('../rules/derivedWeekContract');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { factsForWorld } = require('../rules/acceptedEffectiveWeek');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { liveAcceptedEffectiveWeekSurfaces } = require('../utils/liveEvaluationSurfaces');
    const st = useProgramStore.getState() as never as Record<string, never>;
    const stored = selectStoredWeekDeclaration({
      overlay: (st.weekScopedOverlays as never as Record<string, unknown>)?.[WEEK],
      coveringMicrocycle: st.currentMicrocycle,
      weekStart: WEEK,
      reader: 'weekDerivationEquivalenceTests',
    });
    ok('CONTROL: a stored declaration exists for the week', !!stored);
    if (stored) {
      // The stale store is a KNOWN S4c-2 debt (the writer half is still
      // scaffold-flagged); the law this suite holds is that the DERIVED judge
      // recovers the healthy identity from it.
      console.log(`  (stored identity after clear: ${(stored as { identity?: { mode?: string } }).identity?.mode})`);
      const derived = deriveWeekContract({
        contract: stored,
        weekStart: WEEK,
        profile: (useProfileStore.getState() as never as { onboardingData?: unknown }).onboardingData,
        markedDays: (st.acceptedMaterialContext as never as { markedDays?: Record<string, string> })?.markedDays ?? {},
        userRemovalConstraints: st.userRemovalConstraints,
        temporarySourceFacts: factsForWorld(liveAcceptedEffectiveWeekSurfaces()),
      });
      ok('the derived contract is no longer the sick week\'s once the illness is cleared',
        derived.identity?.mode !== 'optional_week',
        `derived identity: ${derived.identity?.mode}`);
    }
    /* ── S5: THE STORED WORLD CONVERGES TO THE FACTS AT THE NEXT BOOT ──────
     * Boot regenerates the whole program under live facts (quiescentBoot
     * clean-slate + generateProgramLocally), so a relaunch DURING the illness
     * legitimately authors optional_week microcycles — that is not a stamp,
     * it is generation consuming the fact. The property one-owner requires:
     * once the illness is CLEARED, the next boot re-authors the healthy
     * declaration. Between clear and that boot, the S4c judges derive over
     * the stale store — the two mechanisms meet with no gap. */
    await relaunch();
    const microcycleContract = (useProgramStore.getState() as never as {
      currentMicrocycle?: { exposureContractV2?: { identity?: { mode?: string } } };
    }).currentMicrocycle?.exposureContractV2;
    ok('S5: the post-clear boot re-authors the healthy declaration',
      microcycleContract?.identity?.mode !== 'optional_week',
      `microcycle identity after clear+relaunch: ${microcycleContract?.identity?.mode}`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const validatorSrc = (require('fs') as typeof import('fs')).readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require('path') as typeof import('path')).join(__dirname, '..', 'utils', 'postGenerationConstraintValidation.ts'), 'utf8');
    ok('both live write boundaries judge the DERIVED contract',
      (validatorSrc.match(/contract: deriveWeekContract\(\{/g) ?? []).length === 2,
      'a validator hands the raw stored declaration to the gateway again');
  }

  console.log('\n[7] S4 — the live week has ONE door');
  // The retired shape: hand-assembling the live pair. Candidate/what-if reads
  // passing their OWN state are views of the same machinery and stay legal;
  // dev/e2e is frozen and excluded.
  const glob = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? (entry.name === '__tests__' || entry.name === 'dev' ? [] : glob(path.join(dir, entry.name)))
      : /\.(ts|tsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
  const offenders = glob(path.join(__dirname, '..'))
    .filter((file) => !file.endsWith('deriveVisibleWeek.ts'))
    .filter((file) => /resolveWeekWithConditioning\([^;]{0,120}buildScheduleStateImperative\(\)/s
      .test(fs.readFileSync(file, 'utf8')));
  ok('no production file hand-assembles the live week pair',
    offenders.length === 0,
    `the pair is back at: ${offenders.join(', ')}`);

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
