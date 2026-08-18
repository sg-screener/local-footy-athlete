/**
 * THE WEEKLY POWER BUDGET — the power specialist's own decision, at last.
 *
 * ## WHY THIS FILE EXISTS (2026-08-19, seat `demolition`)
 *
 * This lived inside `section18AcceptedWeekGateway`, which meant the VALIDATOR
 * decided how much power the athlete's week could carry and stripped whatever
 * exceeded it. Sam's contract puts §18 on validation and refusal only, and puts
 * power with the strength work it belongs to: "Power belongs to authorised
 * strength work." So the decision moves to the authoring side, where the
 * specialist can decline to author beyond the budget rather than have a
 * downstream boundary take the work away again.
 *
 * WARNING — NOTHING ABOUT THE DECISION CHANGED IN THE MOVE. The budget
 * arithmetic, the deload law, the eligibility terms and the family-spread
 * preference are carried over exactly; only the OWNER moved. A behaviour change
 * smuggled inside an ownership change is the defect class this repo fights, so
 * it is not attempted here, and `test:weekly-power-budget` pins the numbers.
 *
 * ## THE LAW IT SERVES
 *
 * Sam, 2026-07-27, THE DELOAD LAW: "Power/speed: KEEP a small sharp dose ...
 * Power is not removed on a deload; a deload is not a reason to lose
 * sharpness." Three doors are therefore OUTSIDE the ineligibility terms — a
 * scheduled deload week, the optional week, and the low-readiness safety
 * reason. A bye recovery week, a beginner, a genuine training pause and an
 * injury prohibition all still remove power.
 */
import type { OnboardingData, Workout } from '../types/domain';
import {
  contractOffseasonSubphase,
  type Section18AuthorisedReduction,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import {
  canonicalContextSubphase,
  finaliseWorkoutAfterMutation,
} from '../utils/workoutCanonicalisation';
import {
  budgetedPowerSession,
  powerRows,
  withoutPowerRows,
} from './sessionRowCounting';

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function powerReductionReason(contract: WeeklyExposureContractV2): Section18AuthorisedReduction['reason'] {
  if (contract.safety.trainingPaused) return 'full_pause';
  if (contract.identity.weekKind === 'deload') return 'deload_policy';
  if (contract.identity.mode === 'optional_week') return 'optional_week_mode';
  if (contract.identity.mode === 'in_season_bye_recovery') return 'bye_recovery_mode';
  if (contract.safety.reasons.includes('low_readiness')) return 'low_readiness';
  if (contract.safety.prohibitedPower || contract.safety.prohibitedPowerFamilies.length >= 2) {
    return 'injury_restriction';
  }
  if (contract.identity.mode === 'practice_match_week') return 'practice_match_load';
  return 'game_load_protection';
}

function withPowerReduction(
  contract: WeeklyExposureContractV2,
  original: number,
  budget: number,
  detail: string,
): WeeklyExposureContractV2 {
  contract.authorisedReductions = contract.authorisedReductions.filter((entry) =>
    entry.metric !== 'power_primer_budget');
  if (budget < original) {
    contract.authorisedReductions.push({
      metric: 'power_primer_budget',
      originalApprovedTarget: original,
      reducedTarget: budget,
      reason: powerReductionReason(contract),
      scope: 'week',
      change: 'frequency',
      detail,
      provenance: 'live_typed_reduction',
    });
  }
  return contract;
}

export function weeklyPowerBudget(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  profile?: OnboardingData | null;
}): { contract: WeeklyExposureContractV2; workouts: Workout[]; budget: number; removed: number } {
  const contract = cloneContract(args.contract);
  const beginner = args.profile?.experienceLevel === 'Complete beginner';
  // THE DELOAD LAW (Sam, 2026-07-27): "Power/speed: KEEP a small sharp dose ...
  // Power is not removed on a deload; a deload is not a reason to lose
  // sharpness." Three terms are gone from this budget: a scheduled deload week,
  // the optional week (which IS a deloaded week), and the low_readiness safety
  // reason. All three are deload doors, and the law reaches every door.
  //
  // A bye recovery week is NOT a deload door and keeps its removal; a beginner,
  // a genuine training pause and an injury prohibition all still remove power.
  const ineligible = contract.power.eligible === false || beginner ||
    contract.identity.mode === 'in_season_bye_recovery' ||
    contract.safety.trainingPaused || contract.safety.prohibitedPower;
  const normalAnchors = contract.anchors.filter((anchor) =>
    anchor.participation === 'normal_unrestricted');
  const teamCount = normalAnchors.filter((anchor) => anchor.kind === 'team_training').length;
  const fixture = normalAnchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  const fieldLoadBudget = ineligible
    ? 0
    : fixture && teamCount >= 2
      ? 0
      : fixture || teamCount >= 2
        ? 1
        : 2;
  const budget = fieldLoadBudget;
  const fixtureDay = fixture?.dayOfWeek;
  // RULING 4a (Sam, 2026-08-06) — THE THIRD READER.
  //
  // `budgetedPowerSession`, not `hasPowerRow`. This selector is the WEEKLY
  // BUDGET owner, and the G-2 quality-lower session's authored jumps are
  // outside that budget: the Bible prescription that names them ("2x3 box
  // squats to high box + 2x3 vertical jumps") is game-aware BY DEFINITION,
  // because it exists precisely because the day is two out from a fixture.
  //
  // It was the last owner still asking the question its own way, and it was
  // the one that actually removed the jumps. Both of its exclusion terms fire
  // on the G-2 day and neither can ever be satisfied: `tooCloseToFixture` is
  // true for every day within two of the game (which is what G-2 MEANS), and
  // `anchorDay` is true because the placer puts this session on a team day. So
  // the session could not be kept at ANY budget — a week with no fixture at
  // all was the only world where the authored half survived.
  //
  // The predicate's own header says a second copy of it is the bug. This is
  // that copy retired: the finaliser decides what may be STRIPPED, the
  // evaluator's primer ledger decides what is COUNTED, and this selector
  // decides what COMPETES for the budget — three readers, one question.
  const candidates = args.workouts
    .filter(budgetedPowerSession)
    .map((workout, index) => ({
      workout,
      index,
      tooCloseToFixture: fixtureDay === undefined
        ? false
        : ((fixtureDay - workout.dayOfWeek + 7) % 7) <= 2,
      anchorDay: normalAnchors.some((anchor) => anchor.dayOfWeek === workout.dayOfWeek),
    }))
    .sort((a, b) =>
      Number(a.tooCloseToFixture) - Number(b.tooCloseToFixture) ||
      Number(a.anchorDay) - Number(b.anchorDay) ||
      a.workout.dayOfWeek - b.workout.dayOfWeek ||
      a.index - b.index);
  const keep = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const candidate of candidates) {
    if (keep.size >= budget || candidate.tooCloseToFixture || candidate.anchorDay) continue;
    const family = powerRows(candidate.workout)[0]?.power?.family;
    if (family && usedFamilies.has(family) && candidates.some((other) =>
      !keep.has(other.workout.id) && powerRows(other.workout)[0]?.power?.family !== family &&
      !other.tooCloseToFixture && !other.anchorDay)) continue;
    keep.add(candidate.workout.id);
    if (family) usedFamilies.add(family);
  }
  // THE STRIP. This used to delete a field — `({ powerBlock, ...rest }) => rest`
  // — which no owner could see: nothing recorded that content left, and the
  // workout's name and type could go on describing work that was gone. As rows,
  // a strip is an ordinary content mutation and goes back through the canonical
  // owner, so identity and §18 evidence are re-derived from what actually
  // survives.
  const workouts = args.workouts.map((workout) => {
    if (!budgetedPowerSession(workout) || keep.has(workout.id)) return { ...workout };
    return finaliseWorkoutAfterMutation(withoutPowerRows(workout), {
      phase: contract.identity.seasonPhase,
      offseasonSubphase: canonicalContextSubphase(
        contract.identity.seasonPhase,
        contractOffseasonSubphase(contract),
      ),
      weekKind: contract.identity.weekKind,
      profile: args.profile ?? undefined,
      planIntentValid: !!workout.planEntryId,
      referenceWorkout: workout,
      // The removal is the point; restoring a pattern here would undo it.
      restoreMissingPlanPatterns: false,
    }).workout;
  });
  // COUNTED, not merely present: the exempt session is outside the budget, so
  // it must not be reported as consuming it. The evaluator's primer ledger
  // reads the same predicate, which is what keeps the content and the verdict
  // agreeing by construction rather than agreeing until an anchor changes.
  const achieved = workouts.filter(budgetedPowerSession).length;
  contract.power.eligible = !ineligible;
  contract.power.plannerSelectedWeeklyBudget = budget;
  contract.power.achievedPrimerCount = achieved;
  contract.power.removalReason = ineligible
    ? beginner ? 'training_age_ineligible' : contract.power.removalReason ?? 'weekly_power_ineligible'
    : budget < 2 ? 'field_load_budget_reduction' : null;
  withPowerReduction(
    contract,
    2,
    budget,
    `Weekly selector budget=${budget}; normal anchors=${normalAnchors.map((anchor) => anchor.kind).join(',') || 'none'}.`,
  );
  return {
    contract,
    workouts,
    budget,
    removed: candidates.length - achieved,
  };
}
