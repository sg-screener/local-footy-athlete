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
import { exerciseSessionFamily } from '../rules/exerciseSessionFamily';
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
  if (plan.omissions.length > 0) {
    // NAMED, not counted. An omission is work the athlete is not doing, and
    // "1 exercise removed" tells them nothing about what to make up.
    parts.push(`${plan.omissions.join(', ')} left out — nothing safe was available`);
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
}): { changed: boolean; message: string } {
  const before = [...args.before];
  const after = [...args.after];
  const gone = before.filter((name) => !after.includes(name));
  const arrived = after.filter((name) => !before.includes(name));
  const changed = gone.length > 0 || arrived.length > 0 || before.length !== after.length;
  // A ROW THAT LEFT IS ONLY AN OMISSION IF NOTHING ARRIVED FOR IT. Pairing by
  // count rather than by identity is deliberate: the ladder does not promise a
  // one-to-one mapping and inventing one would name the wrong exercise.
  const substitutionCount = Math.min(gone.length, arrived.length);
  const omissions = gone.slice(substitutionCount);
  return {
    changed,
    message: injuryRecompositionMessage({
      plan: {
        unsafeRows: gone,
        substitutions: Array.from({ length: substitutionCount }, (_, index) => ({
          from: gone[index]!,
          to: { name: arrived[index]! } as unknown as TapSwapChoice,
        })),
        omissions,
      } as InjuryRecompositionPlan,
      remainingUnsafe: args.remainingUnsafe,
      trainingPaused: args.trainingPaused,
      // R-103's disclosure, from the REAL rows this function was handed.
      untrainedInWords: untrainedPatternsInWords({ before, after }),
    }),
  };
}
