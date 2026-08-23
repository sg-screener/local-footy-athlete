import { registerSignedCopy, signedCopy } from './signedCopy';
import type { AthleteGender } from '../types/domain';

/**
 * R-130's signed onboarding copy (Sam, 2026-08-23), registered BEFORE the
 * screen that renders it — the R-129 `Acceleration` lesson: an unregistered
 * athlete-facing word is a render error on the athlete's phone, found by Sam.
 *
 * His literal words, from the ruling: the question is `What is your gender?`
 * and the two buttons are `Male` and `Female`. The answer is ONE SWITCH,
 * stored on the profile, immutable after onboarding (R-130).
 */
registerSignedCopy([
  {
    id: 'onboarding.gender.question',
    source: 'sam_ruling',
    provenance: 'SIGNED — R-130 (Sam, 2026-08-23), his literal words: "the '
      + 'question is `What is your gender?`". Batch 36 of '
      + 'docs/COPY_SHEET_RULINGS_2026-07-30.md.',
    text: 'What is your gender?',
  },
  {
    id: 'onboarding.gender.male',
    source: 'sam_ruling',
    provenance: 'SIGNED — R-130 (Sam, 2026-08-23): "the two buttons are `Male` '
      + 'and `Female`". Batch 36 of docs/COPY_SHEET_RULINGS_2026-07-30.md.',
    text: 'Male',
  },
  {
    id: 'onboarding.gender.female',
    source: 'sam_ruling',
    provenance: 'SIGNED — R-130 (Sam, 2026-08-23): "the two buttons are `Male` '
      + 'and `Female`". Batch 36 of docs/COPY_SHEET_RULINGS_2026-07-30.md.',
    text: 'Female',
  },
  {
    id: 'onboarding.gender.review_label',
    source: 'sam_ruling',
    provenance: 'The Review row label for the R-130 answer — the noun of his '
      + 'signed question, not a word he typed himself. Put to him as batch 36 '
      + 'of docs/COPY_SHEET_RULINGS_2026-07-30.md; supersedable like any label.',
    text: 'Gender',
  },
]);

export const GENDER_COPY = {
  question: signedCopy('onboarding.gender.question'),
  male: signedCopy('onboarding.gender.male'),
  female: signedCopy('onboarding.gender.female'),
  reviewLabel: signedCopy('onboarding.gender.review_label'),
} as const;

/** The signed word for a stored answer — Review and any future surface. */
export function genderAnswerText(gender: AthleteGender): string {
  return gender === 'male' ? GENDER_COPY.male : GENDER_COPY.female;
}
