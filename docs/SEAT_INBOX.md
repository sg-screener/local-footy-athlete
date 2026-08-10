# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

1. **THE KNOT — the majority is still tied.** ONE STRAND IS CUT and
   live: `dismiss_note`, which turned out never to have been tangled
   (`useCallback(..., [])` over a module-level function). The not-yet
   state is now PER-ACTION, so freeing each remaining strand lights it
   up on its own.
   **STILL TIED:** every action that opens a confirmation sheet —
   `handleClearCoachNote` and `handleUpdateCoachNoteStatus` close over
   five hook-level values and two `Alert` paths — and the whole
   phase-shift machine. **Nothing has left the day screen.**
   Priced in `docs/UI_MERGE_SLICE3_BOUNDARY_2026-08-10.md` addenda 2
   and 8. **The pattern to copy is `useActiveModifiers`, which did the
   same move for the LIST without the day screen flinching.**

## Previously (now processed)

Moved to `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` on 2026-08-10.
**This file holds LIVE ORDERS ONLY from here.** It was 353KB and every
terminal stop paid to re-read it. Keep it small: the seat clears
processed items into the archive at every tidy, and a terminal reply
that is not an order does not belong in `## Unprocessed` at all.
