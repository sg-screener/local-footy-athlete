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
import {
  normalizeInjuryEpisode,
  deriveInjuryConstraintFromEpisode,
  deriveInjuryConstraintsFromEpisodes,
} from '../rules/injuryEpisode';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type { InjuryState } from '../utils/injuryProgression';

// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. Added when this suite was wired into test:bible — an unarmed suite
// in the chain exits 0 on a drained loop and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
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

// ══ SECTION 2 IS DELETED WITH ITS VEHICLE ════════════════════════════════
//
// It drove `applyInjuryFilterToWorkout`, the read-time injury filter the
// 2026-08-19 burn removed. Sam ordered it NOT rebuilt.
//
// ⚠ AND THE DELETED FILTER'S BEHAVIOUR IS NOT A STANDARD (Sam, 2026-08-21:
// *"Treat staged injury return as a separate Sam decision. Do not assume the
// deleted filter's old behaviour still applies."*). An earlier draft of this
// note called the difference a "gap" and scored the current app against what
// the old filter used to do. That was the wrong frame: the filter is gone
// because it was superseded, not because it was right.
//
// WHAT IS SIMPLY TRUE, MEASURED ON THE REAL DOORS
// (`npm run probe:injury-filter-coverage`, lane REINTRODUCTION):
//   9/10 then 4/10 -> ["Leg Press","Glute Bridge","Bulgarian Split Squats",
//                      "Single-Leg RDL","Band Pallof Press"], withheld 0
//   a fresh 4/10   -> the same five rows, withheld 0
// The two are identical. A reported severity is taken at face value.
//
// AND: `rules/injuryReintroduction.ts` — the module the cells below exercise —
// has ZERO production callers. `stageReintroductionSeverity` and
// `isReintroducing` are computed by nobody.
//
// WHETHER A RETURN SHOULD BE STAGED AT ALL IS SAM'S DECISION AND IS OPEN. The
// cells below hold what the staging rule computes, so that decision has a
// written specification either way; they assert nothing about what the athlete
// currently gets, and nothing here is a claim that the current answer is wrong.

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

// ── 5. priorSeverity survives the episode -> constraint derivation ──
//
// RE-SITED, NOT DELETED. This section drove the legacy single-slot
// `useCoachUpdatesStore.setActiveInjury`, which no longer exists — the store now
// keeps injury EPISODES and derives constraints from them, and this suite has
// been dead at import on that call since the change. The two claims it made are
// still live, so they are made at the owner that carries them now:
// `rules/injuryEpisode.deriveInjuryConstraintFromEpisode`.
function episode(bucket: string, severity: number, over: Record<string, unknown> = {}) {
  return normalizeInjuryEpisode({
    protocolVersion: 1,
    episodeId: `injury-episode:v1:injury-${bucket}:1`,
    bodyPart: bucket, region: 'other', bucket, severity,
    status: 'improving', onsetOrReportedDate: '2026-07-01', updatedAt: '2026-07-01T00:00:00Z',
    triggers: [], seriousSymptoms: false,
    currentRestrictionPolicy: {
      rules: [], safeFocus: [], advice: [],
      severityBand: 'moderate', adjustmentLevel: 'moderate',
    },
    compatibility: { constraintId: `injury-${bucket}` },
    ...over,
  })!;
}

{
  const improving = episode('hamstring', 6, {
    currentRestrictionPolicy: {
      rules: [], safeFocus: [], advice: [],
      severityBand: 'moderate', adjustmentLevel: 'moderate',
      priorSeverity: 8,
    },
  });
  const derived = deriveInjuryConstraintFromEpisode(improving);
  ok('an improving episode carries priorSeverity through to its constraint',
    derived?.priorSeverity === 8, JSON.stringify(derived?.priorSeverity));

  const worsening = episode('hamstring', 8);
  ok('an episode with no recorded peak carries no priorSeverity',
    deriveInjuryConstraintFromEpisode(worsening)?.priorSeverity === undefined);

  // Resolving one episode must not touch an unrelated one.
  const shoulder = episode('shoulder', 5);
  const resolvedHamstring = episode('hamstring', 4, { status: 'resolved' });
  const constraints = deriveInjuryConstraintsFromEpisodes([resolvedHamstring, shoulder]);
  ok('a resolved episode yields no constraint',
    !constraints.some((c) => c.id === 'injury-hamstring'), JSON.stringify(constraints.map((c) => c.id)));
  ok('resolving one injury leaves an unrelated one standing',
    constraints.some((c) => c.id === 'injury-shoulder'), JSON.stringify(constraints.map((c) => c.id)));
}


console.log(`\nInjury reintroduction tests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log('\nFailures:'); failures.forEach((n) => console.log(`  - ${n}`)); process.exit(1); }
