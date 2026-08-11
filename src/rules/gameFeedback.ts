import { registerSignedCopy, signedCopy } from './signedCopy';
import type { FeedbackGameFeel } from '../types/sessionOutcome';

/** Sam's complete match-feedback wording, ruled 2026-08-11. */
registerSignedCopy([
  { id: 'game.feedback.eyebrow', source: 'sam_ruling', provenance: 'Sam 2026-08-11; docs/COPY_SHEET_RULINGS_2026-07-30.md §18-b-i', text: 'GAME COMPLETE' },
  { id: 'game.feedback.title', source: 'sam_ruling', provenance: 'Sam 2026-08-11; game-feedback order', text: 'Game feedback' },
  { id: 'game.feedback.subtitle', source: 'sam_ruling', provenance: 'Sam 2026-08-11; game-feedback order', text: 'A quick match check-in.' },
  { id: 'game.feedback.whole_question', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim', text: 'Did you play the whole game?' },
  { id: 'game.feedback.whole_yes', source: 'sam_ruling', provenance: 'Sam 2026-08-11; binary answer to whole-game question', text: 'Whole game' },
  { id: 'game.feedback.whole_no', source: 'sam_ruling', provenance: 'Sam 2026-08-11; binary answer to whole-game question', text: 'Part of the game' },
  { id: 'game.feedback.duration_question', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim', text: 'Rough time on ground' },
  { id: 'game.feedback.hours', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input', text: 'Hours' },
  { id: 'game.feedback.minutes', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input', text: 'Minutes' },
  { id: 'game.feedback.duration_refusal', source: 'sam_ruling', provenance: 'Sam 2026-08-11; hours + minutes input validation', text: 'Enter a time, with minutes between 0 and 59.' },
  { id: 'game.feedback.rpe_question', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim', text: 'How hard was the game on your body?' },
  { id: 'game.feedback.rpe_hint', source: 'sam_ruling', provenance: 'Sam 2026-08-11; RPE 1-10', text: '1 = very easy · 10 = very hard' },
  { id: 'game.feedback.feel_question', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim', text: 'How do you feel?' },
  { id: 'game.feedback.feel_heavy', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Heavy' },
  { id: 'game.feedback.feel_bad', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Bad' },
  { id: 'game.feedback.feel_normal', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Normal' },
  { id: 'game.feedback.feel_good', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Good' },
  { id: 'game.feedback.feel_flying', source: 'sam_ruling', provenance: 'Sam 2026-08-11 verbatim scale', text: 'Flying' },
  { id: 'game.feedback.save', source: 'sam_ruling', provenance: 'Sam 2026-08-11; complete game form save', text: 'Save game' },
]);

export const GAME_FEEDBACK_COPY = {
  eyebrow: signedCopy('game.feedback.eyebrow'),
  title: signedCopy('game.feedback.title'),
  subtitle: signedCopy('game.feedback.subtitle'),
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
  save: signedCopy('game.feedback.save'),
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
