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
import { compileCanonicalAthleteEditedContract } from './canonicalWeeklyAthleteEditCompiler';

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
  if (!args.workouts) return args.contract;
  // Contract arithmetic belongs to the same semantic athlete-edit compiler as
  // visible placement. This adapter remains only because derived-week callers
  // still consume the historical contract-shaped API.
  return compileCanonicalAthleteEditedContract({
    contract: args.contract,
    workouts: args.workouts,
    weekStartISO: args.weekStart,
    constraints: args.userRemovalConstraints,
  });
}

/** Compatibility name for existing non-fixture callers and old diagnostics. */
export function deriveWeekContract(
  args: RemovalAdjustedWeekContractInput,
): WeeklyExposureContractV2 {
  return applyRemovalLedgerToWeekContract(args);
}
