/**
 * WHICH DOOR ACTIONS ARE DECISIONS — one pure place, one allow-list.
 *
 * `docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md` §5. The athlete's tap
 * door, `executeProgramControlAction`, fans out to five destinations and only
 * ONE of them reached the decision ledger (`applyPlanChange`, inside the
 * session-level path). Everything else wrote to a surface that
 * `rebuildDerivedWorld` empties — measured, not inferred:
 * `npm run tape:exercise-edit-durability` photographs an athlete's own exercise
 * removal landing (`ok: true`, `dateOverrides: 1`) and being GONE after a
 * relaunch, with the generated day back in its place.
 *
 * ── WHY ONE LEDGER KIND AND NOT ONE PER CAPABILITY ────────────────────────
 *
 * `types/decisionLedger.ts` states the law this module implements: the ledger
 * holds *"the door vocabulary, verbatim. A ledger entry never paraphrases the
 * decision it records."* `ProgramControlAction` IS the door vocabulary — 26
 * typed action kinds that the tap surface and (per the reassessment) the coach
 * both speak. So the ledger records that type, unchanged, under ONE kind.
 *
 * A kind per capability would be the ninth representation wearing a hat: every
 * new door capability would need a ledger kind, a replay arm and a translation
 * between them, and the translation is exactly where §3 of the reassessment
 * measured intent being lost by omission. There is nothing to translate here.
 *
 * ── WHY AN ALLOW-LIST, AND WHY IT IS THE OWNERSHIP BOUNDARY ───────────────
 *
 * One general kind carrying 26 action types is a trap if replay only handles
 * three of them: a future append would record a decision the boot silently
 * cannot reproduce, and the athlete would lose an edit that LOOKS durable —
 * strictly worse than today, where at least nothing claims otherwise.
 *
 * So the set of recorded action types is DECLARED here, and
 * `programControlDecisionTests` asserts the invariant that makes it safe:
 * **every type in this list has a replay arm, and every replay arm is in this
 * list.** The list grows only in a commit that teaches replay the new type.
 *
 * ── WHAT IS NOT HERE, AND WHY ─────────────────────────────────────────────
 *
 * Session-level actions (`move_session`, `bin_session`, `swap_session`,
 * `add_to_day`, `move_team_night`) are ABSENT deliberately: they already append
 * a `plan_change` inside `applyPlanChange`, and adding them here would append a
 * second decision for one act. Undo would then need two taps to undo one move.
 *
 * Injury, illness/readiness and setup answers are absent because they PERSIST
 * today in their own input slices (`programStore.partialize`). Putting them on
 * the ledger without removing those slices would make the representation count
 * WORSE — two stored representations of one input. That is the reassessment's
 * §8.3 staging, and it is a migration, not a line in this list.
 */

import type { AthleteDecision } from '../types/decisionLedger';
import type {
  ProgramControlAction,
  ProgramControlActionType,
} from '../utils/programControlActions';

/**
 * The door action types the ledger records, and therefore the ones an athlete
 * can undo and a relaunch reproduces.
 *
 * All three are the EXERCISE-LEVEL destination, which shares one write path
 * (`coachActions`' `replaceExerciseAtDate` / `addExerciseAtDate` /
 * `removeExerciseAtDate`, all landing in `applyProgramOverrideWrite`). They are
 * listed individually rather than matched by a name pattern because a pattern
 * is a claim about names, and this is a claim about DESTINATIONS.
 */
export const LEDGER_RECORDED_ACTION_TYPES = [
  'swap_exercise',
  'add_exercise',
  'remove_exercise',
] as const satisfies readonly ProgramControlActionType[];

export type LedgerRecordedActionType = (typeof LEDGER_RECORDED_ACTION_TYPES)[number];

export function isLedgerRecordedActionType(
  type: ProgramControlActionType,
): type is LedgerRecordedActionType {
  return (LEDGER_RECORDED_ACTION_TYPES as readonly string[]).includes(type);
}

/**
 * The decision for a door action, or `null` when this action is not one the
 * ledger records.
 *
 * VERBATIM IS THE WHOLE POINT — the action goes in unchanged. There is no
 * field mapping here and there must never be one: the moment this function
 * starts choosing which parts of the action to keep, it becomes a
 * representation boundary, and a representation boundary that drops a field
 * does it by OMISSION, silently, which is the defect class the reassessment
 * was written about (§3, the two meanings of `scope`).
 */
export function programControlDecisionFor(
  action: ProgramControlAction,
): AthleteDecision | null {
  if (!isLedgerRecordedActionType(action.type)) return null;
  return { kind: 'program_control', action };
}
