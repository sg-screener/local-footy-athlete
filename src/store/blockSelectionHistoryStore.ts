import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  selectionSeatIndex,
  type BlockExerciseSelection,
} from '../rules/blockExerciseSelection';
import { asyncStorageCompat } from './asyncStorageCompat';
import { registerQuarantineBoundary } from './refusedPayloadQuarantine';
import { normalizeConditioningSelectionHistory, type BlockConditioningSelection } from '../rules/conditioningSelection';

/**
 * BLOCK SELECTION HISTORY — the durable carrier for WHICH EXERCISE each block
 * actually chose, per movement slot.
 *
 * ## ⚠ IT EXISTS BECAUSE REPLAY WAS REWRITING THE ATHLETE'S PAST
 *
 * `scripts/trace-selection-history.ts` drove the real boot and measured it: an
 * athlete who built a block on a commercial-gym answer and then lost the rack
 * got a DIFFERENT block back after relaunching —
 * `hinge: Trap Bar Deadlift → Deadlift`, `squat: Front Squat → Leg Press`.
 * Nothing was reloaded; it was re-derived, because `program-store` persists six
 * INPUT keys and no exercise identity appears in the persisted bytes at all.
 *
 * ## WHAT IT IS NOT
 *
 * ⚠ **NOT A PROGRAM SNAPSHOT.** Sam: *"Store the decision/history, not another
 * complete program snapshot."* One flat row per slot per block — block identity,
 * slot, group, role, canonical identity. No dose, no sets, no load: loads
 * already have an owner in `blockBoundaryProgression`, which reads recorded
 * history by exercise name, and a second copy here would be a second owner.
 *
 * ⚠ **NOT THE DECISION LEDGER.** That store is append-only and typed to
 * `AthleteDecision` — things the ATHLETE chose. Which exercise a block selected
 * is the APP's decision, so it does not belong in the athlete's ledger.
 *
 * ⚠ **NOT READ FROM INSIDE THE DOMAIN SELECTOR.** *"No hidden store reads inside
 * the domain selector."* `decideExerciseForBlock` is pure and takes
 * `previousSelection` / `recentSelections` as arguments; generation reads this
 * store and passes them in. Boot and rollover feed the same history explicitly.
 */

interface BlockSelectionHistoryState {
  /** Every recorded selection, most recent block FIRST. */
  selections: BlockExerciseSelection[];
  conditioningSelections: BlockConditioningSelection[];
  clear: () => void;
}

export const BLOCK_SELECTION_HISTORY_KEY = 'block-selection-history-store';

/** How many blocks of history are kept. Enough to answer "least recently used". */
export const BLOCK_SELECTION_HISTORY_DEPTH = 12;

registerQuarantineBoundary(BLOCK_SELECTION_HISTORY_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: { selections?: unknown[]; conditioningSelections?: unknown[] };
      }).state;
      return (state?.selections ?? []).length > 0 || (state?.conditioningSelections ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

export const useBlockSelectionHistoryStore = create<BlockSelectionHistoryState>()(
  persist(
    (set) => ({
      selections: [],
      conditioningSelections: [],
      clear: () => set({ selections: [], conditioningSelections: [] }),
    }),
    {
      name: BLOCK_SELECTION_HISTORY_KEY,
      storage: createJSONStorage(() => asyncStorageCompat),
      partialize: (state) => ({ selections: state.selections, conditioningSelections: state.conditioningSelections }) as BlockSelectionHistoryState,
    },
  ),
);

/** Read canonical recorded history. Treat the returned rows as frozen. */
export function blockSelectionHistory(): readonly BlockExerciseSelection[] {
  return useBlockSelectionHistoryStore.getState().selections.map((selection) => ({
    ...selection,
    seatIndex: selectionSeatIndex(selection),
  }));
}

export function blockConditioningSelectionHistory(): readonly BlockConditioningSelection[] {
  return normalizeConditioningSelectionHistory(useBlockSelectionHistoryStore.getState().conditioningSelections ?? []);
}

/**
 * HAS THIS BLOCK EVER BEEN RECORDED? — the question that separates a door
 * which AUTHORS a block from one which merely REPLAYS it.
 *
 * A boot regenerates the whole program on every launch. That regeneration is a
 * re-derivation, not a decision, so it may record a block nobody has recorded
 * yet (otherwise every launch would rotate a never-authored block freely) but it
 * may never REPLACE an existing row. Without this question the two cases are
 * indistinguishable at the call site and the boot silently re-authors the past —
 * measured 2026-08-18, when a reversible `today_only` exclusion was laundered
 * into a permanent generation input and the athlete's Back Squat was destroyed.
 */
export function blockHasRecordedSelections(blockStartISO: string): boolean {
  if (!blockStartISO) return false;
  return useBlockSelectionHistoryStore
    .getState()
    .selections.some((entry) => entry.blockStartISO === blockStartISO);
}

/**
 * Record what a block selected.
 *
 * ⚠ **RE-RECORDING A BLOCK REPLACES THAT BLOCK'S ROWS, IT DOES NOT APPEND.**
 * A block can legitimately be authored more than once — a rebuild, a rollover
 * re-run, a coach edit — and appending would make one block look like several
 * and corrupt "least recently used" with phantom entries. Identity is
 * `blockStartISO`, not the block NUMBER, so a renumbering cannot split one block
 * into two histories.
 */
export function recordBlockSelections(
  blockStartISO: string,
  selections: readonly BlockExerciseSelection[],
  conditioningSelections?: readonly BlockConditioningSelection[],
): void {
  if (!blockStartISO) return;
  useBlockSelectionHistoryStore.setState((state) => {
    const withoutThisBlock = state.selections
      .filter((entry) => entry.blockStartISO !== blockStartISO)
      .map((selection) => ({
        ...selection,
        seatIndex: selectionSeatIndex(selection),
      }));
    const canonicalSelections = selections.map((selection) => ({
      ...selection,
      seatIndex: selectionSeatIndex(selection),
    }));
    const next = [...canonicalSelections, ...withoutThisBlock];
    // Newest first, and bounded — an unbounded history is a growing payload for
    // a question that only ever looks back a few blocks.
    next.sort((a, b) => b.blockStartISO.localeCompare(a.blockStartISO));
    const blocks: string[] = [];
    const kept = next.filter((entry) => {
      if (!blocks.includes(entry.blockStartISO)) blocks.push(entry.blockStartISO);
      return blocks.indexOf(entry.blockStartISO) < BLOCK_SELECTION_HISTORY_DEPTH;
    });
    const nextConditioning = conditioningSelections === undefined ? (state.conditioningSelections ?? [])
      : [...conditioningSelections, ...(state.conditioningSelections ?? []).filter(entry => entry.blockStartISO !== blockStartISO)];
    const conditioningBlocks = [...new Set(nextConditioning.map(entry => entry.blockStartISO))].sort().reverse()
      .slice(0, BLOCK_SELECTION_HISTORY_DEPTH);
    return { selections: kept, conditioningSelections: nextConditioning.filter(entry => conditioningBlocks.includes(entry.blockStartISO)) };
  });
}

/**
 * The recorded selections for one slot, most recent block first — the shape
 * `decideExerciseForBlock` takes as `recentSelections`.
 *
 * `beforeBlockStartISO` scopes it to blocks STRICTLY BEFORE the one being
 * authored, so re-authoring a block never lets it see its own previous answer
 * and retain against itself.
 */
export function recentSelectionsForSlot(args: {
  history: readonly BlockExerciseSelection[];
  slot: string;
  seatIndex?: number;
  beforeBlockStartISO: string;
}): readonly BlockExerciseSelection[] {
  const seatIndex = args.seatIndex ?? 0;
  return args.history
    .filter((entry) => entry.slot === args.slot
      && selectionSeatIndex(entry) === seatIndex
      && entry.blockStartISO < args.beforeBlockStartISO)
    .sort((a, b) => b.blockStartISO.localeCompare(a.blockStartISO));
}
