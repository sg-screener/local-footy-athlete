/**
 * Athlete Move — occupied-destination CONTENT-CONSERVATION INVARIANTS.
 *
 * Pins the NEW finding from docs/audits/FULLSWEEP_2026-07-23.md (Section A item
 * 6b) and its diagnosis in docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md:
 *
 *   A chained double-move that lands a real session onto an occupied G-1
 *   (day-before-game) day silently DESTROYS the moved session and DUPLICATES the
 *   destination's resolver-derived Gunshow filler onto both days, while the
 *   transaction reports success ("... swapped sessions.").
 *
 * These invariants describe the CORRECT behaviour (a pure Move/Swap conserves the
 * multiset of athlete-owned session identities, and success implies conservation).
 *
 * ## STATUS, CORRECTED 2026-08-10 — THIS SUITE IS GREEN AND THE HEADER SAID IT
 * ## WAS RED
 *
 * It said *"M2/M3/M4 are therefore expected to FAIL on the current architecture
 * — that RED failure is what proves each test pins the bug."* **That has not
 * been true for some time and the doc outlived it twice over:** M3 and M4 do not
 * exist in this file, and M2 PASSES. What actually runs is **two** cells, both
 * green — M1 (a single occupied-destination move onto G-1 is safely refused) and
 * M2 (the chained double-move conserves content and reports honestly).
 *
 * A header that says a suite is expected to be red is a header that tells the
 * next reader to ignore its own result. Left standing, it would have made this
 * file's green unreadable at exactly the moment its invariant became load-bearing
 * again — see below.
 *
 * ## AND THE INVARIANT ABOVE IS BROKEN AGAIN, ON A PATH WITH NO CELL
 *
 * 2026-08-10: a `power+strength` day moved onto a TEAM NIGHT lands as
 * `strength+team_training` and the power row is **NOT DRAWN** (8 rows in, 7
 * out), while the same day to an EMPTY day keeps all 8 — and the coach reports
 * *"Done. Session moved."* over it.
 *
 * **CORRECTED 2026-08-10 — this header said "the power ROW deleted" and that
 * was not established.** `roleCensusFor`, the instrument behind "8 rows in, 7
 * out", reads a PROJECTION; it never read storage, and the header never said
 * which. Five probes over every producer that can remove power work — the §18
 * weekly budget, both canonicalisation pushes, both safety-finaliser pushes,
 * the stack path, and a wrapper over `finaliseWorkoutAfterMutation` covering
 * all 73 call sites — **counted ZERO on that run.** So the destination-dependent
 * LOSS is real and is what this suite is about; **DELETION is OPEN-UNKNOWN**,
 * and the two live candidates are that the move never carried the row, or that
 * it is stored and not drawn. `LAW-count-names-instrument`: a number names the
 * instrument's unit, not the domain noun. Same law as the July case, same shape of false
 * success, **different path**: `stackSessionOntoTeamAnchor`, which no cell in
 * this repo reaches. Measured by `npm run tape:coach-move-durability` (the
 * DESTINATION AXIS section), control in the same run.
 *
 * **THE LESSON THE SEAT DREW IS THAT THE COVERAGE SHAPE IS WRONG, NOT THAT A
 * THIRD CELL IS MISSING.** Coverage here is organised BY PATH, and every new
 * destination shape is a new path, so the invariant keeps being true and
 * unenforced somewhere new. The unit under consideration is content conservation
 * as a DOOR-LEVEL post-condition — checked once, where every move and swap
 * passes — with this suite becoming a characterisation of two paths rather than
 * the only place the law lives.
 *
 * FIDELITY (load-bearing): the repro only reproduces on a REAL accepted
 * composition base (device-exact seed, R11 pattern) WITH the explicit Saturday
 * game mark the dev reset installs. The R1-style hand-built seed leaves the
 * composition base null and the Saturday game virtual — under which the resolver's
 * G-1 protected-core guard preserves the moved strength session and the loss does
 * NOT reproduce. See the diagnosis doc for why.
 *
 * Run: npm run test:athlete-move-occupied-content-loss
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { executeProgramControlActionDurably } from '../utils/programControlActions';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// Anchor Mon 2026-07-13; Saturday game 2026-07-18; Friday 2026-07-17 is G-1 (Gunshow).
const MON = '2026-07-13';
const WED = '2026-07-15';
const FRI = '2026-07-17';

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passes += 1;
    console.log(`  PASS [invariant] ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** DEVICE-EXACT seed install (R11 pattern) PLUS the explicit Saturday game mark
 *  the dev reset coordinator installs for `standard-in-season-week`. Both are
 *  load-bearing: without the real composition base OR the explicit game mark the
 *  loss does not reproduce. */
async function seedDeviceExact(): Promise<void> {
  // Full reset so each invariant starts from a pristine base — the durable move
  // door accumulates userRemovalConstraints / ledger / overlays (in-memory AND
  // in the AsyncStorage envelope) that would otherwise leak across tests and
  // refuse a re-run of the same move. Use the stores' own clear() (as the dev
  // reset coordinator does) so the accepted composition base is torn down with
  // the surfaces, not left stale.
  memory.clear();
  await AsyncStorage.clear();
  quiet(() => {
    (useProgramStore.getState() as { clear: () => void }).clear();
    (useProfileStore.getState() as { clear: () => void }).clear();
  });
  const dseed = buildDevE2ESeed('standard-in-season-week');
  const validateWeekStarts = dseed.program.microcycles.map((m: { startDate: string }) => m.startDate.slice(0, 10));
  quiet(() => seedOnboardingProgram({
    onboardingData: dseed.profile,
    program: dseed.program,
    todayISO: dseed.anchorDate,
    programStore: {
      setCurrentProgram: (program: unknown) => { commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'move-occupied-test:device-exact-install',
        program: { currentProgram: program, currentMicrocycle: null, todayWorkout: null,
          blockState: deriveStoredBlockStateFromProgram(program as never) },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts,
      } as never); },
      setCurrentMicrocycle: (m: { startDate: string } | null) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'move-occupied-test:device-exact-mc', program: { currentMicrocycle: m },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: m ? [m.startDate.slice(0, 10)] : [],
      } as never),
      setTodayWorkout: (w: unknown) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'move-occupied-test:device-exact-today', program: { todayWorkout: w },
        profile: dseed.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: [dseed.anchorDate],
      } as never),
    },
    fixtureMarkInstaller: { setGameDay: () => undefined },
  } as never));
  useProfileStore.setState({ onboardingData: dseed.profile, isOnboardingComplete: true });
  // Explicit Saturday game mark — mirrors installAcceptedCalendarGame.
  const gameDate = addDaysISO(dseed.anchorDate, 5); // 2026-07-18 Saturday
  const accepted = useProgramStore.getState().acceptedMaterialContext;
  quiet(() => commitAcceptedStateTransaction({
    // Harness seed: installs a world, never restores one.
    operation: 'forward_decision',
    reason: `move-occupied-test:calendar_game:${gameDate}`,
    markedDays: { ...accepted.markedDays, [gameDate]: 'game' },
    profile: dseed.profile,
    preserveExactAcceptedWorkouts: true,
    validateWeekStarts,
  } as never));
}

interface ResolvedRow { name: string; id: string; dayOfWeek: number; date: string }

function resolvedWeek(): ResolvedRow[] {
  return resolveWeekWithConditioning(MON, buildScheduleStateImperative())
    .filter((day) => !!day.workout)
    .map((day) => ({
      name: day.workout!.name,
      id: day.workout!.id,
      dayOfWeek: day.workout!.dayOfWeek,
      date: day.date,
    }));
}

async function moveDurable(fromDate: string, toDate: string): Promise<{ ok: boolean; message?: string }> {
  const visibleWeek = resolveWeekWithConditioning(MON, buildScheduleStateImperative());
  const r = await executeProgramControlActionDurably({
    type: 'move_session',
    source: { screen: 'program_tab', surface: 'week_day_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { fromDate, toDate },
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
  } as never, { visibleWeek, todayISO: MON } as never);
  return r as { ok: boolean; message?: string };
}

async function main(): Promise<void> {
  // ── M1 (characterization, GREEN today): a SINGLE occupied-destination move of
  // the protected-core strength session onto the G-1 Gunshow day is safely
  // refused — the plan is untouched, no content lost. This is the "chain is
  // required" boundary: the loss does NOT occur on a single move.
  await run('M1 single occupied-destination move onto the G-1 day is safely refused (plan untouched)', async () => {
    await seedDeviceExact();
    const before = resolvedWeek();
    const result = await moveDurable(MON, FRI);
    const after = resolvedWeek();
    assert(result.ok === false, `single move onto G-1 should be refused, got ok=${result.ok} msg=${result.message}`);
    assert(JSON.stringify(after) === JSON.stringify(before),
      'a refused single move must leave the week byte-identical');
  });

  // ── M2 (RED today): THE chained-double-move reproduction, asserted on ONE real
  // sequence (seeded once). Move MON→WED (empty), then WED→FRI (occupied Gunshow).
  // A pure Move/Swap must conserve the multiset of athlete-owned sessions and its
  // success must imply that conservation. Three independent properties, all of
  // which fail on the current architecture:
  //   (a) conservation — the moved "Lower Body Strength" survives somewhere;
  //   (b) no duplication — no single session identity lands on two days;
  //   (c) honest success — a "swapped sessions" ok must imply (a) and (b).
  // RED today: the resolver re-derives Gunshow over Friday's landed strength
  // session (destroying it) and the swapped-back derived Gunshow lands on
  // Wednesday, so Gunshow shows on BOTH days — reported as a false success.
  await run('M2 chained double-move conserves content and reports honestly (a: survives, b: no dup, c: honest success)', async () => {
    await seedDeviceExact();
    const move1 = await moveDurable(MON, WED);
    assert(move1.ok, `precondition: MON->WED move should apply, got ${move1.message}`);
    const swap = await moveDurable(WED, FRI);
    const week = resolvedWeek();
    const shown = week.map((r) => `${r.date}:${r.name}`).join(', ');

    // (a) conservation: the moved session must still exist somewhere.
    const hasStrength = week.some((r) => /lower body strength/i.test(r.name));

    // (b) no duplication: no single session identity may occupy two days.
    const byId = new Map<string, string[]>();
    for (const row of week) {
      const dates = byId.get(row.id) ?? [];
      dates.push(row.date);
      byId.set(row.id, dates);
    }
    const duplicated = [...byId.entries()].filter(([, dates]) => dates.length > 1);

    // (c) honest success: if it claims a swap, both sessions must be present.
    const claimedSwap = swap.ok && /swap/i.test(swap.message ?? '');

    assert(hasStrength,
      `(a) moved session silently destroyed (swap ok=${swap.ok}, msg="${swap.message}"); week = ${shown}`);
    assert(duplicated.length === 0,
      `(b) a Move/Swap duplicated a session identity across days: ` +
      duplicated.map(([id, dates]) => `${id}@[${dates.join(',')}]`).join('; ') + `; week = ${shown}`);
    assert(!claimedSwap || (hasStrength && duplicated.length === 0),
      `(c) transaction claimed success ("${swap.message}") while losing/duplicating content; week = ${shown}`);
  });

  console.log(`\nAthlete move occupied content-loss invariants: ${passes} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.log(`Failing (expected RED until the conservation invariant is owned): ${failures.join(', ')}`);
    process.exit(1);
  }
}

void main();
