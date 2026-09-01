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
 * opinion about what is safe.
 *
 * ⚠ **BUT THEY ARE TWO QUESTIONS, AND ONE PREDICATE WAS ANSWERING BOTH.** *"Must
 * this row come out"* is `injuryRequiresChange`, at Sam's 4-5 band (*"swap
 * obvious aggravators"*). *"May this be the replacement"* is
 * `assessTapSwapCandidateSafety`, at his 6-7 band (*"remove risky work through
 * the area"*, against 4-5's *"keep safe work in"*). Asking the second question
 * for both is what turned a 4/10 shoulder's upper day into `Goblet Squat, Easy
 * Bike`: every upper row is rated `caution`, so nothing upper could be a
 * replacement and the ladder had to leave the body region.
 *
 * WRITER: none. READER: `utils/programControlActions` (`set_injury_modifier`).
 * TEST: `src/__tests__/injuryRecompositionTests.ts`.
 */

import type { Workout } from '../types/domain';
import { diffSemanticDays, type SemanticDaySnapshot } from './programSemanticSnapshot';
import { exerciseSessionFamily } from '../rules/exerciseSessionFamily';
import {
  automaticExerciseRouteForIdentity,
  createAutomaticWeeklyExerciseSelector,
  realMovementSlotsForAutomaticExercise,
} from '../rules/automaticWeeklyExerciseSelection';
import { slotDayKindForPatterns, type SessionSlot } from '../rules/sessionSlotCoverage';
import {
  injuryRequiresChange,
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

/** A restriction/skip annotation is not a rewritten prescription. Compare the
 * same visible day on both sides; real load, sets, order and component changes
 * count, while the injury warning itself and presentation-only copy do not.
 */
export function visibleInjuryPrescriptionChanged(before: SemanticDaySnapshot, after: SemanticDaySnapshot): boolean {
  return diffSemanticDays(before, after).changes.some(change =>
    change.category !== 'presentation' &&
    !/(^|\.)(unavailableForInjury|createdAt|updatedAt)(\.|$)/.test(change.path));
}

/**
 * ── R-124: THE FOUR RUNGS THAT MAY SPEAK FOR ONE EXERCISE ─────────────────
 *
 * Sam, 2026-08-21: *"Preserve the existing ordered ladder through: 1. same
 * movement, 2. secondary compound, 3. accessory or isometric for the same
 * muscles, 4. safe adjacent pattern. **Those remain per-exercise
 * replacements.** If those stages find nothing safe, do not describe unrelated
 * upper-body work as replacing that specific lower-body exercise."*
 *
 * Rungs 1-2 carry the tier `same_movement_pattern`, rungs 3-4
 * `similar_muscle_group`. Rung 5 (`unaffected_body_area`) and rung 6
 * (`recovery_easy_conditioning`) are still WALKED and still answer the question
 * *"what is safe for this athlete today"* — they simply may no longer answer it
 * **in the name of one particular exercise**, which is what an arrow claims.
 *
 * ⚠ **MEASURED BEFORE THE CHANGE (`npm run probe:injury-review-pairings`).**
 * Knee 7/10, the athlete's real Monday: rungs 1-4 accepted **0 candidates for
 * all five blocked rows** while rung 5 accepted 44-73, so every arrow on that
 * screen was the loop handing each row the next unused name off one long list.
 * `Back Squat -> Chest-Supported DB Row` and `RDLs -> Single-Arm DB Floor Press`
 * would have swapped partners if the rows had been ordered differently, and two
 * of the five were already elsewhere in the same week.
 *
 * ⚠ **AND RUNGS 1-4 ARE NOT DEAD — THEY ARE WHY THIS IS A NARROW CHANGE.** The
 * same sweep at the same band: Lower back on Tue/Thu, Shoulder on Mon, Elbow on
 * Tue and Neck on Thu all get real per-exercise answers from them, and those
 * arrows are untouched. It is every LOWER-LIMB region on the lower-body day
 * where they are structurally empty, because Sam's matrix rates 0 of 9 squats,
 * 0 of 7 lunges and 0 of 8 hinges `good` for any lower limb.
 */
const PER_EXERCISE_TIERS: readonly TapSwapChoice['hierarchyTier'][] = [
  'same_movement_pattern',
  'similar_muscle_group',
];

export function isPerExerciseReplacementTier(
  tier: TapSwapChoice['hierarchyTier'] | null | undefined,
): boolean {
  return !!tier && PER_EXERCISE_TIERS.includes(tier);
}

export interface InjuryRecompositionPlan {
  /** Rows the injury makes unsafe. Empty means the session was already safe. */
  unsafeRows: string[];
  substitutions: InjurySubstitution[];
  /**
   * ── PAUSED (was `omissions`, and the rename is the ruling) ───────────────
   *
   * Unsafe rows that **rungs 1-4** had nothing legal for. Until R-124 this
   * meant "the whole ladder had nothing", which almost never happened because
   * rung 5 always had something — that is exactly how five arbitrary upper-body
   * pairings got drawn as swaps. It now means what Sam calls it: *"clearly
   * state which lower-body patterns are paused"*.
   *
   * ⚠ **STILL NOT A DELETION AND STILL NOTHING WRITTEN.** R-115's mechanism is
   * unchanged: the accepted program keeps every row and its load, and the day
   * the athlete sees is a read-time projection from the injury FACT. What
   * changed is only how that projection PRESENTS them — Sam, 2026-08-21: *"The
   * five paused exercises appear in the review, but disappear from the active
   * workout after Apply. Do not show five greyed-out SKIP cards."*
   */
  pausedRows: string[];
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
    (name) => injuryRequiresChange(name, args.environment),
  );
}

/**
 * MAY THIS CANDIDATE FILL THAT ROW'S SLOT? — the section question, asked once.
 *
 * ⚠ **AN UNPLACED ORIGINAL IMPOSES NO BOUNDARY.** A few names the app's own
 * vocabulary does not place (`Breathing Reset` is the one Sam named — the swap
 * surface mints it as a literal rather than drawing it from a pool) would
 * otherwise match nothing and be withheld for a reason that is really "we could
 * not classify this row". Not knowing the section is a reason to leave the
 * boundary off, never a reason to omit the row.
 *
 * ⚠ **AN UNPLACED CANDIDATE, HOWEVER, IS REFUSED** whenever the original IS
 * placed — the defect being closed here is a row arriving in a section nothing
 * had said it belonged to, and "we do not know" cannot be the evidence that it
 * belongs.
 */
function injuryReplacementKeepsSection(original: string, candidate: string): boolean {
  const section = exerciseSessionFamily(original);
  if (!section) return true;
  return exerciseSessionFamily(candidate) === section;
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
  /** Automatic rows already delivered elsewhere in this athlete-week. */
  existingAutomaticExerciseNames?: readonly string[];
}): InjuryRecompositionPlan {
  const rows = sessionRowNames(args.workout);
  const unsafeRows = unsafeRowsForInjury({
    workout: args.workout,
    environment: args.environment,
  });
  const substitutions: InjurySubstitution[] = [];
  const pausedRows: string[] = [];
  const automaticOnDay = (args.workout?.exercises ?? [])
    .filter((row) => row.section18Evidence?.provenance === 'composer_declaration')
    .map((row) => row.exercise?.name ?? '').filter(Boolean);
  const automaticElsewhere = [...(args.existingAutomaticExerciseNames ?? [])];
  for (const name of automaticOnDay) {
    const index = automaticElsewhere.indexOf(name);
    if (index >= 0) automaticElsewhere.splice(index, 1);
  }
  const keptAutomaticOnDay = automaticOnDay.filter((name) => !unsafeRows.includes(name));
  const weeklySelector = createAutomaticWeeklyExerciseSelector([
    ...automaticElsewhere, ...keptAutomaticOnDay,
  ]);
  const dayKind = slotDayKindForPatterns(
    args.workout?.strengthIntent?.plannedPatterns ?? [],
  );
  // Every row that is staying, so the ladder cannot offer something the session
  // already has — and so an earlier substitution's choice cannot be chosen twice.
  const taken = rows.filter((name) => !unsafeRows.includes(name));
  for (const name of unsafeRows) {
    const originalRow = args.workout?.exercises.find((row) => row.exercise?.name === name);
    const realOriginalSlot = realMovementSlotsForAutomaticExercise(name)[0];
    const requestedSlot = (originalRow?.section18Evidence?.slot
      ?? realOriginalSlot ?? 'lower_accessory') as SessionSlot;
    const requestedAsMain = originalRow?.section18Evidence?.role === 'main_strength';
    const automaticOriginal = originalRow?.section18Evidence?.provenance
      === 'composer_declaration';
    const weeklyCandidate = (identity: string) => ({
      identity,
      requestedSlot,
      dayKind,
      route: automaticExerciseRouteForIdentity(identity),
      requestedAsMain,
    } as const);
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
        /* ⚠ **A REPLACEMENT MUST STAY IN THE ROW'S OWN SECTION.**
         *
         * Sam, 2026-08-20: *"Breathing Reset must never appear inside Strength …
         * A Strength replacement must remain a legal Strength exercise. Mobility
         * / Warm-up and Conditioning movements cannot be used to fill a Strength
         * slot … If no safe Strength option exists after the full ladder, leave
         * it unavailable rather than inserting recovery work."*
         *
         * **THE LADDER ALREADY REFUSES THESE — THIS CATCHES THE ONES THAT NEVER
         * WENT THROUGH IT.** `getTapSwapChoices` appends its own
         * `recoveryChoice` after the ladder has spoken, and that fallback is two
         * hard-coded literals (`Easy Bike`, and `Breathing Reset` when there is
         * no bike) minted inside the swap surface with no notion of a section.
         * **MEASURED: that is exactly how a Strength row became a breathing
         * drill** — the ladder returned nothing for it, and the fallback filled
         * the slot. A row with no safe answer in its own section is WITHHELD
         * here, which is what Sam asked for and what R-115 already knows how to
         * show.
         *
         * The predicate is `rules/exerciseSessionFamily`, the same owner the
         * ladder asks and the same one the Add menu is built from. */
        && injuryReplacementKeepsSection(name, candidate.name!)
        // ⚠ **AND NOT SOMETHING THIS SESSION IS ALREADY GETTING.** `taken` is
        // handed to the ladder as `existingExerciseNames`, and the ladder's
        // RECOVERY fallback does not read it — it is a fixed answer. Measured: a
        // shoulder injury recomposed a session into `Goblet Squat, Easy Bike,
        // Easy Bike`, two identical conditioning rows the athlete would do once.
        // Filtering here rather than inside the ladder keeps the fallback's job
        // ("what is safe") separate from this one's ("what does THIS session
        // still need").
        && !taken.some((name) => name.toLowerCase() === candidate.name!.toLowerCase())
        && (!automaticOriginal
          || weeklySelector.canUse(weeklyCandidate(candidate.name!))));
    /* ⚠ **THE TIER IS THE WHOLE TEST NOW.** A rung-5 or rung-6 answer is still
     * a perfectly safe thing for this athlete to do today — it is simply not a
     * replacement FOR THIS ROW, and writing it into `{ from, to }` is what drew
     * the arrow. It reaches the athlete through the session-level adjustment
     * instead (`rules/injurySessionAdjustment`), attached to the SESSION and
     * named against nothing. */
    if (choice?.name && isPerExerciseReplacementTier(choice.hierarchyTier)) {
      substitutions.push({ from: name, to: choice });
      taken.push(choice.name);
      if (automaticOriginal) weeklySelector.accept(weeklyCandidate(choice.name));
      continue;
    }
    pausedRows.push(name);
  }
  return {
    unsafeRows,
    substitutions,
    pausedRows,
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
/** "A", "A and B", "A, B and C" — plain English, no counts, no Oxford comma. */
function listInWords(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
}

/**
 * ── WHAT THE ATHLETE IS NO LONGER TRAINING, IN WORDS THEY USE ──────────────
 *
 * R-103: *"Accessory and adjacent-pattern fallbacks are PARTIAL coverage and
 * must be disclosed as such — a typed, athlete-visible explanation naming what
 * was substituted and **what remains untrained**."*
 *
 * The patterns are compared BEFORE and AFTER from the rows themselves, so this
 * cannot claim coverage a substitution did not deliver, and it cannot invent a
 * gap the session does not have. The words are Sam's register — an athlete says
 * *"pressing"*, not `horizontal_push`.
 */
const PATTERN_IN_WORDS: Readonly<Record<string, string>> = {
  squat: 'squatting', bilateral_squat: 'squatting',
  hinge: 'deadlift-type work', bilateral_hinge: 'deadlift-type work',
  single_leg_knee: 'single-leg work', single_leg_hip: 'single-leg hip work',
  horizontal_push: 'pressing', vertical_push: 'overhead pressing',
  horizontal_pull: 'rowing', vertical_pull: 'pull-ups',
  carry: 'carries', core: 'core work', plyo: 'jumping',
  isolation_upper: 'arm and shoulder work', isolation_lower: 'lower-body accessory work',
};

export function untrainedPatternsInWords(args: {
  before: readonly string[];
  after: readonly string[];
}): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { finerPatternIdentityOf } = require('../rules/injuryFallbackLadder');
  const identities = (names: readonly string[]): Set<string> =>
    new Set(names.map((name) => String(finerPatternIdentityOf(name))));
  const kept = identities(args.after);
  const lost: string[] = [];
  for (const identity of identities(args.before)) {
    if (kept.has(identity)) continue;
    const words = PATTERN_IN_WORDS[identity];
    // A pattern with no athlete-facing word is not described in invented ones.
    if (words && !lost.includes(words)) lost.push(words);
  }
  return lost;
}

export function injuryRecompositionMessage(args: {
  plan: InjuryRecompositionPlan;
  remainingUnsafe: readonly string[];
  trainingPaused: boolean;
  /**
   * R-124's session-level block, by name. Supplied by the caller for the same
   * reason `untrainedInWords` is: the plan describes rows that LEFT, and what
   * ARRIVED is a property of the day, not of any row on it.
   */
  addedInWords?: readonly string[];
  /** R-103's partial-coverage disclosure, in the athlete's words. */
  untrainedInWords?: readonly string[];
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
    /* ⚠ **NAMED, NOT COUNTED — THE SAME RULE THE OMISSIONS ALREADY FOLLOWED.**
     * *"4 exercises swapped for a safe option"* tells the athlete nothing about
     * what they are now doing, and the mission is explicit that every changed
     * row gets an honest athlete-visible explanation. The names come from the
     * rows themselves, so the sentence cannot describe a swap that did not
     * land. A one-to-one *"X for Y"* is deliberately NOT claimed: the ladder
     * makes no such promise, and inventing the pairing would name the wrong
     * exercise. */
    const from = plan.substitutions.map((substitution) => substitution.from);
    const to = plan.substitutions
      .map((substitution) => substitution.to?.name)
      .filter((name): name is string => Boolean(name));
    parts.push(to.length > 0
      ? `${listInWords(from)} swapped for ${listInWords(to)}`
      : `${listInWords(from)} swapped for a safe option`);
  }
  if (plan.pausedRows.length > 0) {
    // NAMED, not counted. A paused row is work the athlete is not doing, and
    // "1 exercise removed" tells them nothing about what to make up.
    parts.push(`${listInWords(plan.pausedRows)} paused`);
    /* ⚠ **THE ADDED BLOCK IS ITS OWN CLAUSE AND IS NEVER PAIRED WITH THEM.**
     * R-124, Sam: *"Do not show false arrows between unrelated exercises."* An
     * arrow in a sentence is still an arrow. */
    const added = args.addedInWords ?? [];
    parts.push(added.length > 0
      ? `${listInWords(added)} added instead`
      : 'nothing safe was available to add in their place');
  }
  const message = `Injury restrictions are active. ${parts.join('; ')}.`;
  /* ⚠ **THE UNTRAINED SET IS PASSED IN, NOT DERIVED FROM THE PLAN.**
   * `describeVisibleInjuryChange` builds a SYNTHETIC plan out of the rows that
   * moved — it has no `untouched` list, and reading one here threw the first
   * time this ran. The caller that knows the real before and after is the one
   * that can answer this, so it is the one that does. */
  const untrained = args.untrainedInWords ?? [];
  return untrained.length > 0
    ? `${message} That means no ${listInWords(untrained)} this session.`
    : message;
}

/**
 * ── WHAT ACTUALLY CHANGED ON THE DAY, DESCRIBED FROM THE ROWS THEMSELVES ────
 *
 * Sam, 2026-08-19, ruling that a later fact must displace an athlete's choice
 * and *"tell the athlete exactly why"*. Honouring it moved the injury's
 * application into the fact's own settle (`quiescentBoot` re-applies active
 * injuries after the ledger replay), which left the door's own pass a no-op.
 *
 * **AND A NO-OP PASS REPORTED "Nothing on this session needed changing" OVER A
 * SESSION THAT HAD VISIBLY CHANGED** — measured by `test:session-change-sequence`
 * the moment the re-application landed. That is the same false claim this module
 * was built to delete, arriving from the opposite direction: the first version
 * said "safely recomposed" when nothing moved; this one said "nothing needed
 * changing" when everything did.
 *
 * So the claim is derived from the ROWS, before and after, and never from
 * whichever pass happened to do the work. A name that left and was replaced is
 * a substitution; a name that left with nothing taking its place is an omission.
 *
 * WRITER: none, pure. READER: `utils/programControlActions` (`set_injury_modifier`).
 */
export function describeVisibleInjuryChange(args: {
  before: readonly string[];
  after: readonly string[];
  remainingUnsafe: readonly string[];
  trainingPaused: boolean;
  /**
   * R-124 — the rows a rung 1-4 answer really did replace, by name. Anything
   * else that left is PAUSED. Omitted means none, which is the truthful default:
   * a caller that does not know the pairing must not have one invented for it.
   */
  substitutedRowNames?: readonly string[];
}): { changed: boolean; message: string } {
  const before = [...args.before];
  const after = [...args.after];
  const gone = before.filter((name) => !after.includes(name));
  const arrived = after.filter((name) => !before.includes(name));
  const changed = gone.length > 0 || arrived.length > 0 || before.length !== after.length;
  /**
   * ⚠ **THE COUNT-PAIRING IS GONE, AND DELETING IT IS HALF OF R-124.**
   *
   * This used to read `substitutionCount = min(gone, arrived)` and pair the
   * first N departures with the first N arrivals *"deliberately … by count
   * rather than by identity"*. That was a fair description of the world it was
   * written in, where every arrival really had displaced a row. It is a false
   * one now: the session-level block arrives for the SESSION, so pairing it by
   * count would rebuild the exact arrows Sam had removed one layer up —
   * *"5 gone, 3 arrived"* would print *"Vertical Jump swapped for Chest
   * Supported Row"*, which is not true of anything.
   *
   * **A CALLER THAT KNOWS THE PAIRING PASSES IT.** `substitutedNames` is the
   * rungs-1-4 set, which really is one-for-one; everything else that left is
   * paused and everything else that arrived is the block.
   */
  const substitutedNames = new Set(args.substitutedRowNames ?? []);
  const substitutions = gone
    .filter((name) => substitutedNames.has(name))
    .map((name) => ({ from: name, to: { name: null } as unknown as TapSwapChoice }));
  const pausedRows = gone.filter((name) => !substitutedNames.has(name));
  return {
    changed,
    message: injuryRecompositionMessage({
      plan: {
        unsafeRows: gone,
        substitutions,
        pausedRows,
        untouched: [],
      },
      remainingUnsafe: args.remainingUnsafe,
      trainingPaused: args.trainingPaused,
      addedInWords: arrived,
      // R-103's disclosure, from the REAL rows this function was handed.
      untrainedInWords: untrainedPatternsInWords({ before, after }),
    }),
  };
}
