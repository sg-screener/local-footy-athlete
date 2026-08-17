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
import { recordAcceptedBlock, useProgramStore } from '../../store/programStore';
import { deriveStoredBlockStateFromProgram } from '../../utils/programBlockState';
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
  // ── WHAT EACH ACCEPTED BLOCK REQUIRED (Sam, 2026-08-17) ─────────────────
  //
  // Production acceptance records this, and this function's whole promise is to
  // do *"exactly as production acceptance does"*. It did not, and the gap was
  // invisible until the completion denominator started reading it: four suites
  // went red reporting that the boundary had stopped progressing anything, which
  // was TRUE of their worlds and false of the app.
  //
  // The map is READ before authoring — the denominator describes the block that
  // just ENDED — and the block being accepted records its own requirement after.
  // Same order, same store and same writer as the two production doors, so a
  // suite cannot drift from them.
  //
  // ⚠ **AN EXPLICIT `acceptedBlockRequirements` IN `options` WINS.** A suite
  // that wants to state a world where the previous block required N says so, and
  // this door must not overwrite it with the ambient store.
  const stated = (options as { progressionHistory?: { acceptedBlocks?: unknown } })
    ?.progressionHistory?.acceptedBlocks;
  const program = generateProgramLocally(profile, {
    ...options,
    recordSelections: true,
    ...(options?.progressionHistory
      ? {
        progressionHistory: {
          ...options.progressionHistory,
          acceptedBlocks: stated
            ?? useProgramStore.getState().acceptedBlocks ?? {},
        },
      }
      : {}),
  }) as TrainingProgram;

  recordAcceptedBlock({
    program,
    // The suites do not commit to the store, so the block identity is derived
    // from the program the same way both production doors derive it.
    blockState: deriveStoredBlockStateFromProgram(
      program,
      (options as { todayISO?: string })?.todayISO,
    ),
  });
  return program;
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
  // THE ACCEPTED-BLOCK REQUIREMENTS ARE THE SAME KIND OF CROSS-SCENARIO LEAK the
  // selection history is, and for the same reason: they are a real persisted
  // record of blocks an athlete accepted. Without this, one athlete's accepted
  // blocks become the next athlete's past and the completion gate answers with
  // another world's denominator.
  useProgramStore.setState({ acceptedBlocks: {} } as never);
}

/** How many records exist — the liveness controls read this. */
export function recordedSelectionCount(): number {
  return useBlockSelectionHistoryStore.getState().selections.length;
}
