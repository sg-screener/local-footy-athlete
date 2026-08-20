/**
 * ONE REVIEW OF EVERY CHANGE AN INJURY PROPOSES, BEFORE ANY OF THEM LAND.
 *
 * Sam, 2026-08-20, the ruling this module is: *"Ask for the injured body area or
 * movement once. Find every affected exercise in the session. Apply the existing
 * approved safety ladder … Show one review of all proposed changes. Apply the
 * approved changes together."* And, in the same breath, the two boundaries:
 * *"Injury and ordinary Remove must remain separate. Do not create Remove
 * decisions for injury-withheld exercises. Never claim the session was safely
 * changed if nothing changed."*
 *
 * ## WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It adds the REVIEW and nothing else. Every question it asks was already
 * answered by an owner Sam has signed off:
 *
 *   which rows are affected   `unsafeRowsForInjury`      (one severity predicate)
 *   what to do about each     `planInjuryRecomposition`  (the approved ladder)
 *   what a withheld row says  `injuryWithholdingExplanation`
 *   whether it blocks         `isRedFlagInjurySeverity`  (R-115)
 *   the world to ask in       `resolveInjuryRecompositionInputs`
 *
 * ⚠ **IT INVENTS NO SAFETY RULE AND NO LADDER OF ITS OWN.** A review that
 * decided anything for itself would be a second authority over what is safe, and
 * the one thing worse than no review is a review that promises a change the
 * write then makes differently. This module reads the plan and renames its parts
 * for the athlete; that is the whole of it.
 *
 * ⚠ **THE PLAN IS BUILT FROM THE WRITE PATH'S OWN INPUTS.**
 * `resolveInjuryRecompositionInputs` is the same call `recomposeSessionForInjury`
 * makes, with the same pending constraint, so the review and the write see one
 * world. Measured elsewhere on 2026-08-20: a preview that re-derived its own
 * arguments disagreed with the delivered program in **40 of 90** prescriptions.
 *
 * ## NOTHING IS WRITTEN HERE, AND AN OMISSION IS STILL NOT A REMOVE
 *
 * R-115 stands untouched: a row the ladder has no answer for is **withheld**, and
 * withholding is a pure derivation `rules/injuryWithheldRows` performs at the
 * view doors from the injury FACT. This module reports such a row as
 * `kind: 'withheld'` and NEVER as a removal, so no surface downstream can read a
 * review row as an athlete Remove decision. The review's approval writes exactly
 * one thing — the injury fact, through `set_injury_modifier` — and that door
 * already refuses to touch `athletePreferencesStore.exclusions`.
 *
 * ## "NOTHING CHANGED" IS A FIRST-CLASS ANSWER
 *
 * `nothingChanges` is the state Sam's last sentence is about. When it is true
 * the review says so in those words, the approve button stops saying anything
 * about the session, and the caller must not render a success claim about rows.
 * The FINAL sentence the athlete reads after applying still comes from
 * `injuryRecompositionMessage`, which derives it from what actually landed —
 * this headline is about the PROPOSAL, and says so.
 *
 * WRITER: none, pure. READER: `screens/home/DayWorkoutScreenV2` (the Active
 * Session Injury flow). TEST: `test:session-injury-review`.
 */
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { isRedFlagInjurySeverity, injuryWithholdingExplanation } from '../rules/injuryWithheldRows';
import { resolveInjuryRecompositionInputs } from './programControlActions';
import {
  planInjuryRecomposition,
  sessionRowNames,
  untrainedPatternsInWords,
} from './injurySessionRecomposition';
import type { TapSwapHierarchyTier } from './tapSwapHierarchy';
import type { AddCandidate } from './addExerciseCandidates';
import { deriveInjurySessionAdjustment } from './injurySessionAdjustment';

/**
 * A ROW IS EITHER GETTING SOMETHING ELSE OR BEING PAUSED. There is no third
 * kind, and there is deliberately no `'removed'` — see R-115 above: the
 * accepted program keeps the row, only the view stops showing it.
 *
 * ⚠ **`'withheld'` IS NOW `'paused'`, AND THE RENAME IS THE RULING.** R-124:
 * only rungs 1-4 may produce a `'substitution'`, so this kind no longer means
 * "the whole ladder had nothing" — it means what Sam calls it, *"clearly state
 * which lower-body patterns are paused"*.
 */
export type SessionInjuryChangeKind = 'substitution' | 'paused';

export interface SessionInjuryProposedChange {
  /** The row, in the name the session carries it under. */
  from: string;
  /** The ladder's answer, or `null` when it had none and the row is withheld. */
  to: string | null;
  kind: SessionInjuryChangeKind;
  /** Which rung of the approved ladder answered. `null` for a withheld row. */
  tier: TapSwapHierarchyTier | null;
  /**
   * R-103: *"Accessory and adjacent-pattern fallbacks are PARTIAL coverage and
   * must be disclosed as such."* Derived from the tier rather than tabulated
   * again — rungs 1 and 2 are the `same_movement_pattern` tier and nothing else
   * keeps the athlete in the movement family.
   */
  coversOriginalPattern: boolean;
  /** Plain words for the athlete. No jargon, no exercise-science vocabulary. */
  explanation: string;
}

export interface SessionInjuryReview {
  /** The athlete's own word for the area, as they answered it. */
  bodyPart: string;
  severity: number;
  /** R-115's blocking case: 8-10 AND serious symptoms. */
  redFlag: boolean;
  trainingPaused: boolean;
  /**
   * ⚠ **SUBSTITUTIONS ONLY, AND THEY ARE THE ONLY THING DRAWN WITH AN ARROW.**
   * R-124, Sam: *"Do not show false arrows between unrelated exercises. List the
   * paused work and the adjusted session separately."* Every entry here came
   * from rungs 1-4 and really is a replacement for the row it names.
   */
  changes: SessionInjuryProposedChange[];
  /** The rows the injury pauses. A LIST, not a column of arrows. */
  paused: SessionInjuryProposedChange[];
  /**
   * R-124's session-level block — attached to the SESSION, named against
   * nothing. Empty when nothing was paused, or when nothing safe was left to
   * add.
   */
  added: AddCandidate[];
  /** The one line the active session shows afterwards. `null` when nothing paused. */
  adjustmentSummary: string | null;
  /** Rows this injury does not touch. Named so the review is of the SESSION. */
  untouched: string[];
  /** R-103's whole-session disclosure, in the athlete's register. */
  untrainedInWords: string[];
  /** Sam's last sentence, as a field. */
  nothingChanges: boolean;
  /** The one line at the top of the review. Never claims a change that isn't proposed. */
  headline: string;
  /** What the approve button says. It must not promise rows when there are none. */
  approveLabel: string;
}

function coversPattern(tier: TapSwapHierarchyTier): boolean {
  return tier === 'same_movement_pattern';
}

/** "A", "A and B", "A, B and C" — the register the rest of the injury unit uses. */
function listInWords(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
}

/**
 * THE REVIEW. Nothing is applied, nothing is stored, nothing is decided.
 *
 * The caller hands this straight to the screen and, on approval, hands the SAME
 * constraint to `set_injury_modifier` — which rebuilds this identical plan from
 * this identical owner and applies it in one pass.
 */
export function buildSessionInjuryReview(args: {
  date: string;
  constraint: ActiveInjuryConstraint;
}): SessionInjuryReview {
  const {
    workout, environment, primaryInjury, trainingPaused, weekExerciseNames,
    excludedByAthlete, profile,
  } = resolveInjuryRecompositionInputs(args);
  const redFlag = isRedFlagInjurySeverity(
    args.constraint.seriousSymptoms,
    args.constraint.severity,
  );
  const bodyPart = args.constraint.bodyPart;
  const empty = {
    bodyPart,
    severity: args.constraint.severity,
    redFlag,
    trainingPaused,
    changes: [] as SessionInjuryProposedChange[],
    paused: [] as SessionInjuryProposedChange[],
    added: [] as AddCandidate[],
    adjustmentSummary: null as string | null,
    untouched: [] as string[],
    untrainedInWords: [] as string[],
    nothingChanges: true,
  };

  if (!workout) {
    return {
      ...empty,
      headline: 'There is no session on this day to change.',
      approveLabel: 'Save this injury',
    };
  }

  const plan = planInjuryRecomposition({ workout, environment, primaryInjury });
  const changes: SessionInjuryProposedChange[] = [
    ...plan.substitutions.map((substitution) => ({
      from: substitution.from,
      to: substitution.to.name,
      kind: 'substitution' as const,
      tier: substitution.to.hierarchyTier,
      coversOriginalPattern: coversPattern(substitution.to.hierarchyTier),
      explanation: substitution.to.reason,
    })),
    /* ⚠ **WITHHELD, AND WORDED BY THE OWNER THAT WILL SHOW IT.** The athlete
     * approves this sentence here and reads the same sentence on the row
     * afterwards, because both come from `injuryWithholdingExplanation`. */
  ];

  /* ── PAUSED, AND KEPT OUT OF `changes` ON PURPOSE ──────────────────────────
   * A paused row has no partner, so it cannot sit in the same list as the ones
   * that do without the screen having to remember which entries get an arrow.
   * Two lists, and the screen renders two sections. */
  const paused: SessionInjuryProposedChange[] = plan.pausedRows.map((name) => ({
    from: name,
    to: null,
    kind: 'paused' as const,
    tier: null,
    coversOriginalPattern: false,
    explanation: injuryWithholdingExplanation({ exercise: name, bodyPart, redFlag }),
  }));

  /* ── AND THE BLOCK THAT GOES IN THEIR PLACE, DERIVED, NOT STORED ──────────
   * The review promises exactly what the view door will derive, because both
   * ask `chooseInjurySessionAdditions` with the same inputs from the same
   * owner (`resolveInjuryRecompositionInputs`). */
  /* ⚠ **THE SAME FUNCTION THE VIEW DOOR CALLS, WITH THE SAME INPUTS.** That is
   * the only way a review can be a promise: the door does not re-decide, it
   * re-derives, and both derivations are this one. */
  const adjustment = deriveInjurySessionAdjustment({
    workout,
    environment,
    profile,
    bodyPart,
    redFlag,
    weekExerciseNames,
    excludedByAthlete,
    pausedRowNames: plan.pausedRows,
  });
  const added = adjustment?.added ? [...adjustment.added] : [];

  /* The rows the session would carry if this plan were applied — a substitution
   * puts its answer in, a withheld row stays on the session but is marked, so it
   * is NOT dropped from the "after" set. That is the R-115 distinction expressed
   * arithmetically: an omission is not a deletion. */
  /* The rows the session would carry if this plan were applied. R-124 changed
   * the arithmetic on one side of it: a paused row is no longer in the "after"
   * set, because the athlete will not see it — Sam, 2026-08-21: *"The five
   * paused exercises appear in the review, but disappear from the active
   * workout after Apply."* The added block IS in it, so the untrained-pattern
   * sentence cannot name a pattern the block put back. */
  const before = sessionRowNames(workout);
  const substituted = new Map(
    plan.substitutions.map((substitution) => [substitution.from, substitution.to.name!]),
  );
  const pausedNames = new Set(plan.pausedRows);
  const after = [
    ...before.filter((name) => !pausedNames.has(name)).map((name) => substituted.get(name) ?? name),
    ...added.map((candidate) => candidate.name),
  ];

  const nothingChanges = changes.length === 0 && paused.length === 0;
  const decisionCount = changes.length + paused.length;
  return {
    bodyPart,
    severity: args.constraint.severity,
    redFlag,
    trainingPaused,
    changes,
    paused,
    added,
    adjustmentSummary: adjustment?.summary ?? null,
    untouched: plan.untouched,
    untrainedInWords: nothingChanges
      ? []
      : untrainedPatternsInWords({ before, after }),
    nothingChanges,
    headline: reviewHeadline({ redFlag, nothingChanges, changes, paused, added, bodyPart }),
    approveLabel: nothingChanges
      ? 'Save this injury'
      : `Apply ${decisionCount === 1 ? 'this change' : `these ${decisionCount} changes`}`,
  };
}

/**
 * THE ONE LINE AT THE TOP, AND THE ONE PLACE SAM'S LAST SENTENCE IS ENFORCED.
 *
 * *"Never claim the session was safely changed if nothing changed."* Every
 * branch below is checked against that: the only branch that says anything about
 * the session being made safe is the one where a substitution is actually
 * proposed, and it says **"would"**, because at review time nothing has landed.
 */
function reviewHeadline(args: {
  redFlag: boolean;
  nothingChanges: boolean;
  changes: readonly SessionInjuryProposedChange[];
  paused: readonly SessionInjuryProposedChange[];
  added: readonly AddCandidate[];
  bodyPart: string;
}): string {
  const area = args.bodyPart.toLowerCase();
  if (args.nothingChanges) {
    /* NOT "your session is safe" and NOT "recomposed" — the injury is real and
     * gets saved, this session simply had nothing in it to change. */
    return args.redFlag
      ? `Nothing on this session needs changing for your ${area}, but you should `
        + 'get medical or physio advice before training it again.'
      : `Nothing on this session needs changing for your ${area}.`;
  }
  const swapped = args.changes.filter((change) => change.kind === 'substitution');
  const parts: string[] = [];
  if (swapped.length > 0) {
    parts.push(`swap ${listInWords(swapped.map((change) => change.from))} for `
      + `${listInWords(swapped.map((change) => change.to!))}`);
  }
  /* ⚠ **THE PAUSED ROWS AND THE ADDED BLOCK ARE TWO CLAUSES, NEVER ONE.** The
   * sentence this replaces read *"swap A, B, C, D and E for V, W, X, Y and Z"*
   * over five pairings that had no relationship at all (R-124). It says what
   * each side actually is now, and the added half is only claimed when
   * something really was added. */
  if (args.paused.length > 0) {
    parts.push(`pause ${listInWords(args.paused.map((change) => change.from))}`);
    parts.push(args.added.length > 0
      ? `add ${listInWords(args.added.map((candidate) => candidate.name))} instead`
      : 'add nothing in their place — there was nothing safe left to add');
  }
  const head = `For your ${area}, this would ${parts.join(', and ')}.`;
  return args.redFlag
    ? `${head} Get medical or physio advice before training it again.`
    : head;
}
