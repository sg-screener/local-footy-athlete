# §18 Ownership Migration — on-device Maestro smoke pass (2026-07-22)

**Branch:** `section18-ownership-invariants` (all stages landed).
**Device:** iPhone 17 Pro simulator (`B8B2C7B0…`), iOS 26.3, Metro :8081 from this
checkout. **Seed:** `standard-in-season-week` (Mon 2026-07-13), reseeded before
each flow. **Verified the athlete-visible surface**, not the store (store is
covered by the 11 invariants in `test:bible`). Screenshots in
`docs/audits/section18-smoke-2026-07-22/`.

## Verdict summary

| # | Flow | Verdict |
|---|------|---------|
| 1 | Swap on a normal day → disclosed repair, no raw code | **PASS** |
| 2 | Swap on a Team Training day → anchor kept, gym component changes | **PASS** |
| 3 | Add to empty/rest day → appears + survives navigate-away-and-back | **PASS** |
| 4 | Bin triggering a repair → names every changed day, visible match | **PASS** |
| 5 | Coach chat: swap a specific exercise → visible change, no false Done | **PARTIAL** — no false Done ✓, but coach does not apply a swap the tap door applies |
| — | Game day swap + add refused, no raw code | **PARTIAL** — refused + plan unchanged + no raw code ✓, but generic message, not the specific "It's game day" lock |

No crashes. No raw error codes (`section18_week_rejected` etc.) surfaced anywhere.
No false "Done" anywhere — every coach reply matched the visible state.

---

## Flow 1 — swap on a normal day — PASS
- **Action:** MON (Lower Body Strength, CORE) → Edit → Swap → Conditioning → Light session.
- **Result message:** *"Done. Flush Out - 30:30 Intervals is now on 2026-07-13.
  Lower-body strength was moved to **Wednesday** to keep your week balanced."*
- **Visible:** MON → Aerobic Flush (OPTIONAL); **WED → Lower Body Strength** (matches "moved to Wednesday").
- Names the repaired day; no `section18_week_rejected`. `flow1-swap-normal-day.png`.

## Flow 2 — swap on a Team Training day — PASS
- **Action:** TUE (Upper Pull + Team Training) → Edit → Swap → Strength → Lower body.
- **Result message:** *"Done. Lower Body Strength is now on 2026-07-14. This week's
  strength target has been reduced at your request."*
- **Visible:** TUE → **"Lower Body Strength + Team Training"** — Team Training anchor
  preserved, only the gym component changed (Upper Pull → Lower Body Strength).
- Reduction disclosed (displaced pull couldn't relocate) — correct disclosed
  behaviour, not silent. `flow2-swap-team-training-day.png`.

## Flow 3 — add to an empty/rest day + persistence — PASS
- **Action:** WED (Rest) → "Add optional session?" → Conditioning → Light session.
- **Result message:** *"Done. Flush Out - 2min On / 1min Off added on Wednesday.
  I rebalanced Friday to keep your week balanced."*
- **Visible:** WED → Aerobic Flush (OPTIONAL); FRI → Rest (Gunshow rebalanced, disclosed).
- **Persistence:** navigated Coach tab → Program, plus next-week → this-week
  round-trip; **WED still shows Aerobic Flush** — the old silent strip-back-to-Rest
  bug is fixed at the visible layer. `flow3a-…`, `flow3b-add-persists-after-nav.png`.

## Flow 4 — bin triggering a multi-day repair — PASS (the #4 fix, on device)
- **Action:** TUE → Edit → Bin → "Gym session" (strength component) → confirm.
- **Result message:** *"Upper Pull was removed. Pulling work was added to
  **Wednesday**. I also rebalanced **Friday** to keep your week balanced."*
- **Visible:** TUE → Team Training (strength gone, team stays); WED → Upper Pull
  (added); FRI → Rest (Gunshow gone). Every day named in the message visibly changed,
  and the changes match the message.
- This is exactly the #4 disclosed-repair fix: **Friday is now named** (previously
  silent). `flow4-bin-multiday-repair.png`.

## Flow 5 — coach chat exercise swap — PARTIAL

**No false "Done" — confirmed (the #5 safety property holds in-app).** The coach was
honest in every attempt and the visible workout always matched its claim.

- "Swap Back Squat for **Step Ups**" → honest clarify: *"I can't add Step Ups because
  they are not an approved visible/addable option. Which approved replacement should I
  use…"* (Step Ups isn't in the real registry — it was only a unit-test stand-in.)
- "Swap Back Squat for **Front Squat**" → *"I couldn't safely validate that revision,
  so I left the plan unchanged."* MON re-checked: **still Back Squat 112.5kg, Deadlift
  137.5kg** — unchanged, matching the claim. `flow5b-coach-refuses-frontsquat.png`.

**The positive half was NOT demonstrated via coach.** The **tap door performs the exact
same swap** the coach refused: on the workout screen, Back Squat's "Change → Swap
exercise → Too easy" offered *"Replace Back Squat with **Front Squat**"*, and applying
it changed the visible row to **Front Squat** (Deadlift untouched at 137.5kg).
`flow5c-tap-swap-succeeds-frontsquat.png`.

**So: tap swaps Back Squat → Front Squat; the free-text coach refuses the identical
change.** A cross-door divergence at the visible layer. It is not a false Done (coach
honestly reports "unchanged"), so the specific store-level bug #5's invariant guards
(coach claims Done but nothing changed) did not reproduce — but the doors are not
equivalent for this free-text request. The coach's *"couldn't safely
validate/preview that revision"* wording and the "Updating your program…" progress
suggest this refusal comes from the coach's program-edit/preview path, a different
mechanism than the deterministic `replace_exercise` executor that stage-4's #5 fix
routed through the tap owner (that executor's invariant is green in `test:bible`).
**Not diagnosed further here — recorded for triage.**

## Game day — swap + add — PARTIAL
- **Tap door:** the SAT Game Day card offers **no swap/add affordance** — only "Log
  Game" and "Move or remove game day". Locked at the menu, no raw code.
  `flow6a-gameday-tap-no-swap-add-affordance.png`.
- **Coach door — add** ("Add a hard conditioning session on Saturday" → "MetCon -
  Off-Legs"): ended *"I couldn't safely preview that revision, so I left the plan
  unchanged."* `flow6b-coach-gameday-add-refused.png`.
- **Coach door — swap** ("Swap my Saturday game session for a conditioning session" →
  "Easy Zone 2 Bike"): ended *"I couldn't safely validate that revision, so I left the
  plan unchanged."* `flow6c-coach-gameday-swap-refused.png`.
- **Program re-checked: SAT still Game Day, whole week intact** — nothing applied.
  `flow6d-gameday-week-intact.png`.
- **No raw error code; plan unchanged** ✓. **But** two gaps vs. the reassessment's
  stated game-day behaviour: (a) the message is the **generic** "couldn't safely
  preview/validate that revision" (the same wording used for the *legal* Front Squat
  swap), not the specific *"It's game day — sessions can't be changed or added here."*;
  (b) the coach's clarify framing — *"Which conditioning session should replace
  Saturday's Game Day?"* — implies it does not recognise game day as specially locked
  and only fails at the final validation gate rather than refusing up front.

---

## What this pass establishes vs. leaves open

**Established (visible layer):** the four tap-door program-mutation fixes all behave
correctly for the athlete — disclosed repairs name every touched day (flows 1, 3, 4),
the Team Training anchor is preserved on swaps (flow 2), and empty-day adds survive
navigation (flow 3). No raw error codes, no false Done, no crashes.

**Open for triage (not fixed, per instructions):**
1. **Cross-door divergence for free-text coach exercise swaps (flow 5):** the coach
   refuses "swap Back Squat for Front Squat" ("couldn't safely validate that revision")
   while the tap door applies exactly that swap. Positive case for coach exercise-swap
   not demonstrated in-app.
2. **Game-day refusal wording/ownership:** game day is effectively protected (nothing
   applies, no raw code), but via a generic "couldn't safely preview/validate" message
   rather than the specific game-day lock, and the coach offers to "replace Saturday's
   Game Day" before failing at validation.

Both open items live in the coach free-text / program-edit-preview path, which
stage-4's #5 change did not target (that change routed the deterministic
`replace_exercise` executor through the tap owner; its invariant is green in
`test:bible`). Recommend a follow-up look at that path before closing coach parity.
