/**
 * ACCEPTED CONTRACT READ ADAPTER.
 *
 * Fixture, readiness and illness identity are compiler output. This module no
 * longer reads calendar or source facts to rebuild that identity after the
 * compiler has spoken; doing so made stale output look correct and created a
 * second weekly-program author. The only retained read adjustment is the
 * athlete-removal ledger, because that ledger is an accepted decision applied
 * to the already-authored contract rather than a new scheduling decision.
 */
import type { UserRemovalConstraint, Workout } from '../types/domain';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import { applyAthleteRemovalTypedReduction } from './userRemovalConstraints';

/** Diagnostic compatibility surface; no product reader consumes it. */
export const lastTierFourDerivation: {
  weekStart: string | null;
  contract: WeeklyExposureContractV2 | null;
  status: string | null;
  repairs: string[];
  blockingViolations: string[];
} = { weekStart: null, contract: null, status: null, repairs: [], blockingViolations: [] };

export interface RemovalAdjustedWeekContractInput {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  workouts?: readonly Workout[];
  /** Retired compatibility inputs. They have no authority at this read seam. */
  profile?: unknown;
  markedDays?: unknown;
  temporarySourceFacts?: unknown;
}

/** Apply recorded athlete removals without re-authoring weekly identity. */
export function applyRemovalLedgerToWeekContract(
  args: RemovalAdjustedWeekContractInput,
): WeeklyExposureContractV2 {
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = (() => {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + 6);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      + `-${String(date.getDate()).padStart(2, '0')}`;
  })();
  const speaking = (args.userRemovalConstraints ?? []).filter((constraint) =>
    constraint.status === 'active' &&
    constraint.targetDate >= weekStart && constraint.targetDate <= weekEnd);
  if (speaking.length === 0 || !args.workouts) return args.contract;

  let result = args.contract;
  for (const constraint of speaking) {
    const alreadyTyped = (result.authorisedReductions ?? []).some((reduction) =>
      reduction.deletionIdentity === constraint.id);
    if (alreadyTyped) continue;
    result = applyAthleteRemovalTypedReduction({
      contract: result,
      workouts: args.workouts,
      weekStart,
      constraint,
    });
  }
  return result;
}

/** Compatibility name for existing non-fixture callers and old diagnostics. */
export function deriveWeekContract(
  args: RemovalAdjustedWeekContractInput,
): WeeklyExposureContractV2 {
  return applyRemovalLedgerToWeekContract(args);
}
