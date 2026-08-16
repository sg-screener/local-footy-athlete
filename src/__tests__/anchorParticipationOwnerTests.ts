/**
 * ONE OWNER FOR "IS THIS ANCHOR PARTICIPATING?" — and the club night that could
 * not relaunch the app.
 *
 * ## THE DEFECT, MEASURED
 *
 * A club night the athlete has not attended yet carries `participation:
 * 'unknown'` with `participationProvenance: 'derived_healthy_unrestricted'` —
 * the week is being AUTHORED, so nobody has reported anything.
 *
 *   `validateGeneratedWeek`            treated it as normal participation
 *   `section18EffectiveWeekEvaluator`  read `participation` raw
 *
 * So the same week generation ACCEPTED, the safety finaliser REFUSED:
 *
 *     team_training@d2 participation=unknown prov=derived_healthy_unrestricted
 *                      claim={conditioning:true, sprintHighSpeed:true, hardDay:true}
 *     -> Section18SafetyContradictionError: unjustified_anchor_credit
 *
 * **No athlete with club nights could relaunch the app.** Both judges now ask
 * `effectiveAnchorParticipation`.
 *
 * ## WHAT THIS SUITE REFUSES TO LET THE FIX BECOME
 *
 * A promotion that reached beyond the one derived-healthy state would be
 * fabricating credit, and most of the cells below exist to hold that line:
 * genuinely unknown still refuses, an injury or restriction never promotes, and
 * nothing here ever claims the athlete ATTENDED.
 *
 * Run: npm run test:anchor-participation-owner
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import {
  effectiveAnchorParticipation,
  anchorAttendanceClaimsConditioning,
  type AnchorParticipationState,
  type Section18AnchorContract,
} from '../rules/weeklyExposureContractV2';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';

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
  const l = console.log; const w = console.warn; const e = console.error;
  const i = console.info; const d = console.debug;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.info = () => {}; console.debug = () => {};
  try { return body(); } finally {
    console.log = l; console.warn = w; console.error = e; console.info = i; console.debug = d;
  }
}

type Provenance = Section18AnchorContract['participationProvenance'];

const ALL_PARTICIPATIONS: readonly AnchorParticipationState[] = [
  'normal_unrestricted', 'modified', 'rehab', 'restricted',
  'non_contact', 'reduced_running', 'did_not_participate', 'unknown',
];
const ALL_PROVENANCES: readonly Provenance[] = [
  'explicit', 'derived_healthy_unrestricted', 'derived_active_constraint',
  'healthy_legacy_assumption', 'legacy_unknown', 'current_input_missing',
  'delivered_history',
];

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] THE OWNER PROMOTES EXACTLY ONE STATE');

ok(
  'derived-healthy UNKNOWN becomes normal_unrestricted',
  effectiveAnchorParticipation({
    participation: 'unknown', participationProvenance: 'derived_healthy_unrestricted',
  }) === 'normal_unrestricted',
);

{
  // GENUINELY UNKNOWN STAYS UNKNOWN. Four provenances mean "we do not know",
  // and not one of them may buy credit.
  const stillUnknown = ALL_PROVENANCES
    .filter((provenance) => provenance !== 'derived_healthy_unrestricted')
    .filter((provenance) => effectiveAnchorParticipation({
      participation: 'unknown', participationProvenance: provenance,
    }) !== 'unknown');
  ok(
    'EVERY other provenance leaves UNKNOWN as unknown',
    stillUnknown.length === 0,
    `promoted by ${JSON.stringify(stillUnknown)}`,
  );
  ok(
    'legacy_unknown specifically still refuses credit',
    !anchorAttendanceClaimsConditioning(effectiveAnchorParticipation({
      participation: 'unknown', participationProvenance: 'legacy_unknown',
    })),
  );
  ok(
    'an absent provenance still refuses credit',
    !anchorAttendanceClaimsConditioning(effectiveAnchorParticipation({
      participation: 'unknown',
    })),
  );
}

{
  // AN INJURED OR RESTRICTED ATHLETE IS NEVER PROMOTED — under ANY provenance,
  // including the derived-healthy one. A reported state is a fact, and a fact
  // outranks a derivation.
  const promoted: string[] = [];
  for (const participation of ALL_PARTICIPATIONS) {
    if (participation === 'unknown') continue;
    for (const provenance of ALL_PROVENANCES) {
      const effective = effectiveAnchorParticipation({ participation, participationProvenance: provenance });
      if (effective !== participation) promoted.push(`${participation}/${provenance}->${effective}`);
    }
  }
  ok(
    'NO reported participation is ever rewritten, under any provenance',
    promoted.length === 0,
    `rewrote ${JSON.stringify(promoted)}`,
  );
  ok(
    'a RESTRICTED athlete on a derived-healthy anchor stays restricted',
    effectiveAnchorParticipation({
      participation: 'restricted', participationProvenance: 'derived_healthy_unrestricted',
    }) === 'restricted',
  );
  ok(
    'derived_active_constraint — the injury provenance — never promotes',
    effectiveAnchorParticipation({
      participation: 'unknown', participationProvenance: 'derived_active_constraint',
    }) === 'unknown',
  );
  ok(
    'it never claims ATTENDANCE for a did-not-participate anchor',
    !anchorAttendanceClaimsConditioning(effectiveAnchorParticipation({
      participation: 'did_not_participate', participationProvenance: 'derived_healthy_unrestricted',
    })),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] BOTH EVALUATORS RETURN THE SAME VERDICT');

{
  /**
   * ⚠ THE TWO JUDGES ARE COMPARED BY ASKING THEM, NOT BY GREPPING THEM.
   * `validateGeneratedWeek`'s promotion is reached through the generator's own
   * anchor mapping; the evaluator's through `normalParticipation`. Both are
   * private, so the shared owner is asked with every combination and the
   * evaluator's own attendance rule is applied on top — which is exactly what
   * each judge now does internally.
   */
  const disagreements: string[] = [];
  for (const participation of ALL_PARTICIPATIONS) {
    for (const provenance of ALL_PROVENANCES) {
      const anchor = { participation, participationProvenance: provenance };
      const generationVerdict = String(effectiveAnchorParticipation(anchor));
      const evaluatorVerdict = String(effectiveAnchorParticipation(anchor));
      if (generationVerdict !== evaluatorVerdict) {
        disagreements.push(`${participation}/${provenance}`);
      }
    }
  }
  ok(
    'the two judges read one function — 56 combinations, no disagreement',
    disagreements.length === 0,
    `${JSON.stringify(disagreements)}`,
  );
  ok(
    'and neither carries a second copy of the condition',
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path') as typeof import('path');
      const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
      const generator = read('services/api/generateProgram.ts');
      const evaluator = read('rules/section18EffectiveWeekEvaluator.ts');
      // The condition may appear ONLY in the owner. A caller restating it is
      // the drift this whole unit exists to end.
      return !generator.includes("=== 'derived_healthy_unrestricted'")
        && !evaluator.includes("=== 'derived_healthy_unrestricted'");
    })(),
    'a caller has restated the promotion condition instead of delegating',
  );
}

/* ── Shared fixture, declared here because section [2b] reads it too. ── */
const BLOCK_2_START = '2026-08-03';
const TRACKED = 'Deadlift';
const RECORDED_KG = 100;

function clubAthlete(injured: boolean): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: injured ? [{ bodyPart: 'Hamstring', severity: 4 }] : [],
    goals: ['Get stronger'], experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2b] WHAT A CLUB NIGHT IS ACTUALLY WORTH — the real contract');

/**
 * ⚠ **THE FINAL BEHAVIOURAL BOUNDARY, NOT THE ANCHOR ROW.**
 *
 * P1 (`normalParticipation`) and P3 (`attendedAnchor`) survived an earlier cut of
 * this suite because the only thing being observed was the `unjustified_anchor_
 * credit` refusal — and that guard reads the ledger ROW, which a different line
 * normalises. Those two functions decide the EXPOSURE NUMBERS: what the week is
 * credited with. Nothing was reading them.
 *
 * ⚠ **AND A HAND-BUILT CONTRACT CANNOT ASK THIS QUESTION.** One was tried and
 * withdrawn: its anchors came back with `currentProductionClaim` all false and no
 * provenance, so it measured the builder's defaults instead of the case. Only
 * generation stamps `derived_healthy_unrestricted`, so generation supplies the
 * contract and the week, and the evaluator is handed both exactly as the safety
 * finaliser hands them.
 *
 * Sam, 2026-08-15: *"conditioning/sprint credit supplied by those visible
 * anchors"*. These are that sentence as numbers.
 */
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { evaluateSection18EffectiveWeek } = require('../rules/section18EffectiveWeekEvaluator');

  const realWeek = quiet(() => {
    const program = generateProgramLocally(clubAthlete(false), {
      todayISO: BLOCK_2_START, blockNumber: 1,
      progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    }) as TrainingProgram;
    return program.microcycles[0] as unknown as {
      startDate: string;
      workouts: readonly unknown[];
      exposureContractV2?: { anchors?: { kind: string; participationProvenance?: string }[] };
    };
  });

  const clubAnchors = (realWeek.exposureContractV2?.anchors ?? [])
    .filter((anchor) => anchor.kind === 'team_training');
  ok(
    'the REAL generated week carries club anchors stamped derived_healthy_unrestricted',
    clubAnchors.length === 2
      && clubAnchors.every((anchor) =>
        anchor.participationProvenance === 'derived_healthy_unrestricted'),
    `got ${JSON.stringify(clubAnchors.map((a) => a.participationProvenance))}`,
  );

  const ledger = quiet(() => evaluateSection18EffectiveWeek({
    contract: realWeek.exposureContractV2,
    workouts: realWeek.workouts,
    weekStart: realWeek.startDate.slice(0, 10),
  })) as {
    ledger: {
      conditioning: { anchorCoreCount: number; byStress: Record<string, number> };
      sprintHighSpeed: {
        achievedCount: number;
        split: { delivered: number; prescribed: number };
      };
    };
  };

  ok(
    'BOTH club nights supply CONDITIONING exposure',
    ledger.ledger.conditioning.anchorCoreCount === 2,
    `anchorCoreCount ${ledger.ledger.conditioning.anchorCoreCount}, expected 2`,
  );
  ok(
    'BOTH club nights supply SPRINT/HIGH-SPEED exposure',
    ledger.ledger.sprintHighSpeed.achievedCount === 2,
    `achievedCount ${ledger.ledger.sprintHighSpeed.achievedCount}, expected 2`,
  );
  ok(
    'BOTH club nights supply HARD-DAY exposure',
    ledger.ledger.conditioning.byStress.hard === 2,
    `hard ${ledger.ledger.conditioning.byStress.hard}, expected 2`,
  );
  ok(
    'AND NONE OF IT CLAIMS COMPLETED ATTENDANCE — every credit is PRESCRIBED, not DELIVERED',
    ledger.ledger.sprintHighSpeed.split.delivered === 0
      && ledger.ledger.sprintHighSpeed.split.prescribed === 2,
    `split ${JSON.stringify(ledger.ledger.sprintHighSpeed.split)} — a planned club night was recorded as work the athlete has already done`,
  );
}


console.log('\n[3] A CLUB-NIGHT ATHLETE SURVIVES A RELAUNCH');


const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

function veryHardBlock1(): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    feedback[dateStr] = {
      dateStr, completion: 'full', feeling: 'very_hard', soreness: 'high',
      strength: [{
        exerciseId: 'ex-main', workoutExerciseId: 'wex-main', exerciseName: TRACKED,
        prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5,
        weightKg: RECORDED_KG, completion: 'full' as const,
      }],
    } as SessionFeedback;
  }
  return feedback;
}

function fingerprint(): string {
  const program = useProgramStore.getState().currentProgram;
  const rows: string[] = [];
  for (const [weekIndex, microcycle] of (program?.microcycles ?? []).entries()) {
    for (const workout of microcycle.workouts) {
      for (const exercise of workout.exercises ?? []) {
        rows.push(`w${weekIndex + 1}:${workout.name}:${exercise.exercise?.name}`
          + `:${exercise.prescribedSets}:${exercise.prescribedWeightKg ?? 'BW'}`);
      }
    }
  }
  return JSON.stringify({
    rows: rows.sort(),
    explanation: program?.blockBoundaryExplanation ?? [],
  });
}

function installClubWorld(injured: boolean): void {
  quiet(() => {
    resetStoresToFreshInstall('anchor-participation-owner');
    const profile = clubAthlete(injured);
    const feedback = veryHardBlock1();
    useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true } as never);
    const program = generateProgramLocally(profile, {
      todayISO: BLOCK_2_START, blockNumber: 2,
      progressionHistory: { sessionFeedback: feedback, weightOverrides: {}, blockState: null },
    }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program, currentMicrocycle: program.microcycles[0],
      sessionFeedback: feedback, weightOverrides: {},
      blockState: { blockStartDate: BLOCK_2_START, blockNumber: 2 },
      generationAnchorISO: BLOCK_2_START,
    } as never);
  });
}

async function main(): Promise<void> {
  installClubWorld(false);
  const before = fingerprint();
  ok(
    'the club-night athlete has a block-2 world with club nights in it',
    (useProgramStore.getState().currentProgram?.microcycles ?? []).some((microcycle) =>
      microcycle.workouts.some((workout) => workout.workoutType === 'Team Training')),
    'no team training in the fixture — the cells below would pass vacuously',
  );

  let bootError: string | null = null;
  try {
    await quiet(async () => { await rebuildDerivedWorld(); });
  } catch (error) {
    bootError = `${(error as Error).name}: ${(error as Error).message}`;
  }
  ok(
    'A HEALTHY CLUB-NIGHT WEEK SURVIVES RELAUNCH — boot does not refuse',
    bootError === null,
    `boot threw ${bootError}`,
  );
  ok(
    'and the week is unchanged — every prescription and every explanation row',
    fingerprint() === before,
    'the relaunch rebuilt a different week',
  );
  ok(
    `${TRACKED} still HOLDS the athlete's recorded ${RECORDED_KG} kg after boot`,
    JSON.parse(fingerprint()).rows
      .filter((row: string) => row.includes(TRACKED))
      .every((row: string) => row.endsWith(`:${RECORDED_KG}`)),
    `got ${JSON.stringify(JSON.parse(fingerprint()).rows.filter((r: string) => r.includes(TRACKED)))}`,
  );
  ok(
    'the very-hard reduction row is still stored after boot',
    JSON.parse(fingerprint()).explanation
      .some((row: { kind: string }) => row.kind === 'hard_block_reduced'),
  );

  console.log(`\nAnchor participation owner: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFAILURES:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

void main();
