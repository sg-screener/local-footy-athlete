/**
 * THE CANONICAL BLOCK-ACCEPTANCE DOOR FOR SUITES.
 *
 * ⚠ **NOT "TURN HISTORY WRITES ON".** Sam, 2026-08-17: *"Tests that simulate
 * several accepted blocks must pass through the canonical
 * block-acceptance/history-writing door. Do not merely enable history writes on
 * every speculative generation call."*
 *
 * An earlier cut of this migration set `recordSelections: true` on every
 * `generateProgramLocally` call inside the affected suites. That is the wrong
 * shape twice over: it makes a suite's PROBES write history (the exact defect
 * that made a restored exclusion come back in no block at all), and it spreads
 * the acceptance decision across dozens of call sites where the next reader
 * cannot see it.
 *
 * There is ONE door here. A suite either ACCEPTS a block — which authors it and
 * records what it selected, exactly as production acceptance does — or it
 * PROBES, which writes nothing. The two are different function names so a cell
 * cannot blur them by accident.
 */

import { generateProgramLocally } from '../../services/api/generateProgram';
import { useBlockSelectionHistoryStore } from '../../store/blockSelectionHistoryStore';
import type { OnboardingData, TrainingProgram } from '../../types/domain';

type GenerateOptions = Parameters<typeof generateProgramLocally>[1];

/**
 * ACCEPT a block: author it and record what it selected.
 *
 * This is what a suite calls when it is walking an athlete through consecutive
 * blocks they actually trained.
 */
export function acceptBlock(
  profile: OnboardingData,
  options: GenerateOptions,
): TrainingProgram {
  return generateProgramLocally(profile, {
    ...options,
    recordSelections: true,
  }) as TrainingProgram;
}

/**
 * PROBE a block: author it and record NOTHING.
 *
 * Stated explicitly rather than left as the default, so a cell that means "just
 * look" says so and a reader never has to check the default to know which it is.
 */
export function probeBlock(
  profile: OnboardingData,
  options: GenerateOptions,
): TrainingProgram {
  return generateProgramLocally(profile, {
    ...options,
    recordSelections: false,
  }) as TrainingProgram;
}

/**
 * Clear the recorded selection history.
 *
 * ⚠ **CALL THIS BETWEEN INDEPENDENT SCENARIOS.** The history is a real persisted
 * store, so without a reset one athlete's accepted blocks become the next
 * athlete's past and "least recently used" answers with another world's data.
 */
export function resetBlockSelectionHistory(): void {
  useBlockSelectionHistoryStore.setState({ selections: [] } as never);
}

/** How many records exist — the liveness controls read this. */
export function recordedSelectionCount(): number {
  return useBlockSelectionHistoryStore.getState().selections.length;
}
