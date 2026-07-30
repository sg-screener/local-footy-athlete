/**
 * WHAT EACH ONBOARDING ANSWER IS FOR — declared, so it cannot drift.
 *
 * SAM'S RULINGS, 2026-07-30 (`docs/ONBOARDING_INFLUENCE_MAP_2026-07-30.md`):
 *
 *   4. `ageRange`, `biggestFrustration`, `successVision` = COACH-CONTEXT-ONLY, declared.
 *   5. "The coach-context category is SIGNED as a mechanism: a typed declaration + gate,
 *      so a field can be ruled coach-flavour but can never drift there silently.
 *      `teamTrainingDuration` is declared coach-context + estimate-seed per ruling 2+3."
 *
 * WHY A MECHANISM AND NOT A LIST IN A DOCUMENT. The influence map found eight fields that
 * influence nothing about the program, and the reason none of them was noticed is that
 * "influences nothing" has no representation — a field that quietly stops mattering looks
 * exactly like a field that never did. A DECLARATION makes the two distinguishable: a
 * field is either declared coach-context, or it must have a programming consumer, and
 * `onboardingFieldInfluenceTests` fails either way round.
 *
 * WHAT THIS FILE IS NOT. It is not a second source of truth about consumers — it does not
 * list them, and it cannot, because a list of call sites rots. It declares the INTENT for
 * each field Sam has ruled on, and the gate checks the intent against the code.
 */

/** What an onboarding answer is allowed to be for. */
export type OnboardingFieldRole =
  /**
   * Reaches the coach's context and NOTHING in the program. A legitimate answer to
   * "what is this for" — the coach is a real surface — but it must be SAID.
   */
  | 'coach_context_only'
  /**
   * Coach context today, and the seed for a value that MEASUREMENT will own.
   *
   * Sam's estimate→measured pattern, the same shape as loads and the 2km time trial: the
   * onboarding answer is the starting assumption and logged reality replaces it. A field
   * declared this way is not finished — it is waiting on a mechanism, and the sheet that
   * proposes that mechanism is named below.
   */
  | 'coach_context_and_estimate_seed';

export interface OnboardingFieldDeclaration {
  readonly field: string;
  readonly role: OnboardingFieldRole;
  /** Sam's own words, or the ruling's, so the declaration carries its authority. */
  readonly ruling: string;
  /** For an estimate seed: the sheet proposing the mechanism that will own the truth. */
  readonly supersededBy?: string;
}

/**
 * THE DECLARED FIELDS. Everything not listed here must have a programming consumer.
 *
 * Deliberately short. A long list here would mean onboarding asks a lot of questions that
 * do not shape a program, which is the finding the influence map made — not a state to
 * make comfortable.
 */
export const ONBOARDING_FIELD_DECLARATIONS: readonly OnboardingFieldDeclaration[] = [
  {
    field: 'ageRange',
    role: 'coach_context_only',
    ruling: 'Sam, 2026-07-30: ageRange, biggestFrustration, successVision = '
      + 'COACH-CONTEXT-ONLY, declared.',
  },
  {
    field: 'biggestFrustration',
    role: 'coach_context_only',
    ruling: 'Sam, 2026-07-30: ageRange, biggestFrustration, successVision = '
      + 'COACH-CONTEXT-ONLY, declared.',
  },
  {
    field: 'successVision',
    role: 'coach_context_only',
    ruling: 'Sam, 2026-07-30: ageRange, biggestFrustration, successVision = '
      + 'COACH-CONTEXT-ONLY, declared.',
  },
  {
    field: 'teamTrainingDuration',
    role: 'coach_context_and_estimate_seed',
    ruling: 'Sam, 2026-07-30: the onboarding teamTrainingDuration and '
      + 'teamTrainingIntensity answers are a STARTING ASSUMPTION ONLY. Season reality '
      + 'varies — some team nights hard, some lighter — so a static onboarding answer can '
      + 'never own team-night size. Onboarding seeds the initial assumption and remains '
      + 'coach context; actual logged sessions become the truth.',
    supersededBy: 'docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md',
  },
  {
    field: 'teamTrainingIntensity',
    role: 'coach_context_and_estimate_seed',
    ruling: 'Sam, 2026-07-30: a STARTING ASSUMPTION ONLY, the same ruling as '
      + 'teamTrainingDuration — onboarding seeds the team-night assumption and logged '
      + 'sessions become the truth. It also STOPPED deciding hard-day status on the same '
      + 'day: a team night is a hard day unconditionally (Bible :119).',
    supersededBy: 'docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md',
  },
];

const BY_FIELD: ReadonlyMap<string, OnboardingFieldDeclaration> =
  new Map(ONBOARDING_FIELD_DECLARATIONS.map((entry) => [entry.field, entry]));

export function onboardingFieldDeclaration(
  field: string,
): OnboardingFieldDeclaration | null {
  return BY_FIELD.get(field) ?? null;
}

/** Is this answer declared as reaching no programming rule? */
export function isCoachContextOnlyField(field: string): boolean {
  return !!BY_FIELD.get(field);
}
