# Fix Groups C & D Worklist

Derived from the 2026-07-21 area audits: `docs/audits/PROGRAM_2026-07-21.md`,
`docs/audits/WORKOUT_2026-07-21.md`, `docs/audits/HOMEV2_2026-07-21.md`,
`docs/audits/PROFILE_2026-07-21.md`. Deduplicated checklist for:

- **Group C** — accessibility / internal-id labels
- **Group D** — dead buttons, raw ISO dates, raw internal error codes,
  missing swap-to-Rest control

**Group A** (rules-engine / §18 ownership — preview-gate refusals, silent
load recalculation, Bin's undisclosed re-injection/emptying) is tracked
separately in `docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`. **Group
B** (visible-plan persistence/mismatch — feedback and readiness signals not
visibly persisting, stale phase-status card) is deliberately **not** in this
worklist — it shrinks once the ownership migration lands; re-scope it after
that instead of fixing it piecemeal now.

---

## Group C — Accessibility / internal-id labels

Symptom: the accessible label exposed is an internal component/test id
(e.g. `readiness-option-tired-today`) instead of the visible text, or the
accessibility tree is empty entirely.

- [ ] **Program → FRI "Gunshow" (OPTIONAL) session → "Want to change
  something?" sheet** — accessibility tree comes back completely empty at
  every level (top menu, Swap-To submenu), the only day of six tested with
  this gap. Controls are still tappable by raw screen coordinate, so this
  is a tree gap, not a dead button.
  Source: `docs/audits/PROGRAM_2026-07-21.md`, FRI sheet row.

- [ ] **Workout → Edit exercises → Remove flow → "Apply this change to
  future weeks?" scope buttons** — no accessible text label at all, unlike
  the identical-looking scope step in the Swap and Add flows on the same
  screen, which are correctly labeled ("Today only" / "Future weeks too").
  Source: `docs/audits/WORKOUT_2026-07-21.md`, Remove-exercise row.

- [ ] **Home V2 → "I'm not 100%" entry button** — accessible label is the
  internal id string (`readiness-set-action-readiness-2026-07-13`), not
  readable text. "Missing equipment?" carries the same defect
  (`equipment-preset-open`) — unlike "Busy or away this week?" on the same
  screen, which is correctly labeled.
  Source: `docs/audits/HOMEV2_2026-07-21.md`, "I'm not 100%" button row.

- [ ] **Home V2 → "I'm not 100%" → readiness sheet (all 8 options)** —
  sheet-wide instance of the same defect: every option
  (`readiness-option-tired-today`, `readiness-option-sick-week`,
  `injury-set-action-new`, etc.) exposes its internal id as the accessible
  label instead of its visible text. Broader than the single-button gap
  above — this covers the whole sheet, not one control.
  Source: `docs/audits/HOMEV2_2026-07-21.md` row 3.1.

## Group D — Dead buttons, raw dates/codes, missing controls

### Dead buttons (no response to tap at all)

- [ ] **Profile → Support → "Leave Feedback"** — chevron implies
  navigation; tapped twice, no sheet/screen/toast/error of any kind.
  Source: `docs/audits/PROFILE_2026-07-21.md`, Support section row.

- [ ] **Profile → Support → "Ask a Human"** — same defect, tapped once, no
  response.
  Source: `docs/audits/PROFILE_2026-07-21.md`, Support section row.

### Raw ISO dates in user-facing copy

- [ ] **Program → Move session (MON → WED, occupied/atomic swap)** —
  confirmation message reads "Done. 2026-07-13 and 2026-07-15 swapped
  sessions." — raw ISO dates instead of day names/labels (e.g. "Monday and
  Wednesday").
  Source: `docs/audits/PROGRAM_2026-07-21.md` row 1.5.

### Raw internal error codes in user-facing copy

- [ ] **Program → Swap/Add refusals (rows 1.1, 1.2, 1.3, 1.7×2)** —
  user-facing message reads "That change isn't possible here
  (section18_week_rejected)." — the internal error code renders verbatim
  in copy the athlete reads. This is a presentation defect distinct from
  *why* the refusal happens (that's Group A); no internal code should ever
  render in user-facing text regardless of cause. Fix the display rule on
  its own merits, and re-check whether the underlying refusal still fires
  once Group A lands.
  Source: `docs/audits/PROGRAM_2026-07-21.md` rows 1.1, 1.2, 1.3, 1.7×2.

### Missing swap-to-Rest control

- [ ] **Program → Swap session → Rest day (contract item 1.4)** — no
  "Rest" option exists in the Swap-To list on any day tested (only
  Conditioning/Strength/Recovery offered). The only path to a Rest outcome
  today is Bin, which carries different UX (scope choice + destructive
  confirm) than the dedicated "confirm step, then rest" the contract
  describes for 1.4.
  Source: `docs/audits/PROGRAM_2026-07-21.md` row 1.4.

---

## Explicitly excluded from this worklist

- **Group B, not re-listed here:** session feedback / readiness signals not
  visibly persisting after submit (`WORKOUT_2026-07-21.md` row 2.1,
  `HOMEV2_2026-07-21.md` "tired" row 3.1's persistence half); season-phase
  status card staying stale after a completed phase-shift mutation
  (`HOMEV2_2026-07-21.md` row 5.1).
- **Group A, not re-listed here:** §18 preview-gate refusals themselves,
  silent load recalculation (Deadlift 137.5kg→140kg drift), Bin's
  undisclosed re-injection/emptying, and row 1.8's missing override choice
  — all tracked in `docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`.
- **Neither C nor D, left for whoever owns Coach-door scope:** Home V2's
  "Busy or away this week?" routing into Coach chat instead of a native
  sheet (`HOMEV2_2026-07-21.md` row 5.3) — recorded as BLOCKED per the
  CLAUDE.md Coach Architecture Escalation Rule, not an accessibility or
  dead-control defect.
- **Already pre-logged, not re-reported:** equipment preset not consumed by
  generation (`HOMEV2_2026-07-21.md`) — matches `FLOW_AUDIT_2026-07-07.md`.
