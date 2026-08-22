import { registerSignedCopy, signedCopy } from './signedCopy';
import type { FeedbackGameFeel } from '../types/sessionOutcome';

/**
 * Sam's complete match-feedback wording, ruled 2026-08-11.
 *
 * ⚠ **FOUR ROWS LEFT ON 2026-08-22 AND NONE OF THEM WAS RE-WORDED** — they
 * stopped being this form's to own. Sam put the three feedback pop-ups in one
 * shell: the sheet draws the header, so "GAME COMPLETE", "Game feedback" and
 * "A quick match check-in." are replaced by rows every form shares
 * (`feedback.sheet.label_game`, `feedback.sheet.question`), and "Save game" by
 * the one button word he chose for all three (`feedback.save_action`). The
 * retirements are recorded in batch 18-b-i-A of the copy sheet.
 */
registerSignedCopy([
  { id: 'game.feedback.whole_question', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim', text: 'Did you play the whole game?' },
  // A YES/NO QUESTION TAKES YES/NO ANSWERS — Sam, 2026-08-22: *"'did you play
  // the whole game?' = yes or no buttons, not whole or part"*. The chips used
  // to restate the question ("Whole game" / "Part of the game") instead of
  // answering it, which also made them the two widest chips on the form.
  { id: 'game.feedback.whole_yes', source: 'sam_ruling', provenance: 'SIGNED — Sam, 2026-08-22, ruling the answers to the whole-game question: yes or no buttons. Supersedes the 2026-08-11 pair, retired in batch 18-b-i-A of docs/COPY_SHEET_RULINGS_2026-07-30.md.', text: 'Yes' },
  { id: 'game.feedback.whole_no', source: 'sam_ruling', provenance: 'SIGNED — Sam, 2026-08-22, the same ruling and the same batch row. The chips answer the question now rather than restating it.', text: 'No' },
  // ⚠ **THE WORD "ESTIMATE" IS THE POINT OF THIS QUESTION** — Sam, 2026-08-22:
  // *"Make it time on ground (estimate)"*. "Rough" was doing that job in an
  // adjective nobody reads; saying it in brackets is what stops an athlete
  // leaving the box empty because they do not know the exact number.
  { id: 'game.feedback.duration_question', source: 'sam_ruling', provenance: 'SIGNED — Sam, 2026-08-22, verbatim. Supersedes the 2026-08-11 wording (batch 18-b-i-C).', text: 'Time on ground (estimate)' },
  { id: 'game.feedback.hours', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input', text: 'Hours' },
  { id: 'game.feedback.minutes', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input', text: 'Minutes' },
  { id: 'game.feedback.duration_refusal', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input validation', text: 'Enter a time, with minutes between 0 and 59.' },
  // ⚠ **"ON YOUR BODY" IS GONE** — Sam, 2026-08-22: *"'how hard was the game'
  // instead of on your body"*. It also cost the question a second line on a
  // 402pt screen, which is what put the form's Save button below the fold.
  { id: 'game.feedback.rpe_question', source: 'sam_ruling', provenance: 'SIGNED — Sam, 2026-08-22, dropping the trailing qualifier from the 2026-08-11 wording. Retired in batch 18-b-i of docs/COPY_SHEET_RULINGS_2026-07-30.md, which carries the old sentence.', text: 'How hard was the game?' },
  { id: 'game.feedback.rpe_hint', source: 'sam_ruling', provenance: 'Sam 2026-08-12; ONE effort scale everywhere — supersedes the 2026-08-11 change to 1-5', text: '1 = very easy · 10 = very hard' },
  // PAST TENSE, LIKE EVERY OTHER QUESTION ON THIS FORM — Sam, 2026-08-22: *"make
  // it how did you feel? not how do you feel"*. The form is filled in after the
  // final siren; it asks how the game WAS, not how the athlete is right now.
  { id: 'game.feedback.feel_question', source: 'sam_ruling', provenance: 'SIGNED — Sam, 2026-08-22, putting the question in the past tense. Supersedes the 2026-08-11 present-tense wording, retired in batch 18-b-i-A of docs/COPY_SHEET_RULINGS_2026-07-30.md.', text: 'How did you feel?' },
  { id: 'game.feedback.feel_heavy', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Heavy' },
  { id: 'game.feedback.feel_bad', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Bad' },
  { id: 'game.feedback.feel_normal', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Normal' },
  { id: 'game.feedback.feel_good', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Good' },
  { id: 'game.feedback.feel_flying', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Flying' },
]);

export const GAME_FEEDBACK_COPY = {
  wholeQuestion: signedCopy('game.feedback.whole_question'),
  wholeYes: signedCopy('game.feedback.whole_yes'),
  wholeNo: signedCopy('game.feedback.whole_no'),
  durationQuestion: signedCopy('game.feedback.duration_question'),
  hours: signedCopy('game.feedback.hours'),
  minutes: signedCopy('game.feedback.minutes'),
  durationRefusal: signedCopy('game.feedback.duration_refusal'),
  rpeQuestion: signedCopy('game.feedback.rpe_question'),
  rpeHint: signedCopy('game.feedback.rpe_hint'),
  feelQuestion: signedCopy('game.feedback.feel_question'),
} as const;

export const GAME_FEEL_OPTIONS: ReadonlyArray<{
  key: FeedbackGameFeel;
  label: string;
}> = [
  { key: 1, label: signedCopy('game.feedback.feel_heavy') },
  { key: 2, label: signedCopy('game.feedback.feel_bad') },
  { key: 3, label: signedCopy('game.feedback.feel_normal') },
  { key: 4, label: signedCopy('game.feedback.feel_good') },
  { key: 5, label: signedCopy('game.feedback.feel_flying') },
];
