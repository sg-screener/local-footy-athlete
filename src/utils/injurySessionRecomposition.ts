/**
 * WHAT AN INJURY ACTUALLY DOES TO THE SESSIONS THE ATHLETE CAN ALREADY SEE.
 *
 * Sam, 2026-08-19: *"Delete the false-success path. Real safe recomposition
 * using the approved fallback ladder. Honest omission/refusal when nothing safe
 * exists. **Never say 'safely recomposed' unless visible content actually
 * changed appropriately.**"*
 *
 * ── THE FALSE SUCCESS, MEASURED (`npm run probe:injury-recompose`) ─────────
 *
 * Real athlete, real off-season session, declaring three different injuries
 * through the real door:
 *
 * ```
 * Knee/6        door: ok=true changedProgram=true
 *               "Injury restrictions are active and affected sessions were safely recomposed."
 *               VISIBLE CONTENT CHANGED: false
 *               rows STILL UNSAFE for this injury: ["RDLs","Bulgarian Split Squats"]
 *
 * Hamstring/8   level=training_paused, same sentence, same byte-identical week,
 *               same two unsafe rows.
 *
 * Shoulder/4    same sentence; ["Landmine Press","Barbell Row","Banded Dead Bug"]
 *               still on the day.
 * ```
 *
 * **The claim was true about the wrong thing.** `visibleProgramChanged` comes
 * from the accepted-state transaction, which reports that STORED STATE moved — a
 * fact written, an overlay published. The athlete's rows are a different
 * question, and it was never asked. A paused hamstring left both hinge and
 * single-leg work standing while the app said the session had been made safe.
 *
 * ── WHAT THIS MODULE OWNS ─────────────────────────────────────────────────
 *
 * The question the claim is actually about: for THIS session and THIS injury,
 * which rows are unsafe, what does the approved fallback ladder offer for each,
 * and what is left over. It decides nothing about persistence and writes
 * nothing — the caller applies the plan through the existing action owners, so
 * an injury substitution is the same `swap_exercise` an athlete's own tap makes
 * and an injury omission is the same removal.
 *
 * **THE LADDER IS `getTapSwapChoices` WITH `reason: 'injury_or_pain'`**, the
 * approved `SAFE_TRAINING_FALLBACK_TIERS` hierarchy — same-pattern, then similar
 * muscle group, then unaffected body area, then easy conditioning. No second
 * opinion about what is safe: `assessTapSwapCandidateSafety` decides both which
 * rows are unsafe and which replacements are allowed.
 *
 * WRITER: none. READER: `utils/programControlActions` (`set_injury_modifier`).
 * TEST: `src/__tests__/injuryRecompositionTests.ts`.
 */

import type { Workout } from '../types/domain';
import {
  assessTapSwapCandidateSafety,
  getTapSwapChoices,
  type TapSwapChoice,
  type TapSwapEnvironment,
  type TapSwapPrimaryInjury,
} from './tapSwapHierarchy';

export interface InjurySubstitution {
  /** The row that is unsafe, in the name the session carries. */
  from: string;
  /** The ladder's best legal answer for it. */
  to: TapSwapChoice;
}

export interface InjuryRecompositionPlan {
  /** Rows the injury makes unsafe. Empty means the session was already safe. */
  unsafeRows: string[];
  substitutions: InjurySubstitution[];
  /**
   * Unsafe rows the ladder had NOTHING legal for. Sam: *"honest omission ...
   * when nothing safe exists"* — they come OFF the session and are named, they
   * are not left on it under a sentence saying the session is safe.
   */
  omissions: string[];
  /** Rows the injury does not touch. */
  untouched: string[];
}

/** The rows a session carries, in the names it carries them under. */
export function sessionRowNames(workout: Workout | null | undefined): string[] {
  return (workout?.exercises ?? [])
    .map((row) => String(
      (row as { exercise?: { name?: string } }).exercise?.name
      ?? (row as { name?: string }).name
      ?? '',
    ).trim())
    .filter(Boolean);
}

/**
 * WHICH ROWS THIS INJURY MAKES UNSAFE. The one predicate, asked per row.
 *
 * This is also the ONLY question the honest claim rests on: a session with
 * nothing left in this list is safe, and one with something in it is not,
 * whatever any transaction reported about stored state.
 */
export function unsafeRowsForInjury(args: {
  workout: Workout | null | undefined;
  environment: TapSwapEnvironment;
}): string[] {
  return sessionRowNames(args.workout).filter(
    (name) => !assessTapSwapCandidateSafety(name, args.environment).safe,
  );
}

/**
 * THE PLAN. Nothing is applied here.
 *
 * A substitution is offered only when the ladder returns a NAMED exercise: a
 * `rest` fallback is not a replacement, it is the absence of one, and treating
 * it as a substitution is how "recomposed" starts meaning "emptied".
 */
export function planInjuryRecomposition(args: {
  workout: Workout | null | undefined;
  environment: TapSwapEnvironment;
  primaryInjury: TapSwapPrimaryInjury | null;
}): InjuryRecompositionPlan {
  const rows = sessionRowNames(args.workout);
  const unsafeRows = unsafeRowsForInjury({
    workout: args.workout,
    environment: args.environment,
  });
  const substitutions: InjurySubstitution[] = [];
  const omissions: string[] = [];
  // Every row that is staying, so the ladder cannot offer something the session
  // already has — and so an earlier substitution's choice cannot be chosen twice.
  const taken = rows.filter((name) => !unsafeRows.includes(name));
  for (const name of unsafeRows) {
    const choice = getTapSwapChoices({
      originalExercise: name,
      reason: 'injury_or_pain',
      environment: args.environment,
      primaryInjury: args.primaryInjury,
      existingExerciseNames: taken,
      // A rest fallback is NOT an answer to "what can they do instead"; asking
      // for one here would let an emptied session be reported as recomposed.
      recoveryAllowed: true,
    })
      /* ⚠ **A NAME IS THE WHOLE TEST, AND `kind !== 'rest'` WAS UNMUTATABLE.**
       * The first cut also filtered on `kind`, and inverting that clause
       * changed nothing in any world — `restChoice()` carries `name: null`, so
       * the name check had already refused it. A clause no mutation can reach is
       * a clause that is not doing the work its comment claims, so it is gone
       * and the property is stated here instead: **a choice with no name is not
       * a replacement**, and rest is the only choice the ladder builds that way. */
      .find((candidate) => Boolean(candidate.name)
        // ⚠ **AND NOT SOMETHING THIS SESSION IS ALREADY GETTING.** `taken` is
        // handed to the ladder as `existingExerciseNames`, and the ladder's
        // RECOVERY fallback does not read it — it is a fixed answer. Measured: a
        // shoulder injury recomposed a session into `Goblet Squat, Easy Bike,
        // Easy Bike`, two identical conditioning rows the athlete would do once.
        // Filtering here rather than inside the ladder keeps the fallback's job
        // ("what is safe") separate from this one's ("what does THIS session
        // still need").
        && !taken.some((name) => name.toLowerCase() === candidate.name!.toLowerCase()));
    if (choice?.name) {
      substitutions.push({ from: name, to: choice });
      taken.push(choice.name);
      continue;
    }
    omissions.push(name);
  }
  return {
    unsafeRows,
    substitutions,
    omissions,
    untouched: rows.filter((name) => !unsafeRows.includes(name)),
  };
}

/**
 * THE SENTENCE, DERIVED FROM WHAT ACTUALLY HAPPENED TO THE ROWS.
 *
 * Sam's rule stated as a function: **"safely recomposed" is reachable only when
 * something was substituted AND nothing unsafe is left.** Every other world
 * gets a sentence that says what it really is — an omission, a refusal, or a
 * session that needed no change.
 *
 * `remainingUnsafe` is measured on the session AFTER the plan was applied, by
 * the caller, from the real week — never predicted from the plan, because a
 * prediction is what the deleted claim was.
 */
export function injuryRecompositionMessage(args: {
  plan: InjuryRecompositionPlan;
  remainingUnsafe: readonly string[];
  trainingPaused: boolean;
}): string {
  const { plan } = args;
  if (args.remainingUnsafe.length > 0) {
    // THE HONEST REFUSAL. Nothing safe could be found for these, and they could
    // not be taken off either — so the athlete is told which rows to leave.
    return `Injury restrictions are active, but ${args.remainingUnsafe.join(', ')} `
      + 'could not be made safe. Skip those and check with a physio.';
  }
  if (plan.unsafeRows.length === 0) {
    return args.trainingPaused
      ? 'Affected training is paused until you get medical or physio advice. '
        + 'Nothing on this session needed changing.'
      : 'Injury restrictions are active. Nothing on this session needed changing.';
  }
  const parts: string[] = [];
  if (plan.substitutions.length > 0) {
    parts.push(`${plan.substitutions.length} exercise${plan.substitutions.length === 1 ? '' : 's'} swapped for a safe option`);
  }
  if (plan.omissions.length > 0) {
    // NAMED, not counted. An omission is work the athlete is not doing, and
    // "1 exercise removed" tells them nothing about what to make up.
    parts.push(`${plan.omissions.join(', ')} left out — nothing safe was available`);
  }
  return `Injury restrictions are active. ${parts.join('; ')}.`;
}
