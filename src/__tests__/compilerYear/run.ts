import type { CanonicalWeeklyCompilerResult } from '../../rules/canonicalWeeklyCompiler';
import type { SeasonPhase } from '../../types/domain';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCalendarStore } from '../../store/calendarStore';
import { getAthleteExclusions } from '../../store/athletePreferencesStore';
import { decisionLedgerEntries } from '../../store/decisionLedgerStore';
import { executeFixtureMutationTransaction } from '../../store/fixtureMutationTransaction';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import { undoLastDecision } from '../../store/undoLastDecision';
import { applyPhaseShift } from '../../utils/profileMutations';
import { applyPlanChange } from '../../utils/planChangeProducer';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { semanticFingerprint } from '../../utils/programSemanticSnapshot';
import { rebaseAcceptedEffectiveWeek } from '../../rules/acceptedEffectiveWeek';
import { coldStartThroughOnboarding, quiet, quietAsync, followTheWeek, recordDay,
  relaunchApp, rolloverIfDue, setJourneyClock, takeCensus } from '../support/athleteJourney';
import { ARCHETYPES, YEAR_START, athleteAnswers, plusDays, yearTimeline, type Archetype } from './catalog';
import { compilerChecks, digest, inspectWeek, signatureDifferences, visibleSignature } from './invariants';
import type { AthleteResult, Check } from './results';

const compilerModule = require('../../rules/canonicalWeeklyCompiler') as typeof import('../../rules/canonicalWeeklyCompiler');
const progressionModule = require('../../rules/canonicalWeeklyProgressionCompiler') as typeof import('../../rules/canonicalWeeklyProgressionCompiler');
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const visible = (start: string, today = start) => quiet(() => deriveVisibleWeekLive(start, today));
const ledger = () => semanticFingerprint(decisionLedgerEntries());

async function shiftPhase(archetype: Archetype, phase: SeasonPhase, date: string) {
  const next = applyPhaseShift(useProfileStore.getState().onboardingData, {
    targetPhase: phase, seasonFinishedOn: phase === 'Off-season' ? plusDays(date, -1) : undefined,
    preferredTrainingDays: [...archetype.days], teamTrainingDays: phase === 'Off-season' ? [] : [...archetype.clubDays],
    gameAnchor: phase === 'In-season' ? archetype.gameDay ? { kind: 'usual_day', day: archetype.gameDay } : { kind: 'no_usual_day' } : undefined,
  });
  return commitProfileProgramTransaction({ change: { kind: 'profile_setup', patch: {
    seasonPhase: next.seasonPhase, seasonFinishedOn: next.seasonFinishedOn,
    preferredTrainingDays: next.preferredTrainingDays, trainingDaysPerWeek: next.trainingDaysPerWeek,
    teamTrainingDays: next.teamTrainingDays, teamTrainingDaysPerWeek: next.teamTrainingDaysPerWeek,
    usualGameDay: next.usualGameDay, gameDay: next.gameDay,
  } }, todayISO: date, sourceSurface: 'phase_shift' });
}

export async function runAthlete(archetype: Archetype, storage: Map<string, string>, limit = 52): Promise<AthleteResult> {
  const result: AthleteResult = { id: archetype.id, weeks: [], checks: [], actions: [], compilerCalls: 0, loggedSessions: 0, restarts: 0 };
  const observations: Check[] = [];
  const original = compilerModule.compileCanonicalWeek;
  const originalProgression = progressionModule.compileCanonicalProgramProgression;
  progressionModule.compileCanonicalProgramProgression = (input) => {
    const before = semanticFingerprint(input);
    const output = originalProgression(input);
    const repeat = originalProgression(input);
    observations.push({ id: 'progression_recorded_anchor', ok: input.asOfISO === input.program.generationAnchorISO &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.asOfISO) });
    observations.push({ id: 'progression_input_immutable', ok: semanticFingerprint(input) === before });
    observations.push({ id: 'progression_deterministic', ok: semanticFingerprint(output) === semanticFingerprint(repeat) });
    return output;
  };
  compilerModule.compileCanonicalWeek = (input) => {
    const output = original(input);
    result.compilerCalls++;
    observations.push(...compilerChecks(output));
    return output;
  };
  let stopped: string | null = null;
  let edited: { weekStart: string; before: string; after: string; target: string } | null = null;
  const action = (kind: string, date: string, ok: boolean, detail?: string) => {
    result.actions.push({ kind, date, ok, detail });
    if (!ok) throw new Error(`${kind}: ${detail ?? 'refused'}`);
  };
  const fixture = async (kind: 'game' | 'practice_match', change: 'add' | 'move' | 'remove', date: string, sourceDate?: string, targetDate?: string) => {
    const outcome = await quietAsync(() => executeFixtureMutationTransaction({
      action: change, fixtureKind: kind, sourceDate, targetDate,
      expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: `year:${archetype.id}:${date}:${change}` }, todayISO: date,
    }));
    action(kind === 'practice_match' ? kind : `${change}_game`, date, outcome.outcome === 'accepted', JSON.stringify(outcome));
  };
  try {
    try {
      const install = await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(archetype), installDayISO: YEAR_START }));
      if (install.onboardingRefusal) throw new Error(install.onboardingRefusal);
      if (install.blockOneStart !== YEAR_START) throw new Error(`Unexpected start ${install.blockOneStart}`);
      result.checks.push({ id: 'onboarding', ok: true });
    } catch (error) {
      stopped = `Onboarding: ${errorText(error)}`;
      result.checks.push({ id: 'onboarding', ok: false, detail: stopped });
    }
    for (const week of yearTimeline(archetype)) {
      if (stopped || week.index >= limit) {
        result.weeks.push({ ...week, status: 'not_reached', checks: [], reason: stopped ?? `Diagnostic limit ${limit}; not release evidence` });
        continue;
      }
      const checks: Check[] = [];
      try {
        setJourneyClock(week.weekStart);
        if (week.phaseWeek === 1 && week.index > 0) {
          const change = await quietAsync(() => shiftPhase(archetype, week.phase, week.weekStart));
          action('phase_shift', week.weekStart, change.ok && change.changedProgram, JSON.stringify({ change,
            programStart: useProgramStore.getState().currentProgram?.startDate,
            clock: useProgramStore.getState().currentProgram?.seasonPhaseClock }));
        }
        const rollover = quiet(() => rolloverIfDue(week.weekStart));
        if (rollover.refusal) throw new Error(`Rollover: ${rollover.refusal}`);
        quiet(() => followTheWeek(week.weekStart));
        if (week.index === 1) {
          const days = visible(week.weekStart);
          const clubDays = useProfileStore.getState().onboardingData.teamTrainingDays ?? [];
          const target = days.find((d) => d.workout && d.workout.exercises.length > 0 && d.source !== 'game' &&
            !clubDays.includes(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.dayOfWeek] as never));
          if (!target) throw new Error('No real training session reached for removal');
          const before = visibleSignature(days);
          const change = quiet(() => applyPlanChange({ change: { kind: 'remove_session', date: target.date, scope: 'whole_day' },
            visibleWeek: days, todayISO: week.weekStart, applyOverride: () => undefined }));
          action('remove_session', week.weekStart, change.ok, JSON.stringify(change));
          const after = visibleSignature(visible(week.weekStart));
          if (before === after || visible(week.weekStart).find((d) => d.date === target.date)?.workout?.exercises.length) {
            throw new Error('Removal reported success without removing the visible session');
          }
          edited = { weekStart: week.weekStart, before, after, target: target.date };
        }
        if (week.index === 2) {
          if (!edited) throw new Error('Missing accepted edit from preceding week');
          checks.push({ id: 'edit_next_week', ok: visibleSignature(visible(edited.weekStart, week.weekStart)) === edited.after,
            detail: `retained edit on ${edited.target} after week advance and prior restart` });
          const undo = await quietAsync(() => undoLastDecision());
          action('undo_session', week.weekStart, undo.outcome === 'undone', JSON.stringify(undo));
          checks.push({ id: 'undo_exact', ok: visibleSignature(visible(edited.weekStart, week.weekStart)) === edited.before });
        }
        if (week.phase === 'Pre-season' && week.phaseWeek === 6) {
          const occupied = visible(week.weekStart).find((d) => d.workout?.exercises.length && d.source !== 'game');
          if (!occupied) throw new Error('Practice-match occupied-day coordinate was not reached');
          await fixture('practice_match', 'add', week.weekStart, undefined, occupied.date);
        }
        if (week.phase === 'In-season' && week.phaseWeek === 3 && archetype.gameDay) {
          const days = visible(week.weekStart);
          const source = days.find((d) => d.source === 'game');
          const target = days.find((d) => d.workout?.exercises.length && d.source !== 'game');
          if (!source || !target) throw new Error('Move-game occupied-day coordinate was not reached');
          await fixture('game', 'move', week.weekStart, source.date, target.date);
        }
        if (week.phase === 'In-season' && week.phaseWeek === 5 && archetype.extraGame) {
          const target = visible(week.weekStart).find((d) => d.workout?.exercises.length && d.source !== 'game');
          if (!target) throw new Error('Extra-game occupied-day coordinate was not reached');
          await fixture('game', 'add', week.weekStart, undefined, target.date);
        }
        if (week.phase === 'In-season' && week.phaseWeek === 7 && archetype.gameDay) {
          const target = visible(week.weekStart).find((d) => d.source === 'game');
          if (!target) throw new Error('Bye coordinate was not reached');
          await fixture('game', 'remove', week.weekStart, target.date);
        }
        const current = useProgramStore.getState().currentProgram?.microcycles.find((m) => m.startDate.slice(0, 10) === week.weekStart);
        if (!current) throw new Error('No current compiled microcycle for this date');
        const before = visible(week.weekStart);
        checks.push(...inspectWeek({ week: current, days: before, ...week,
          effectiveContract: quiet(() => rebaseAcceptedEffectiveWeek({ surfaces: { ...useProgramStore.getState(),
            removalDecisions: useProgramStore.getState().userRemovalConstraints, athleteExclusions: getAthleteExclusions() }, weekStart: week.weekStart,
            profile: useProfileStore.getState().onboardingData, markedDays: useCalendarStore.getState().markedDays })).contract,
          profile: useProfileStore.getState().onboardingData, marks: useCalendarStore.getState().markedDays }));
        const signature = visibleSignature(before);
        const acceptedLedger = ledger();
        const boot = await quietAsync(() => relaunchApp({ storage, todayISO: week.weekStart }));
        result.restarts++;
        if (!boot.ok) throw new Error(`Restart: ${boot.error}`);
        const rebuilt = visibleSignature(visible(week.weekStart));
        checks.push({ id: 'restart', ok: signature === rebuilt, detail: signatureDifferences(signature, rebuilt).join(' | ') });
        checks.push({ id: 'ledger', ok: acceptedLedger === ledger(), detail: 'Whole ordered ledger unchanged by boot' });
        const loggingErrors: string[] = [];
        for (let day = 0; day < 7; day++) {
          const date = plusDays(week.weekStart, day);
          setJourneyClock(date);
          const outcome = await quietAsync(() => recordDay(date, { record: true, completion: 'full',
            feeling: 'good', soreness: 'none', difficulty: 7, logWeights: true, conditioningRpe: 6 }));
          if (outcome.result === 'recorded') result.loggedSessions++;
          else if (outcome.result !== 'no_session' || outcome.detail !== null) loggingErrors.push(`${date}:${JSON.stringify(outcome)}`);
        }
        checks.push({ id: 'logging', ok: loggingErrors.length === 0, detail: loggingErrors.join(' | ') });
        checks.push({ id: 'compiler_boundary', ok: observations.length > 0 && observations.every((c) => c.ok),
          detail: observations.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail ?? ''}`).join(' | ') });
        observations.length = 0;
        result.weeks.push({ ...week, status: 'measured', checks, ledgerDepth: decisionLedgerEntries().length,
          sessions: before.filter((d) => d.workout).length, rows: before.reduce((sum, d) => sum + (d.workout?.exercises.length ?? 0), 0),
          fixtures: before.filter((d) => d.source === 'game').length, liveFingerprint: digest(signature), rebuiltFingerprint: digest(rebuilt) });
        if (loggingErrors.length) stopped = `Logging failed in week ${week.index + 1}: ${loggingErrors[0]}`;
        if ((week.index + 1) % 4 === 0) console.log(`YEAR ${archetype.id}: reached week ${week.index + 1}, ${result.loggedSessions} logged sessions`);
      } catch (error) {
        stopped = errorText(error);
        result.weeks.push({ ...week, status: 'not_reached', checks, reason: stopped });
      }
    }
    if (result.loggedSessions > 0) {
      const census = quiet(() => takeCensus(plusDays(YEAR_START, Math.max(0, result.weeks.filter((w) => w.status === 'measured').length * 7 - 1))));
      result.checks.push({ id: 'real_history', ok: census.progressionHistoryEntries > 0, detail: JSON.stringify(census) });
    }
    if (observations.some((c) => !c.ok)) result.checks.push({ id: 'compiler_refusal', ok: false,
      detail: observations.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail ?? ''}`).join(' | ') });
  } finally {
    compilerModule.compileCanonicalWeek = original;
    progressionModule.compileCanonicalProgramProgression = originalProgression;
  }
  console.log(`YEAR ${archetype.id}: ${result.weeks.filter((w) => w.status === 'measured').length}/52 weeks reached${stopped ? `; ${stopped}` : ''}`);
  return result;
}

/** Mutate an actual compiler return, not hand-authored workout state. */
export async function realCompilerMutation(): Promise<Check> {
  const original = compilerModule.compileCanonicalWeek;
  let caught = false;
  let injected = false;
  let clean = false;
  compilerModule.compileCanonicalWeek = (input) => {
    const output = original(input);
    if (!output.ok || injected) return output;
    clean = compilerChecks(output).every((c) => c.ok);
    const mutant: CanonicalWeeklyCompilerResult = { ...output, schedule: { ...output.schedule,
      days: [...output.schedule.days, output.schedule.days[0]] } };
    injected = true;
    caught = compilerChecks(mutant).some((c) => c.id === 'compiler_unique_days' && !c.ok);
    return mutant;
  };
  try {
    await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(ARCHETYPES.find((a) => a.id === 'male-3-experienced-gym')!), installDayISO: YEAR_START }));
  } catch { /* The mutated compiler may also be refused by the app's acceptance boundary. */ }
  finally { compilerModule.compileCanonicalWeek = original; }
  let primarySpeedClean = false;
  let lostSpeedCaught = false;
  compilerModule.compileCanonicalWeek = (input) => {
    const output = original(input);
    if (output.ok && output.schedule.days.some((d) => d.conditioning === 'sprint_high_speed')) {
      primarySpeedClean = compilerChecks(output).every((c) => c.ok);
      const mutant = { ...output, plan: { ...output.plan,
        weeklyPlan: output.plan.weeklyPlan.map((entry) => ({ ...entry, speedBlock: undefined })) } };
      lostSpeedCaught = compilerChecks(mutant).some((c) => c.id === 'compiler_sprint_identity' && !c.ok);
    }
    return output;
  };
  try {
    await quietAsync(() => coldStartThroughOnboarding({ profile: {
      ...athleteAnswers(ARCHETYPES.find((a) => a.id === 'male-3-experienced-gym')!),
      seasonPhase: 'Off-season', seasonFinishedOn: '2026-06-14', teamTrainingDays: [], teamTrainingDaysPerWeek: 0,
    }, installDayISO: YEAR_START }));
  } catch { /* The downstream exposure-credit conflict remains a year refusal, not a waived lifecycle. */ }
  finally { compilerModule.compileCanonicalWeek = original; }
  return { id: 'real_compiler_mutation', ok: injected && clean && caught && primarySpeedClean && lostSpeedCaught,
    detail: `real compiler outputs: clean=${clean}, duplicate-day injected=${injected}, rejected=${caught}; primary speed identity clean=${primarySpeedClean}, dropped speed block rejected=${lostSpeedCaught}. This does not certify downstream exposure acceptance.` };
}
