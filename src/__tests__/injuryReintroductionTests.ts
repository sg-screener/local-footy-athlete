/**
 * Staged injury reintroduction tests (Bible §8).
 *
 * Run: npx sucrase-node src/__tests__/injuryReintroductionTests.ts
 *
 * Covers the pure staging helper, the resolver-level filter (hamstring, with
 * tag-recognised triggers), the generation-constraint staging for every body
 * area, red-flag preservation, and the store's priorSeverity population +
 * cleared-injury behaviour.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import type { Workout } from '../types/domain';
import {
  stageReintroductionSeverity,
  isReintroducing,
  REINTRODUCTION_STEP,
} from '../rules/injuryReintroduction';
import { applyInjuryFilterToWorkout } from '../utils/injuryWorkoutFilter';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type { InjuryState } from '../utils/injuryProgression';

let pass = 0, fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ok ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`); }
}

// ── 1. Pure staging helper ──
{
  ok('step is one band (2)', REINTRODUCTION_STEP === 2);
  ok('no prior → no-op (4)', stageReintroductionSeverity({ currentSeverity: 4 }) === 4);
  ok('single-band step 8→6 → 6', stageReintroductionSeverity({ currentSeverity: 6, priorSeverity: 8 }) === 6);
  ok('single-band step 6→4 → 4', stageReintroductionSeverity({ currentSeverity: 4, priorSeverity: 6 }) === 4);
  ok('single-band step 4→2 → 2', stageReintroductionSeverity({ currentSeverity: 2, priorSeverity: 4 }) === 2);
  ok('big jump 8→2 held at 6 (one band below peak)', stageReintroductionSeverity({ currentSeverity: 2, priorSeverity: 8 }) === 6);
  ok('big jump 8→4 held at 6', stageReintroductionSeverity({ currentSeverity: 4, priorSeverity: 8 }) === 6);
  ok('worsening 4→6 → 6 (no leniency)', stageReintroductionSeverity({ currentSeverity: 6, priorSeverity: 4 }) === 6);
  ok('cleared (0) stays cleared', stageReintroductionSeverity({ currentSeverity: 0, priorSeverity: 8 }) === 0);
  ok('isReintroducing true on a big jump', isReintroducing({ currentSeverity: 2, priorSeverity: 8 }));
  ok('isReintroducing false on single-band step', !isReintroducing({ currentSeverity: 6, priorSeverity: 8 }));
  ok('isReintroducing false with no prior', !isReintroducing({ currentSeverity: 4 }));
}

// ── 2. Resolver filter — hamstring (tag-recognised triggers) ──
function ex(name: string) {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`, exerciseOrder: 0,
    prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 6, restSeconds: 90,
    exercise: { id: name, name, description: '', exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [], difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '' } as any,
    createdAt: '', updatedAt: '',
  };
}
function lowerWorkout() {
  return {
    id: 'wk', microcycleId: 'm', dayOfWeek: 1, name: 'Lower Body Strength', description: '',
    durationMinutes: 60, intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
    exercises: [ex('Deadlift'), ex('RDLs'), ex('Goblet Squat')],
    createdAt: '', updatedAt: '',
  } as unknown as Workout;
}
function names(w: Workout) { return w.exercises.map((e) => e.exercise?.name); }
function ham(severity: number, priorSeverity?: number) {
  return { bodyPart: 'hamstring', bucket: 'hamstring', severity, status: 'improving' as const, priorSeverity };
}

{
  // Fresh moderate (4, no history): heavy hinge Deadlift is only 'caution' → kept.
  const fresh4 = applyInjuryFilterToWorkout(lowerWorkout(), ham(4));
  ok('fresh moderate keeps heavy hinge (Deadlift caution)', names(fresh4).includes('Deadlift'), names(fresh4).join(','));

  // Reported 4 but jumped down from a severe 8: staged to effective 6 → Deadlift
  // becomes 'avoid' and is removed. No jump straight back to heavy hinge.
  const jumped = applyInjuryFilterToWorkout(lowerWorkout(), ham(4, 8));
  ok('8→(reported 4) does NOT reintroduce heavy hinge (Deadlift removed)', !names(jumped).includes('Deadlift'), names(jumped).join(','));
  ok('8→(reported 4) still removes RDLs (avoid)', !names(jumped).includes('RDLs'), names(jumped).join(','));
  ok('8→(reported 4) keeps safe alternative (Goblet Squat)', names(jumped).includes('Goblet Squat'), names(jumped).join(','));

  // Reported mild 2 but jumped from 8: staged to effective 6 → RDLs still out.
  const mildFromSevere = applyInjuryFilterToWorkout(lowerWorkout(), ham(2, 8));
  ok('8→(reported 2) does NOT reintroduce RDLs (held at effective 6)', !names(mildFromSevere).includes('RDLs'), names(mildFromSevere).join(','));

  // Genuinely mild (2, no history) OR a gradual 4→2 step: mostly restored — RDLs kept.
  const trulyMild = applyInjuryFilterToWorkout(lowerWorkout(), ham(2));
  ok('genuinely mild keeps most training (RDLs present)', names(trulyMild).includes('RDLs'), names(trulyMild).join(','));
  const gradual = applyInjuryFilterToWorkout(lowerWorkout(), ham(2, 4));
  ok('gradual 4→2 mostly restores (RDLs present)', names(gradual).includes('RDLs'), names(gradual).join(','));

  // 8→6 keeps risky hinge out.
  const step86 = applyInjuryFilterToWorkout(lowerWorkout(), ham(6, 8));
  ok('8→6 keeps Deadlift + RDLs out', !names(step86).includes('Deadlift') && !names(step86).includes('RDLs'), names(step86).join(','));
}

// ── 3. Generation-constraint staging — every body area ──
function injuryConstraint(over: Partial<ActiveInjuryConstraint>): ActiveInjuryConstraint {
  return {
    id: `injury-${over.bucket ?? 'x'}`, type: 'injury', bodyPart: String(over.bucket ?? 'x'),
    bucket: (over.bucket ?? null) as any, severity: 6, status: 'improving',
    startDate: '2026-07-01', lastUpdatedAt: '2026-07-01', rules: [], safeFocus: [], advice: [],
    ...over,
  } as ActiveInjuryConstraint;
}
function ctxFor(over: Partial<ActiveInjuryConstraint>) {
  const context = buildGenerationConstraintContext({
    activeConstraints: [injuryConstraint(over)],
    todayISO: '2026-07-01',
  });
  return context?.injuries[0];
}

{
  for (const bucket of ['hamstring', 'knee', 'adductor', 'calf', 'shoulder']) {
    // Jump down: reported 4, prior 8 → effective 6 → still removes risky work.
    const inj = ctxFor({ bucket: bucket as any, severity: 4, priorSeverity: 8 });
    ok(`${bucket}: downgrade-from-severe staged to effective 6`, inj?.effectiveSeverity === 6, JSON.stringify(inj));
    ok(`${bucket}: staged effective still removes risky work`, inj?.removeRiskyWork === true);
  }

  // No prior → no staging (effective === reported).
  const fresh = ctxFor({ bucket: 'knee' as any, severity: 4 });
  ok('fresh injury: effective === reported (no staging)', fresh?.effectiveSeverity === 4);
  ok('fresh moderate knee: does NOT remove risky work (4-5 band)', fresh?.removeRiskyWork === false && fresh?.reduceAffectedWork === true);

  // Genuinely mild jumped from severe is held out of the pool (>=4 keys active).
  const mildJump = buildGenerationConstraintContext({
    activeConstraints: [injuryConstraint({ bucket: 'hamstring' as any, severity: 2, priorSeverity: 8 })],
    todayISO: '2026-07-01',
  });
  ok('mild-from-severe still contributes active injury keys (effective>=4)', (mildJump?.activeInjuryKeys.length ?? 0) > 0);
}

// ── 4. Red-flag hard stop is never weakened ──
{
  const severe = ctxFor({ bucket: 'knee' as any, severity: 8, priorSeverity: 10 });
  ok('severe injury still pauses affected training', severe?.pauseAffectedTraining === true);
  // Staging can only RAISE effective severity, never lower it.
  ok('staging never lowers below reported severity', stageReintroductionSeverity({ currentSeverity: 8, priorSeverity: 4 }) >= 8);
}

// ── 5. Store: priorSeverity population + cleared-injury ──
function injuryState(bucket: string, severity: number): InjuryState {
  return {
    bodyPart: bucket, bucket: bucket as any, severity, initialSeverity: severity, status: 'active',
    rules: [], startDate: '2026-07-01T00:00:00Z', lastUpdatedAt: '2026-07-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z', history: [],
  };
}
function currentInjuryConstraint(bucket: string): ActiveInjuryConstraint | undefined {
  return useCoachUpdatesStore.getState().activeConstraints
    .find((c): c is ActiveInjuryConstraint => c.type === 'injury' && c.id === `injury-${bucket}`);
}
{
  const store = useCoachUpdatesStore.getState();
  store.clearAllCoachUpdates();

  // Report severe hamstring, then improve to 6 → constraint carries priorSeverity 8.
  store.setActiveInjury(injuryState('hamstring', 8));
  store.setActiveInjury(injuryState('hamstring', 6));
  ok('improvement records priorSeverity (8)', currentInjuryConstraint('hamstring')?.priorSeverity === 8, JSON.stringify(currentInjuryConstraint('hamstring')));
  ok('activeInjury state also carries priorSeverity', useCoachUpdatesStore.getState().activeInjury?.priorSeverity === 8);

  // Worsening does not set a (lenient) priorSeverity.
  store.setActiveInjury(injuryState('hamstring', 8));
  ok('worsening carries no priorSeverity', currentInjuryConstraint('hamstring')?.priorSeverity === undefined);

  // Add an unrelated shoulder injury; clearing the hamstring must not touch it.
  store.setActiveInjury(injuryState('shoulder', 5));
  const hamState = injuryState('hamstring', 4);
  store.setActiveInjury(hamState);
  // Clear the hamstring (legacy single-slot points at the last-set injury).
  store.setActiveInjury(null);
  ok('cleared injury removes its constraint', currentInjuryConstraint('hamstring') === undefined);
  ok('clearing did NOT remove the unrelated shoulder constraint', !!currentInjuryConstraint('shoulder'));
  store.clearAllCoachUpdates();
}

console.log(`\nInjury reintroduction tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('\nFailures:'); failures.forEach((n) => console.log(`  - ${n}`)); process.exit(1); }
