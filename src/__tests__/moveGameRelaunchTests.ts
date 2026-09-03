/**
 * MOVE A GAME, RELAUNCH, AND THE "GAME MOVED" NOTE IS STILL THERE.
 *
 * Found 2026-09-02 on the simulator (`.maestro/audit/week-move-game.yaml`):
 * the athlete drags Saturday's game to Sunday in Manage week, saves, and the
 * app is relaunched. The game comes back on Sunday — the decision ledger
 * replays the move at boot — but the "Game moved" coach note (the card that
 * carries the undo) did not: memory held no game-change note while disk still
 * did, so the dev persistence gate refused the relaunch as non-convergent
 * ("Persisted semantic state did not converge: coach-updates").
 *
 * The note is a projection of the accepted fixture decision. Replaying the
 * decision without re-deriving its note is the defect; this suite holds the
 * athlete-visible promise headlessly through the same doors the phone uses.
 *
 * Run: npm run test:move-game-relaunch
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';

const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
} };

import { ARCHETYPES, athleteAnswers, YEAR_START, yearTimeline, plusDays } from './compilerYear/catalog';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import {
  coldStartThroughOnboarding, quiet, quietAsync, setJourneyClock, rolloverIfDue, followTheWeek, relaunchApp,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCoachUpdatesStore, COACH_UPDATES_PERSISTENCE_KEY } from '../store/coachUpdatesStore';
import { waitForDevE2EPersistence } from '../dev/e2e/devE2EPersistence';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

type Row = { type: string; id: string; reversibleAdjustmentId?: string };
const memoryNotes = (): Row[] => (useCoachUpdatesStore.getState().activeConstraints as unknown as Row[])
  .filter((c) => c.id.startsWith('game-change'));
const diskNotes = (): Row[] => {
  const raw = storage.get(COACH_UPDATES_PERSISTENCE_KEY);
  if (!raw) return [];
  return ((JSON.parse(raw).state?.activeConstraints ?? []) as Row[]).filter((c) => c.id.startsWith('game-change'));
};
const activeAdjustmentIds = (): string[] => useProgramStore.getState().reversibleAdjustmentLedger.adjustments
  .filter((a) => a.status === 'active').map((a) => a.id);
const dayTypes = (ws: string): Record<string, string> => Object.fromEntries(
  (quiet(() => deriveVisibleWeekLive(ws, ws)) as { date: string; workout?: { workoutType?: string } | null }[])
    .map((d) => [d.date, d.workout?.workoutType ?? 'rest']));

async function shiftPhase(a: any, phase: string, date: string) {
  const next = applyPhaseShift(useProfileStore.getState().onboardingData!, {
    targetPhase: phase,
    seasonFinishedOn: phase === 'Off-season' ? plusDays(date, -1) : undefined,
    preferredTrainingDays: [...a.days],
    teamTrainingDays: phase === 'Off-season' ? [] : [...a.clubDays],
    gameAnchor: phase === 'In-season'
      ? a.gameDay ? { kind: 'usual_day', day: a.gameDay } : { kind: 'no_usual_day' }
      : undefined,
  } as never) as Record<string, unknown>;
  return commitProfileProgramTransaction({ change: { kind: 'profile_setup', patch: {
    seasonPhase: next.seasonPhase, seasonFinishedOn: next.seasonFinishedOn,
    preferredTrainingDays: next.preferredTrainingDays, trainingDaysPerWeek: next.trainingDaysPerWeek,
    teamTrainingDays: next.teamTrainingDays, teamTrainingDaysPerWeek: next.teamTrainingDaysPerWeek,
    usualGameDay: next.usualGameDay, gameDay: next.gameDay,
  } }, todayISO: date, sourceSurface: 'phase_shift' } as never);
}

(async () => {
  resetStoresToFreshInstall('move-game-relaunch');
  const a = (ARCHETYPES as any[]).find((e) => e.id === 'male-3-experienced-gym');
  await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(a), installDayISO: YEAR_START }));
  let ws = '';
  for (const e of yearTimeline(a)) {
    setJourneyClock(e.weekStart);
    if (e.phaseWeek === 1 && e.index > 0) await quietAsync(() => shiftPhase(a, e.phase, e.weekStart));
    quiet(() => rolloverIfDue(e.weekStart));
    if (e.phase === 'In-season' && e.phaseWeek === 3) { ws = e.weekStart; break; }
    quiet(() => followTheWeek(e.weekStart));
  }
  const saturday = plusDays(ws, 5);
  const sunday = plusDays(ws, 6);

  check('CONTROL: before any move the week has a Saturday game and no game-change note in memory or on disk',
    dayTypes(ws)[saturday] === 'Game' && memoryNotes().length === 0 && diskNotes().length === 0,
    `${JSON.stringify(dayTypes(ws))} memory=${memoryNotes().length} disk=${diskNotes().length}`);

  const moved = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'move', fixtureKind: 'game', sourceDate: saturday, targetDate: sunday,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'manage_week', commandId: 'move-game-relaunch' },
  } as never)) as { outcome: string };
  const afterMove = dayTypes(ws);
  check('the move is accepted and the athlete sees Sunday = Game, Saturday no longer a game',
    moved.outcome === 'accepted' && afterMove[sunday] === 'Game' && afterMove[saturday] !== 'Game',
    `${moved.outcome} ${JSON.stringify(afterMove)}`);
  check('after the move, memory and disk both hold the "Game moved" note and it names the active adjustment',
    memoryNotes().length === 1 && diskNotes().length === 1 &&
      memoryNotes()[0].id === diskNotes()[0].id &&
      activeAdjustmentIds().includes(memoryNotes()[0].reversibleAdjustmentId ?? ''),
    `memory=${JSON.stringify(memoryNotes().map((c) => c.id))} disk=${JSON.stringify(diskNotes().map((c) => c.id))} active=${JSON.stringify(activeAdjustmentIds())}`);

  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: ws })) as { ok: boolean; error?: string };
  const afterBoot = dayTypes(ws);
  check('RELAUNCH: boot succeeds and the game is still on Sunday',
    boot.ok && afterBoot[sunday] === 'Game' && afterBoot[saturday] !== 'Game',
    `ok=${boot.ok} ${boot.error ?? ''} ${JSON.stringify(afterBoot)}`);
  const notes = memoryNotes();
  check('RELAUNCH: memory holds exactly one "Game moved" note and it names the ledger\'s active move adjustment (the undo link)',
    notes.length === 1 && activeAdjustmentIds().includes(notes[0].reversibleAdjustmentId ?? ''),
    `memory=${JSON.stringify(notes.map((c) => c.id))} active=${JSON.stringify(activeAdjustmentIds())}`);
  check('RELAUNCH: memory and disk agree on the game-change notes',
    JSON.stringify(memoryNotes().map((c) => c.id)) === JSON.stringify(diskNotes().map((c) => c.id)),
    `memory=${JSON.stringify(memoryNotes().map((c) => c.id))} disk=${JSON.stringify(diskNotes().map((c) => c.id))}`);
  let gate = 'converged';
  try { await waitForDevE2EPersistence(undefined, 2_000); } catch (error) { gate = (error as Error).message.split('\n')[0]; }
  check('RELAUNCH: the dev persistence gate the simulator flow waits on converges (memory == disk for every semantic store)',
    gate === 'converged', gate);

  console.log(`\nMove game relaunch: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).stack}`);
  process.exit(1);
});
