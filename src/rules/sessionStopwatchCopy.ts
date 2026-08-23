import { registerSignedCopy, signedCopy } from './signedCopy';

/**
 * R-132's stopwatch words (Sam, 2026-08-23), registered BEFORE the control was
 * built — the R-129 `Acceleration` lesson. *"just saying 'Start session' its a
 * little button or something with a timer next to it that you can pause or
 * end"* — "Start session" is his verbatim label; Pause / Resume / End are the
 * two controls he named and the counterpart Resume a paused timer needs.
 * Batch 37 of docs/COPY_SHEET_RULINGS_2026-07-30.md.
 */
registerSignedCopy([
  {
    id: 'session.stopwatch.start',
    source: 'sam_ruling',
    provenance: 'SIGNED — R-132 (Sam, 2026-08-23), verbatim: "just saying '
      + '\'Start session\'". Batch 37.',
    text: 'Start session',
  },
  {
    id: 'session.stopwatch.pause',
    source: 'sam_ruling',
    provenance: 'R-132 (Sam, 2026-08-23): "a timer next to it that you can '
      + 'pause or end". Batch 37.',
    text: 'Pause',
  },
  {
    id: 'session.stopwatch.resume',
    source: 'sam_ruling',
    provenance: 'R-132 (Sam, 2026-08-23): the counterpart a paused timer '
      + 'needs; proposed with the pair. Batch 37.',
    text: 'Resume',
  },
  {
    id: 'session.stopwatch.end',
    source: 'sam_ruling',
    provenance: 'R-132 (Sam, 2026-08-23): "pause or end". Batch 37.',
    text: 'End',
  },
]);

export const SESSION_STOPWATCH_COPY = {
  start: signedCopy('session.stopwatch.start'),
  pause: signedCopy('session.stopwatch.pause'),
  resume: signedCopy('session.stopwatch.resume'),
  end: signedCopy('session.stopwatch.end'),
} as const;
