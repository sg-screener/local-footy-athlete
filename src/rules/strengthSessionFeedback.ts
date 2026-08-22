/**
 * THE STRENGTH SESSION'S OWN DURATION QUESTION — the fourth and last kind.
 *
 * Sam chose option (a) on 2026-08-12: *"i think do a for now and I will think of
 * if thats good enough long term"*. The "for now" is his, so this is built
 * properly rather than left as a seam for options (b) or (c).
 *
 * WHY THE WORDING IS HIS AND NOT MINE. Every athlete-facing string in this repo
 * is `sam_ruling` with verbatim provenance, and the terminal does not invent
 * athlete words. He was shown his own two existing lines — "How long was team
 * training?" and "Rough time on ground" — and chose the wording below on
 * 2026-08-13. It deliberately echoes the GAME one: "rough" tells the athlete an
 * estimate is fine, which is the difference between an answer and a blank.
 *
 * THE HOURS / MINUTES LABELS AND THE REFUSAL ARE REUSED, NOT RE-SIGNED. The
 * team-training block already reuses `GAME_FEEDBACK_COPY.hours` / `.minutes`;
 * a third copy of the word "Hours" would be three places for one word to
 * disagree.
 */

import { registerSignedCopy, signedCopy } from './signedCopy';

registerSignedCopy([
  {
    id: 'strength.feedback.duration_question',
    source: 'sam_ruling',
    /* THE GYM ASKS THE SAME QUESTION AS TEAM TRAINING, IN THE SAME WORDS — Sam,
       2026-08-22 gave two lines for three forms: the game asks for time on
       ground, and training asks for time spent training. A gym session and a
       club night are both training, so both ask it the same way; if he wants
       the gym named separately, this row is the one line that changes. */
    provenance: 'SIGNED — Sam, 2026-08-22: "Time spent training (estimate)". Supersedes '
      + 'his 2026-08-13 wording (seat item 18, option (a)); recorded in batch 18-b-i-C.',
    text: 'Time spent training (estimate)',
  },
]);

export const STRENGTH_FEEDBACK_COPY = {
  durationQuestion: signedCopy('strength.feedback.duration_question'),
} as const;
