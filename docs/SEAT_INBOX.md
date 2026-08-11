# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

**THE ATLAS IS VERIFIED. Read `docs/ATLAS_VERIFICATION_2026-08-12.md` before
taking any order below — it carries the receipts, the corrections, and the two
live defects the atlas does not contain. Entry point for a new agent is still
`docs/CODEX_HANDOFF_2026-08-11.md`.**

1. **TURN ON THE CRAFT VALIDATOR — THIS IS THE ANSWER TO "WHY IS THE
   PROGRAMMING SHIT".** `weekStructureValidator.ts` holds Sam's Section 17
   craft rules and is FINDINGS-ONLY by its own header; its three callers all
   just log. Put `validateProgramWeek` into the §18 gateway's `assess` closure
   (`section18AcceptedWeekGateway.ts:1348-1370`) as a blocking tier for
   `severity: 'strong'`, and close the two seams that would escape it
   (`applyOptionalTopUps`, `SAFE_PATTERN_FALLBACK`). One seam, every path.
   **Nothing else on this list outranks it.** Verification §1.

2. **ONE OWNER FOR THE GAME DAY — THERE IS A LIVE DEFECT.**
   `quiescentBoot.ts:337` derives the recurring game day from `profile.gameDay`
   alone and skips `'Varies'`, so a Wednesday game day is lost on relaunch. No
   test covers it. Fix that line first, then make `resolveEffectiveGameDay` the
   sole reader and gate the ~25 direct readers. **Eight representations of one
   fact — this is the defect class, not an instance of it.** Verification §2.1.

3. **ONE OWNER FOR OFF-FEET.** `conditioningFeasibility.ts:215` permits walking
   with no off-feet gate while `:207`/`:210` reject running and hills, and
   `:326-329` clears the flag for those two and forgets walking — so the
   session keeps `conditioningOffFeet: true` while its rows read "Brisk
   Walking". Declare `onFeet` on the family table and derive both gates.
   Verification §2.2.

4. **A FLOOR AND A CEILING ON SESSION SIZE.** Enforce both at
   `sessionRowCounting.ts:253` — the site its own comment nominates — so the AI
   path, the eleven 3-row fallback branches and every future branch are caught
   by one predicate. Emit `MIN EXERCISES PER SESSION` to the prompt.

5. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12: **95 rows,
   63 guarded, 32 UNENFORCED.** **Priority is the FOUR that can change what the
   athlete sees** — `LAW-L6-honest-actions`, `LAW-attributed-content-change`,
   `LAW-L5-no-dead-affordances`, `LAW-L15-one-write-format` — not the 24
   process laws. Two rows READ guarded and are held by grepping NOW.md for a
   word (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`); they need a real
   subject or a `subject: 'behaviour'` red.

Items 6-8 (retire dormant code to `src/retired/`, make onboarding addressable
then walk it, harvest ratchet + computed atlas) are shaped in the verification
doc §4 and are NOT ordered yet — they wait behind 1-4.

## Previously (now processed)

Moved to `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` on 2026-08-10.
**This file holds LIVE ORDERS ONLY from here.** It was 353KB and every
terminal stop paid to re-read it. Keep it small: the seat clears
processed items into the archive at every tidy, and a terminal reply
that is not an order does not belong in `## Unprocessed` at all.
