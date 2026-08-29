# STATUS — FATIGUE CATCH-UP

Owner: `fatiguecatchup`

Checkpoint: `3dd66506`

Date: 2026-08-30

## Scope

This unit owns R-275 only: the missed-session **No, move it** answer, past
unlogged move permission, the dated fatigue sequence, its visible
acknowledgement and Status/Clear lifecycle, and the Week-board label
**Sessions / games**. Existing `docs/NOW.md` and unrelated untracked files were
present before this work and were not edited or staged by this seat.

## Options compared

### Fatigue

1. Store a mutable streak counter and a second saved deload flag.
2. Store only each dated answer and derive the day effect and consecutive-date
   sequence during canonical reconstruction.

Option 2 landed. It gives restart, Clear, expiry, same-date repeats, gaps and
Sunday/Monday one source of truth. Expired one-day reports remain factual
history; a resolved report no longer participates. No streak counter is saved.

### Moving a missed item

1. Add a separate past-session editor.
2. Open the existing Week board with a typed permission naming the exact
   unlogged source item.

Option 2 landed. Ordinary past rows remain locked. The temporary permission
allows only the prompted item to move to today or the future, and an occupied
future session cannot be swapped back into the past. Games retain the fixture
transaction; sessions and team training retain the plan-change transaction.

## Shipped behaviour

- **Bit tired:** one dated fact, visible as **Noted — today stays as planned.**
  No workout or workout identity changes.
- **Pretty flat:** one dated fact; only that date gets the canonical lighter-day
  transformation.
- **Totally cooked:** one dated fact; that date becomes rest, so the missed
  detector has no session to chase.
- **Any two consecutive dates:** all nine tier combinations trigger the shared
  deload transformation from the second date through Sunday. A cooked date
  remains rest.
- The acknowledgement begins exactly **That’s two tired days in a row.**
- My Status, Day and Week carry the same fact identity. Clear recomposes from
  accepted inputs; restart preserves both the program and the visible row.
- The missed prompt now has the signed third answer **No, move it** and opens
  the existing board in Week view.
- The Week board banner is **Sessions / games**.

## Verification

Green:

- `npx tsc --noEmit --pretty false`
- `npm run test:fatigue-sequence` — 53/53 (35 policy + 18 plumbing)
- `npm run test:missed-session-prompt` — 34/34
- `npm run test:modifier-lifecycle` — 241/241, then its chained My Status 10/10,
  Program read-only 10/10 and modifier-effect 4/4
- `npm run test:temporary-source-facts` — 81/81
- `npm run test:readiness-illness-law` — 116/116
- `npm run test:readiness-acknowledgment` — 6/6
- `npm run test:deload-law` — 68/68
- `npm run test:missed-sessions` — 21/21
- `npm run test:training-logging` — 14/14
- `npm run test:signed-copy-extraction` — 7/7
- direct `canonicalWeeklyCompilerSliceTests.ts` — 10,390/10,390, including
  real onboarding, accumulated edits, restart, Clear and Undo journeys
- `npm run test:plan-change-producer` — 10,390/10,390 through its canonical
  accepted-action alias

Guard liveness:

- Mutating the active fatigue effect to `none` made `test:fatigue-sequence` red:
  16 named combination/effect failures.
- Replacing the signed move answer with the skip answer made
  `test:missed-session-prompt` red on **move reads the signed row**.
- Removing the future-only past-move destination filter made
  `test:missed-session-prompt` red on **catch-up cannot move to another past
  date**.
- Every mutation was restored and its suite reran green.

Known checkout reds, unrelated to R-275:

- `test:law-registry`: 13 pass / 1 fail because 21 older laws remain
  `UNENFORCED`; the new R-275 row is guarded and correctly recognised in
  `test:bible`.
- `test:copy-rulings-binding`: 7 pass / 2 fail on one older absent signed
  sentence and three older absent proposed strings.
- `test:week-board`: 80 pass / 1 fail on the existing adapter-plan fallback
  assertion; the two R-275 board assertions pass.
- `test:weekly-readiness`: 32 pass / 3 fail on the existing injury ingress and
  selector source assertions; the dated-fatigue ownership assertion passes.
- `test:session-outcome-control`: 2 pass / 3 fail because its diagnostic fixture
  refuses to install an accepted profile/program before reaching the assertions.

## What catches the next defect of this class

The pure 3×3 fatigue matrix catches a new tier pairing that fails to trigger or
loses cooked precedence. Calendar cells catch stored counters, same-day double
taps, gaps and week-boundary errors. The canonical and modifier lifecycles catch
visual-only changes, missing persistence/Clear, metadata-only workout identity
rewrites, and a program effect with no Status row. The missed-prompt ownership
suite pins the signed answer, exact source identity, board route, future-only
destination and no future-to-past swap.

## NOT COVERED

- Physical iPhone Release acceptance (required before athlete-facing work is
  called done).
- Long-press/drag pixels, animation and haptics on glass.
- VoiceOver pronunciation and focus order for the third chip and board.
- A production Supabase round trip; local durable storage/relaunch is covered.
- Moving a missed item whose source date is in a different week from the week
  currently displayed; the live prompt is derived from the displayed week.
