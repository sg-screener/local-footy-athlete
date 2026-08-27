/**
 * Injury review is a projection of the same pure stage the weekly compiler
 * executes. It does not select replacements or build an alternative session.
 * Strength swaps, paused work and conditioning changes remain distinct.
 * Guard: test:session-injury-review (preview dose, no writes, accept/restart).
 */
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { isRedFlagInjurySeverity, injuryWithholdingExplanation } from '../rules/injuryWithheldRows';
import { compileSessionInjuryPreview } from './programControlActions';
import {
  sessionRowNames,
  untrainedPatternsInWords,
} from './injurySessionRecomposition';
import type { TapSwapHierarchyTier } from './tapSwapHierarchy';
import type { AddCandidate } from './addExerciseCandidates';

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
  /** Component changes are separate from the strength fallback ladder. */
  conditioningChanges: Array<{ from: string | null; to: string | null }>;
  /** Exact before/after changes on an improving injury, never fake swaps. */
  restored: string[];
  withdrawn: string[];
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
  const preview = compileSessionInjuryPreview(args);
  const trainingPaused = args.constraint.adjustmentLevel === 'training_paused';
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
    conditioningChanges: [] as SessionInjuryReview['conditioningChanges'],
    restored: [] as string[],
    withdrawn: [] as string[],
    paused: [] as SessionInjuryProposedChange[],
    added: [] as AddCandidate[],
    adjustmentSummary: null as string | null,
    untouched: [] as string[],
    untrainedInWords: [] as string[],
    nothingChanges: true,
  };

  if (!preview) {
    return {
      ...empty,
      headline: 'There is no session on this day to change.',
      approveLabel: 'Save this injury',
    };
  }

  const { before: workout, plan, adjustment } = preview;
  const before = sessionRowNames(workout);
  const after = sessionRowNames(preview.workout);
  const oldConditioning = workout.conditioningBlock?.options.map(option => option.title) ?? [];
  const nextConditioning = preview.workout.conditioningBlock?.options.map(option => option.title) ?? [];
  const conditioningChanges = Array.from({ length: Math.max(oldConditioning.length, nextConditioning.length) }, (_, index) => ({
    from: oldConditioning[index] ?? null, to: nextConditioning[index] ?? null,
  })).filter(change => change.from !== change.to);
  const changes: SessionInjuryProposedChange[] = [
    ...plan.substitutions.filter(substitution => before.includes(substitution.from) &&
      after.includes(substitution.to.name)).map((substitution) => ({
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
  const paused: SessionInjuryProposedChange[] = plan.pausedRows.filter(name => before.includes(name)).map((name) => ({
    from: name,
    to: null,
    kind: 'paused' as const,
    tier: null,
    coversOriginalPattern: false,
    explanation: injuryWithholdingExplanation({ exercise: name, bodyPart, redFlag }),
  }));

  // Read the compiler's session-level additions, never run another selector.
  const added = adjustment?.added?.filter(candidate => !before.includes(candidate.name) && after.includes(candidate.name)) ?? [];
  const conditioningNames = new Set([...oldConditioning, ...nextConditioning]);
  const restored = after.filter(name => !before.includes(name) && !conditioningNames.has(name) &&
    !changes.some(change => change.to === name) && !added.some(candidate => candidate.name === name));
  const withdrawn = before.filter(name => !after.includes(name) && !conditioningNames.has(name) &&
    !changes.some(change => change.from === name) && !paused.some(change => change.from === name));
  const decisionCount = changes.length + paused.length + conditioningChanges.length + restored.length + withdrawn.length;
  const nothingChanges = decisionCount === 0;
  return {
    bodyPart,
    severity: args.constraint.severity,
    redFlag,
    trainingPaused,
    changes,
    conditioningChanges,
    restored,
    withdrawn,
    paused,
    added,
    adjustmentSummary: adjustment?.summary ?? null,
    untouched: before.filter(name => after.includes(name) && !paused.some(change => change.from === name) &&
      !changes.some(change => change.from === name) && !conditioningChanges.some(change => change.from === name)),
    untrainedInWords: nothingChanges
      ? []
      : untrainedPatternsInWords({ before, after }),
    nothingChanges,
    headline: reviewHeadline({ redFlag, nothingChanges, changes, paused, added, bodyPart,
      conditioningChanged: conditioningChanges.length > 0, restored, withdrawn }),
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
  conditioningChanged: boolean;
  restored: readonly string[];
  withdrawn: readonly string[];
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
  if (args.conditioningChanged) parts.push('adjust your conditioning');
  if (args.restored.length) parts.push(`bring back ${listInWords(args.restored)}`);
  if (args.withdrawn.length) parts.push(`take out ${listInWords(args.withdrawn)}`);
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
