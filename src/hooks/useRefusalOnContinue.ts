/**
 * WHEN a refusal is spoken. Not WHETHER — that belongs to the bound.
 *
 * THE DEFECT (Sam, device pass 2026-07-29). Every numeric onboarding answer
 * validated on each keystroke and rendered the refusal immediately. Typing "90"
 * put "That weight looks off. Enter a weight between 30 and 200 kg" on screen the
 * moment the "9" landed, and took it back when the "0" arrived. The athlete was
 * told they were wrong while they were still answering.
 *
 * The bound had not misjudged anything — "9" really is outside 30-200. The
 * mistake was asking it. A number mid-typing is not a submitted answer, so there
 * is nothing yet to accept or refuse.
 *
 * THE LAW, in one place so three fields on two screens cannot come to disagree:
 *
 *   1. A refusal is shown when the athlete presses Continue, never before.
 *   2. Editing an answer WITHDRAWS the refusal. It does not re-judge — a
 *      half-retyped number is a partial answer again, and re-judging is how
 *      keystroke validation creeps back in wearing a submitted flag.
 *   3. Continue is disabled for ABSENCE, never for refusal.
 *
 * Rule 3 is the one that gets shipped broken, and it is why this is a hook
 * rather than a `submitted` boolean per screen. If Continue stays disabled while
 * an answer is refused, the press that would reveal the refusal is impossible,
 * and the athlete is left at a dead button with no explanation — strictly worse
 * than the keystroke validation this replaces. An empty box, by contrast, has
 * nothing to say: the screen is simply unanswered, and the disabled CTA says so.
 *
 * NOTHING HERE KNOWS WHAT IS ACCEPTABLE. The `MeasurementValidation` values are
 * produced by the authored bounds (`onboardingNumericBounds`, `twoKmTimeTrial`)
 * and the commit still goes through the one ingress. This module only decides
 * whether the athlete has earned the answer yet.
 */

import { useCallback, useState } from 'react';

import type { MeasurementValidation } from '../data/numericBound';

/**
 * One entry per answer the screen collects. `null` means UNANSWERED — the box is
 * empty and the bound has not been asked. It is not the same as a refusal, and
 * conflating the two is what produces a screen that complains about a field the
 * athlete has not reached.
 */
export type AnswerValidations<K extends string> =
  Readonly<Record<K, MeasurementValidation | null>>;

export interface RefusalState<K extends string> {
  /** What to render under each input right now. `null` means say nothing. */
  readonly refusals: Readonly<Record<K, string | null>>;
  /** True only while an answer is MISSING. A refused answer stays pressable. */
  readonly continueDisabled: boolean;
  /** Every answer present and within its bound. */
  readonly accepted: boolean;
}

/**
 * The law, as a pure function — so it can be tested without a renderer, and so
 * the hook below is glue rather than behaviour.
 */
export function refusalState<K extends string>(
  validations: AnswerValidations<K>,
  revealed: boolean,
): RefusalState<K> {
  const refusals = {} as Record<K, string | null>;
  let anyAbsent = false;
  let allAccepted = true;

  for (const key of Object.keys(validations) as K[]) {
    const validation = validations[key];
    if (validation === null || validation === undefined) {
      anyAbsent = true;
      allAccepted = false;
      refusals[key] = null;
      continue;
    }
    if (!validation.ok) allAccepted = false;
    // A refusal exists whether or not it is spoken. `revealed` is the only thing
    // standing between the bound's judgement and the athlete's screen.
    refusals[key] = revealed && !validation.ok ? validation.message ?? null : null;
  }

  return { refusals, continueDisabled: anyAbsent, accepted: allAccepted };
}

export interface RefusalOnContinue<K extends string> extends RefusalState<K> {
  /** Call from every `onChangeText`. Editing withdraws a shown refusal. */
  readonly onAnswerEdited: () => void;
  /**
   * The Continue press. Returns true when every answer is accepted and the
   * screen should commit; returns false having REVEALED the refusals, which is
   * the only way they ever reach the screen.
   */
  readonly attemptContinue: () => boolean;
}

export function useRefusalOnContinue<K extends string>(
  validations: AnswerValidations<K>,
): RefusalOnContinue<K> {
  const [revealed, setRevealed] = useState(false);
  const state = refusalState(validations, revealed);

  const onAnswerEdited = useCallback(() => setRevealed(false), []);

  // Deliberately not memoised: it closes over this render's `validations`, and a
  // stale closure here would judge the previous keystroke's answer.
  const attemptContinue = (): boolean => {
    if (state.accepted) return true;
    setRevealed(true);
    return false;
  };

  return { ...state, onAnswerEdited, attemptContinue };
}
