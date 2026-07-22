# Overnight Full Sweep — 2026-07-23

**Branch/HEAD:** `main` @ `86750c9` (merge: fix group B item 2 — record-only
source facts off the §18 mutation gate, opt-in reversible lighter-day with
cascade undo). **Seed:** `standard-in-season-week` (anchor Mon 2026-07-13).
**Device:** iPhone 17 Pro simulator (`B8B2C7B0-0558-448A-896D-EAB9C2C6C326`),
iOS 26.3. Metro :8081 from this checkout (already running, reused). Method:
on-device Maestro MCP, screenshots for every PASS/FAIL in sections A and B.
Screenshots in `fullsweep-2026-07-23/`. Tap-record-move-on, no diagnosis, no
code changes, no commits.

**Environment note:** the Maestro iOS driver (WebDriverAgent on port 7001/the
MCP tool's local proxy on 22087) wedged intermittently throughout the session
— `run`/`inspect_screen` calls periodically failed with connection errors.
Every time, a fresh `reset-seed.yaml` (sometimes needing one retry with a
short wait) recovered cleanly; no flow was abandoned because of it, though
some individual sub-probes (noted inline) were not re-attempted after
recovery since the primary result for that item was already captured.

---

## Section A — Tap-door program-mutation flows

| # | Flow | Expected | Actual | Verdict | Screenshot |
|---|------|----------|--------|---------|------------|
| 1 | Swap MON (Lower Body Strength) → Conditioning → Light | Preview/apply change | "Done. Flush Out - 30:30 Intervals is now on 2026-07-13. Lower-body strength was moved to Wednesday to keep your week balanced." MON→Aerobic Flush, WED→Lower Body Strength, nothing else touched. | **PASS** | `a1-swap-conditioning-light.png` |
| 2 | Swap FRI (Gunshow) → Strength → Full body | Preview/apply change | "Done. Full Body Strength is now on 2026-07-17." No cross-day repair needed; nothing else touched. | **PASS** | `a2-swap-strength-fullbody.png` |
| 3 | Swap MON → Recovery | Preview/apply change | "Done. Recovery Flow is now on 2026-07-13. Lower-body strength was moved to Wednesday to keep your week balanced." | **PASS** | `a3-swap-recovery.png` |
| 4 | Swap → Rest day (dedicated control + confirm) | Dedicated swap-to-Rest control | No "Rest" destination exists anywhere in the "SWAP TO:" list (Conditioning / Strength / Recovery only, re-verified on MON). Only route to Rest is Bin. | **FAIL** — STILL-BROKEN (matches `PROGRAM_2026-07-21.md` row 1.4 / `GROUPCD_WORKLIST_2026-07-22.md` "Missing swap-to-Rest control") | `a4-swap-to-rest-missing-control.png` |
| 5 | Anchor-day swap: TUE (Team Training + Upper Pull) → Strength → Lower body | Team Training anchor preserved, only gym component changes | "Done. Lower Body Strength is now on 2026-07-14. This week's strength target has been reduced at your request." Visible: TUE → **"Team Training + Lower Body Strength"** — anchor preserved, gym component swapped, disclosed reduction (no free relocation day left in this run). | **PASS** | `a5-anchor-day-swap-preserved.png` |
| 6a | Move MON session → WED (empty/Rest) | Plain move, only legal days offered | Only WED/FRI/SUN offered (legal non-anchor, non-game days) — MON→Rest, WED→Lower Body Strength. Message: "Done. Session moved to 2026-07-15." (raw ISO date). | **PASS**, with STILL-BROKEN cosmetic defect (raw ISO date; see below) | `a6a-move-to-empty-day.png` |
| 6b | Move WED (Lower Body Strength) → FRI (occupied, Gunshow) | Atomic two-day swap, nothing lost | Message: "Done. 2026-07-15 and 2026-07-17 swapped sessions." (raw ISO dates). **Visible result: WED → Gunshow AND FRI → Gunshow — both days show the identical derived Gunshow filler (confirmed via the Workout screen: Fri's session is "Workout: Gunshow", the same 4-exercise arms/pump template). The Lower Body Strength session is gone from the entire visible week — MON is Rest, nowhere shows Lower Body Strength.** The claimed "swapped sessions" did not happen; one side of the swap silently lost its content. | **FAIL — NEW** (no prior finding covers session-content loss on an occupied-destination Move; prior 1.5 finding was cosmetic-only) | `a6b-move-to-occupied-atomic-swap.png`, `a6b-BUG-fri-shows-gunshow-not-strength.png` |
| 7a | Bin MON (single session), confirm | Recurring schedule untouched, disclosed repair | Confirm step correctly worded ("Are you sure? This will be removed and the day becomes rest."). Result: "Session removed. Lower-body strength was moved to Wednesday to keep your week balanced." MON→Rest, WED→Lower Body Strength, FRI/others untouched — matches message exactly. | **PASS** | `a7a-bin-single-session.png` |
| 7b | Bin TUE's gym component only ("Just the gym session") | Disclosed repair naming every touched day, team training untouched | Confirm copy: "Are you sure? This bins just the gym session - the rest of the day stays." Result: "Upper Pull was removed. This week's strength target has been reduced at your request." TUE → "Team Training" only (gym gone, team kept); no other day silently touched. | **PASS** | `a7b-bin-multisession-component.png` |
| 8 | Add Conditioning (Light) onto MON (occupied, Lower Body Strength) | Combined S+C day materializes, or advisory+override if risky | Refused: **"That change isn't possible here (section18_week_rejected)."** — raw internal error code shown verbatim to the athlete, no advisory/override choice. | **FAIL** — STILL-BROKEN (matches `GROUPCD_WORKLIST_2026-07-22.md` "Raw internal error codes on the visible surface" / retirement ledger: occupied-day stack adds still route through the legacy writer, unmigrated) | `a8-add-occupied-day-raw-code.png` |
| 9 | Game day (SAT) tap-door menu | Only "Log Game" / "Move or remove game day", no Swap/Add | Card shows exactly "Log Game" and "Move or remove game day" — no "Want to change something?" / Swap / Add affordance anywhere. Tapping "Move or remove game day" opens exactly Move/Remove, nothing else. No forced-swap path was exposed to test the refusal copy (none needed — no affordance exists). | **PASS** | `a9-gameday-no-swap-add-affordance.png`, `a9-gameday-move-remove-only.png` |
| 10 | Past-date refusal (Previous week, MON 6 Jul) | Refusal, plain language, no raw code | The whole previous week is locked as a unit: tapping "Add optional session?" on a past Rest day returns **"This week is view-only for now — the plan firms up closer to the date, just like a real coach programs it."** — plain language, no raw code. (The seed's "today" is pinned to the first day of the only editable week, so there is no partial-past-day-within-an-editable-week state to probe more granularly; the previous week's blanket view-only lock is the exercisable form of this criterion.) | **PASS** (as exercisable) | `a10-past-week-view-only-refusal.png` |

### Section A summary
9 flows fully PASS, 1 flow (raw-ISO-date cosmetic defect on Move confirmations, items 6a/6b) is a STILL-BROKEN cosmetic defect riding alongside otherwise-correct behavior, 2 flows FAIL (item 4 STILL-BROKEN missing control; item 8 STILL-BROKEN raw code), and 1 flow (item 6b) surfaced a **NEW** content-loss defect distinct from any prior finding.

---

## Section B — Readiness cycle

Reached via Program screen → MON's "Want to change something?" → "I'm not
100%" → "I'm tired" → "Lacking a bit of spark" (current product copy for the
"just a bit tired today" tier; exact wording has evidently been refined since
the reassessment doc's device-pass record, per the brief's own allowance).
This was the only reachable "I'm not 100%" entry point found on the Program
screen in this session — see note below.

| # | Check | Expected | Actual | Verdict | Screenshot |
|---|-------|----------|--------|---------|------------|
| 1 | Success acknowledgment | Some clear success ack, not silence | Sheet shows: **"The report is active. No visible session needed changing."** — a clear, honest, non-silent acknowledgment (exact wording differs from the reassessment doc's recorded device-pass copy, "Got it — logged how you're feeling...", but satisfies "some clear success ack"). | **PASS** | `b1-tired-ack-message.png` |
| 2 | Readiness card flips off "I'm not 100%" | Card/label reflects "tired" state | **No visible UI anywhere on the Program screen reflects the tired state.** The day-sheet's "I'm not 100%" menu entry keeps its static label after the fact is set (checked by reopening the sheet); no standalone readiness status card is rendered on the Program screen in any state observed this session (checked via full accessibility-tree dump, screenshot, and a Coach-tab round-trip) — the only readiness-related node in the tree is a 1×1 invisible marker (`readiness-active-temporary-source-fact-v1-fatigue-date-2026-07-13`, replacing the earlier `readiness-clear-state-2026-07-13` marker). Never trusted the marker over the screen — the screen genuinely shows nothing. | **FAIL — STILL-BROKEN** (same defect class as `GROUPB_REAUDIT_2026-07-22.md` finding 2 / `HOMEV2_2026-07-21.md` row 3.1: no visible readiness-state reflection reaches the athlete-visible surface, though the underlying acknowledgment half of that finding is now fixed) | `b2-no-visible-card-flip-week-unchanged.png` |
| 3 | Week byte-identical (record-only) if no offer accepted | Same sessions on every day, nothing silently changed | Confirmed: MON still "Lower Body Strength", TUE/THU/FRI/SAT/SUN all unchanged from baseline — only the invisible witness marker changed. | **PASS** | `b2-no-visible-card-flip-week-unchanged.png` |
| 4 | Inline lighter-day offer appears, applies with plain-words disclosure | Offer shown; accept → main lift kept, accessory volume trimmed, disclosed | **No inline lighter-day offer appeared anywhere in the reachable "I'm not 100%" flow**, on the first tap (fresh fact) or a repeat tap with the fact already active — both times the sheet showed the same generic "The report is active..." message and a "Done" button, no offer step. | **FAIL / NOT OBSERVED** — could not confirm via the reachable path in this build | none (nothing to capture — no offer rendered) |
| 5 | Cascade undo (clear fact reverts trim + flips card back) | Clearing the fact reverts trim and card | Not testable — no offer was ever accepted (item 4), so there is no trim to clear. The "I'm not 100%" sheet also did not expose a distinct "Clear adjustment / I'm good now" option on a repeat visit — it re-offered the same "I'm tired / I slept poorly / ..." top-level menu both before and after the fact was set. | **BLOCKED** (dependent on item 4) | none |

### Section B summary
2 of 5 checks PASS (ack, record-only-week), 1 STILL-BROKEN FAIL (card flip),
1 FAIL/not-observed (lighter-day offer never surfaced through the reachable
path), 1 BLOCKED (cascade undo, dependent on the offer). **Navigation note:**
the richer flow the reassessment doc's device-pass describes (ack + card flip
+ inline offer + cascade undo, all through one widget) was not located as a
reachable, persistently-visible Program-screen entry point in this session —
only the day-tap sheet's simpler "I'm not 100%" → tier picker was reachable,
and it does not expose the offer or a status readout. This may be a
navigation/reachability gap rather than a regression in the offer/undo logic
itself (which the memory records as unit-tested 12/12 green) — recorded as
observed, not diagnosed further per the audit's own no-diagnosis rule.

---

## Overall summary

- **Section A:** 9 PASS, 2 FAIL (1 STILL-BROKEN missing control, 1
  STILL-BROKEN raw code), 1 NEW FAIL (content loss on occupied-destination
  Move), plus 1 STILL-BROKEN cosmetic defect (raw ISO dates) riding alongside
  otherwise-passing Move flows. 0 BLOCKED.
- **Section B:** 2 PASS, 2 FAIL (1 STILL-BROKEN, 1 not-observed), 1 BLOCKED.
- **Combined:** 11 PASS / 4 FAIL / 1 BLOCKED across the 15 scored rows (Section
  A's raw-ISO-date defect is called out as a note on otherwise-PASS rows,
  not double-counted as a separate row).

## Findings requiring attention

### STILL-BROKEN (matches a prior logged finding)
1. **No dedicated Swap-to-Rest control** (Section A item 4) — matches
   `PROGRAM_2026-07-21.md` row 1.4 and `GROUPCD_WORKLIST_2026-07-22.md`.
2. **Raw ISO dates in Move confirmation copy** ("Done. 2026-07-15 and
   2026-07-17 swapped sessions." / "Done. Session moved to 2026-07-15.")
   (Section A items 6a/6b) — matches `PROGRAM_2026-07-21.md` row 1.5 and
   `GROUPCD_WORKLIST_2026-07-22.md`'s `planChangeProducer.ts:2033` citation.
3. **Raw internal error code shown verbatim** ("...section18_week_rejected")
   for occupied-day stack Add (Section A item 8) — matches
   `GROUPCD_WORKLIST_2026-07-22.md`'s "Raw internal error codes on the visible
   surface" finding and the §18 reassessment's retirement ledger (occupied-day
   stack adds still route through the unmigrated legacy writer).
4. **No visible readiness-state reflection on the Program screen**
   (Section B item 2) — same defect class as `GROUPB_REAUDIT_2026-07-22.md`
   finding 2 / `HOMEV2_2026-07-21.md` row 3.1, though the acknowledgment half
   of that finding (Defect 1) is now confirmed fixed — this pass narrows the
   remainder to "nothing visible flips," not "nothing happens at all."

### NEW (no prior finding matches)
1. **Move to an occupied destination can silently lose the moved session's
   content while claiming success** (Section A item 6b). Moving WED's Lower
   Body Strength onto FRI's occupied Gunshow claimed "2026-07-15 and
   2026-07-17 swapped sessions," but the visible result showed **Gunshow
   duplicated onto both days** and the Lower Body Strength session **gone
   from the entire week** — a false "Done" and a genuine silent side effect
   (violates pass criterion #4). Reproduced once, on a chained double-move
   (session moved once already, then moved a second time to an occupied day);
   not re-tried from a single fresh reseed due to session time constraints,
   so the exact trigger condition (double-move vs. any occupied-destination
   move) is not isolated — recorded for triage, not diagnosed further.
2. **Inline lighter-day offer not reachable via the "I'm not 100%" day-tap
   sheet** (Section B items 4/5). The reassessment doc's device-pass record
   describes the offer surfacing after acknowledgment; in this session the
   only reachable "I'm not 100%" entry point (Program day-tap sheet) never
   showed an offer step, on either a fresh tap or a repeat tap with the fact
   already active. Possibly a reachability/navigation gap rather than a logic
   regression (the underlying mechanism is unit-tested 12/12 per the memory
   record) — flagged for triage, not diagnosed further.
