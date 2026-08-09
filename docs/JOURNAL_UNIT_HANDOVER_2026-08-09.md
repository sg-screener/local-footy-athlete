# THE JOURNAL UNIT — CHECKPOINT + HANDOVER (2026-08-09)

Written under the standing authorisation's own instruction: *"checkpoint +
handover before context runs low, stop only at a genuine wall or the unit's
end."* This is that checkpoint. **It is not a wall** — three slices landed
continuously, every one gated, and the next slice's owners are measured with
receipts.

**HEAD: `65070c6a` on `main`.** Every slice below is committed and gated.

## WHAT LANDED THIS SESSION — three slices, no stop between them

| Slice | Commits | Gate | Sweep |
| --- | --- | --- | --- |
| **Load model** | `d0651fc3` `285c5a20` `61b7d74f` `d44476c9` `12da456f` | `GATE_EXIT=1` at the declared red | **2 of 160** = declared set |
| **Feel** (post-game rating + tap) | `41d847d7` `528e5c67` | `GATE_EXIT=1` at the declared red | **2 of 161** = declared set |
| **Strength line** | `64d142d7` | `GATE_EXIT=1` at the declared red | **2 of 162** = declared set |

Boundary reports: `JOURNAL_LOAD_SLICE_BOUNDARY_`, `JOURNAL_FEEL_SLICE_BOUNDARY_`,
`JOURNAL_STRENGTH_LINE_BOUNDARY_`, all dated 2026-08-09.

**ZERO NEW STORED STATE IN THE LOAD AND STRENGTH SLICES; two new INPUTS in the
feel slice** (`gameFeel`, `expectation`/`expectationReason`, both on the existing
`SessionFeedback` door). North star: **TOWARD** for all three.

## WHAT THE ATHLETE CAN SEE ON THE JOURNAL TAB NOW

1. The week-shape strip (slice 1).
2. Did the work happen (slice 1).
3. How the week felt — now also counting rated games and sessions that did not go
   as planned (feel slice).
4. **Your lifts — "Back Squat — 120kg, up on last week."** The first number the
   Journal ships (strength line).
5. Load — states its own evidence: "Load is measured from the sessions you log —
   3 of 5 this week have detail recorded." The headline continuum, band and
   region lines are **built, tested and DARK** pending Sam's constants.
6. Your note + tags (slice 2).

And in the post-session flow: a body-feel rating after a game, and the
"how did it compare with what was planned?" tap on every performed session.

## WHAT REMAINS IN THE UNIT

- **The rest of the Monday card** — week status, this week's job, what changed /
  what was protected. **Owners measured with receipts** in
  docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md §3b.
- **The local notification** — PARKED, Sam's call (see the wall below).
- **Niggle history + note resurfacing + progress markers.**
- **The monthly review, including the ruled charts** (layer 5 of the load model).

## THE ONE GENUINE WALL, AND IT IS SAM'S TO RULE

**There is no notification infrastructure at all.** `expo-notifications` is not a
dependency; the installed Expo packages are `expo`, `expo-av`, `expo-haptics`,
`expo-linear-gradient`, `expo-secure-store`, `expo-status-bar`.

Delivering the Monday card "via local notification" therefore needs a **new
native dependency** (a device rebuild before anything can be verified), a
**runtime permission prompt the athlete can refuse**, and a **scheduling policy**.
That is an outward-facing change to the athlete's build, not a screen — Sam's
call. **The card composes in full without it**, so this parks cleanly and is not
a reason to stop building.

## THE TRAP THE NEXT SLICE MUST REFUSE — named in advance

`useResolvedWeek` returns `{ weekDays, visibleWeek, weekLabel, … }` and **exposes
neither the week's contract nor the season phase**. Week status and "this week's
job" both derive from the contract.

**The next builder's first job is to find where the generation path ALREADY
resolves the contract for the visible week and read it from there.** Building a
second contract from the same inputs would be a second answer to "what does this
week ask of the athlete" — the defect class every slice in this unit has had to
refuse. Addresses: `rules/weeklyExposureContractBuilders.ts` (the per-phase
builders), `evaluateWeeklyExposureContract` (`weeklyExposureContract.ts:604`),
`ownSeasonPhase` (`rules/seasonPhaseOwner.ts:114`).

## FINDINGS THAT OUTLIVE THIS UNIT

1. **`an assumption is invisible to the suite its author wrote`** (load slice).
   Three defects were caught by reading the finished module back AFTER it had
   gone green — none of the 24 mutations could have surfaced any of them, because
   the fixtures were all built in the geometry where the assumption holds.
   **Proposed: make that read-back a named step of the boundary routine.**
2. **`a mutation that never applied reports as a survivor`** (strength line). A
   substitution silently matched nothing; the "survivor" pointed at the test
   instead of the tooling. **Proposed: assert the replacement is PRESENT in the
   file before reading any mutation result.**
3. **`a green gate watching nothing`, sighting 3** (feel slice). Both copy gates
   scope to `screens`/`components`/`navigation`, so a whole slice's words were
   invisible. Closed for `utils/sessionFeedbackForm.ts` via the existing
   `AUTHORING_MODULES` hatch. **SIZED AND FILED: ~150 label strings across 20+
   `utils/` and `rules/` modules are still invisible to both gates, including the
   feedback form's pre-existing vocabulary — none ever on the sheet. A unit of
   its own.**
4. **A builder tested with hand-written nulls proves the builder and says nothing
   about the caller that computes them** (feel slice — two mutations survived on
   exactly this).

## OWED, AND NOT FORGOTTEN

- `test:session-feedback-form` is **ungated and red at HEAD with 4 pre-existing
  failures** about a power component `getSessionComponents` no longer emits.
  Reported, not gated, not "fixed" by editing expectations.
- **A process slip, owned:** `git stash` was used once (forbidden in this shared
  worktree). Caught immediately, popped, every file verified restored and
  compiling; the scratchpad-copy method used thereafter.
- Resurfacing of old notes (owed since slice 2). LR-18 (`workoutLogStore`
  deletion). The four rival "is this a game" predicates.
- **NO DEVICE EVIDENCE for anything in this unit.** No cell mounts the Journal
  screen or the feedback panel; this repo has no render-level test.

## SAM'S QUEUE — nine parked questions, none blocking

**Signing batches (accumulated for one session, per the order):**
copy batches **15, 16, 17, 18, 19** — all PROPOSED, none signed. Plus the load
model's **signing batch of 7 constants of 9**
(`streamWeighting`, `sweetSpotBand`, `tonnageModulatedByEffort`,
`regionNormalWindowWeeks`, `regionSecondaryShare`, `patternDriftThreshold`,
`minimumWeekCoverage` — the last is mine and not in his ruling, flagged).

**Rulings:**
1. Should the 2/1/0 rung ever enter ratio space? It cannot today without storing
   a session's SHAPE as a fact.
2. The five body-feel words — Empty / Heavy / Okay / Good / Flying — are entirely
   mine and most want his eye.
3. Should the expectation tap be REQUIRED rather than optional?
4. Should a power block be separately completable? (blocks nothing; unblocks the
   red suite above)
5. Should "anchor lift" be a narrower authored set than "the main lifts the app
   records"?
6. Is `flat` right as exact equality on the strength line? A tolerance would
   become a constant in his batch.
7. The notification dependency + permission prompt.
