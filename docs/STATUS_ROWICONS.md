# STATUS — rowicons

Seat: `rowicons`. Scope: the per-exercise quick-action icons (swap / remove) on
the session view, `QuickExerciseActions` in `src/screens/home/DayWorkoutScreenV2.tsx`.

## 2026-08-25 — the padded invisible tap target is out; remove is a bin

**WHAT SAM ASKED.** Two things, in order: remove the invisible/tinted 32–36pt
tap boxes an earlier seat added ("it was better how it was before"), keeping the
new muted colours; then make the remove glyph a trash bin instead of a minus.

**WHAT CHANGED.**

- `exerciseRowActionBtn` 36×36 -> back to the original 22×22, `exerciseRowActions`
  `gap: 0` -> `6`, `exerciseHeaderWithQuickActions` `paddingRight: 86` -> `68`.
  The comfortable press area is `hitSlop={8}` on each `Pressable` (22 + 16 = 38pt),
  which is where it came from before the padded box existed. The 36pt box had also
  dragged both glyphs ~7pt down the card, because the row is anchored at `top: 12`
  and the icon centres with its box.
- Remove glyph `name="minus"` -> `name="trash-can-outline"`, size 15, colour
  unchanged (`rgba(255, 127, 127, 0.72)`).
- Backgrounds stay `transparent` and the swap glyph stays `colors.text.secondary`
  — the previous seat's colour work was kept, only its geometry was undone.

**WORKING.** `npm run test:quick-exercise-actions` — 63 passed / 2 failed.
The two reds are the `day-workout-change-hub` assertions, which are PRE-EXISTING:
`git show HEAD:src/screens/home/DayWorkoutScreenV2.tsx | grep -c day-workout-change-hub`
returns 0, i.e. the hub was already gone at `5388a22e` ("Move session changes
behind header options") before this seat touched anything. Not mine to fix, and
not caused here.

Cells updated in `src/__tests__/quickExerciseActionsTests.ts` to hold the restored
geometry: 22pt box, `gap: 6`, and at least two `hitSlop={8}` — so a future seat
that re-inflates the box to fake a tap target reds instead of shipping.

**SIMULATOR PROOF.** iPhone 17 Pro, Metro fast-refresh, Tue 25/8 session: both
glyphs sit tight together at the top-right of each exercise card, at the old
spacing and old height, with a red bin in place of the minus. Verified on Lat
Stretch, Dead Hang, Scap Pull Ups, Band External Rotation and Explosive Push-Up.

**NORTH STAR.** Neutral — presentation only. No stored state added or removed.
