import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { getAthleteExclusions } from '../../store/athletePreferencesStore';
import { decisionLedgerEntries } from '../../store/decisionLedgerStore';
import { pendingUndoTarget, undoLastDecision } from '../../store/undoLastDecision';
import { replayableEntries } from '../../rules/decisionLedgerReplay';
import { applyExerciseExclusionDecision } from '../../utils/exerciseExclusionOwner';
import { asyncStorageDurable, flushPendingStorageWrites } from '../../store/asyncStorageCompat';
import type { ExerciseExclusionScope } from '../../rules/exerciseExclusions';

const assert = (ok: unknown, detail: string): void => { if (!ok) throw new Error(detail); };
const days = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
const signature = () => visibleSignature(days());

/** All scopes, immediate/restarted Undo, accumulated removals, then restart again.
 * Uses real onboarding and the same durable removal/Undo doors as the toast.
 */
export async function exerciseRemovalUndoJourney(storage: Map<string, string>): Promise<void> {
  for (const scope of ['today_only', 'this_block', 'until_changed'] as ExerciseExclusionScope[]) {
    for (const restartBefore of [false, true]) {
      const label = `${scope}/${restartBefore ? 'restarted' : 'live'}`;
      const install = await quietAsync(() => coldStartThroughOnboarding({
        profile: athleteAnswers(ARCHETYPES[0]), installDayISO: YEAR_START,
      }));
      assert(!install.onboardingRefusal, `${label}: onboarding refused`);
      const remove = async (name?: string) => {
        const day = days().find(d => d.workout?.exercises.some(row => !name || row.exercise.name === name));
        const row = day?.workout?.exercises.find(row => !name || row.exercise.name === name);
        assert(day && row, `${label}: no actual exercise reached`);
        const result = await quietAsync(() => executeProgramControlActionDurably({
          type: 'remove_exercise', scope: 'today_only', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          payload: { date: day!.date, exercise: row!.exercise.name, exerciseId: row!.exerciseId },
          requiresRebuild: false, createsActiveModifier: true, oneOffOnly: true,
        }, { todayISO: YEAR_START }));
        assert(result.ok && result.changedProgram, `${label}: removal refused: ${JSON.stringify(result)}`);
        // Same second answer as the session screen's scope control.
        const scoped = quiet(() => applyExerciseExclusionDecision({ exercise: row!.exercise.name,
          scope, decidedOnISO: day!.date }));
        assert(scoped.ok && scoped.exclusion?.scope === scope, `${label}: chosen scope not reached`);
        assert(getAthleteExclusions().some(ex => ex.exercise === row!.exercise.name), `${label}: exclusion not reached`);
        assert(!days().find(d => d.date === day!.date)?.workout?.exercises.some(r => r.exerciseId === row!.exerciseId), `${label}: row not removed`);
        return row!.exercise.name;
      };
      const firstName = await remove();
      const retained = JSON.stringify(getAthleteExclusions());
      const before = signature();
      const nextWeekBefore = visibleSignature(quiet(() => deriveVisibleWeekLive(plusDays(YEAR_START, 7), YEAR_START)));
      const priorLedger = replayableEntries(decisionLedgerEntries()).map(entry => entry.id);
      const secondName = await remove();
      assert(firstName !== secondName, `${label}: two distinct removals not reached`);
      const targetId = pendingUndoTarget()?.id;
      assert(targetId, `${label}: removal not undoable`);
      if (restartBefore) assert((await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }))).ok, `${label}: removal restart failed`);
      if (scope === 'until_changed' && restartBefore) {
        for (const key of ['program-store', 'decision-ledger-store', 'athlete-preferences-store']) {
          await flushPendingStorageWrites();
          const visibleBefore = signature();
          const exclusionsBefore = JSON.stringify(getAthleteExclusions());
          const ledgerBefore = JSON.stringify(decisionLedgerEntries());
          const persistedKeys = ['program-store', 'decision-ledger-store', 'athlete-preferences-store',
            'calendar-storage', 'profile-store', 'coach-updates', 'readiness-store', 'coach-preferences-store'];
          const disk = async () => JSON.stringify(await Promise.all(persistedKeys.map(name => asyncStorageDurable.getItem(name))));
          const diskBefore = await disk();
          const original = asyncStorageDurable.setItem;
          let injected = false;
          asyncStorageDurable.setItem = async (name, value) => {
            if (name === key && !injected) { injected = true; throw new Error(`Undo write failure: ${key}`); }
            return original(name, value);
          };
          let failed;
          try { failed = await quietAsync(() => undoLastDecision()); }
          finally { asyncStorageDurable.setItem = original; }
          const intact = { injected, refused: failed.outcome === 'refused', visible: signature() === visibleBefore,
            exclusions: JSON.stringify(getAthleteExclusions()) === exclusionsBefore,
            ledger: JSON.stringify(decisionLedgerEntries()) === ledgerBefore, disk: await disk() === diskBefore };
          assert(Object.values(intact).every(Boolean), `${label}: ${key} failure left a half-Undo: ${JSON.stringify(intact)}`);
        }
      }
      const undone = await quietAsync(() => undoLastDecision());
      assert(undone.outcome === 'undone' && undone.reversedEntryId === targetId, `${label}: ${JSON.stringify(undone)}`);
      assert(JSON.stringify(getAthleteExclusions()) === retained, `${label}: Undo did not restore exact prior exclusions`);
      assert(JSON.stringify(replayableEntries(decisionLedgerEntries()).map(entry => entry.id)) === JSON.stringify(priorLedger), `${label}: Undo reversed another action`);
      assert(signature() === before, `${label}: visible week was not restored`);
      assert(visibleSignature(quiet(() => deriveVisibleWeekLive(plusDays(YEAR_START, 7), YEAR_START))) === nextWeekBefore, `${label}: future week exclusion survived`);
      assert((await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }))).ok, `${label}: Undo restart failed`);
      assert(JSON.stringify(getAthleteExclusions()) === retained && signature() === before, `${label}: Undo did not survive restart`);
      console.log(`    ${label}: two removals → Undo latest → restart preserved previous edit`);
    }
  }
}
