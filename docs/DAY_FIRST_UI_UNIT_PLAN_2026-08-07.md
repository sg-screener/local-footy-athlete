# DAY-FIRST UI — THE UNIT PLAN AND ITS MEASURED DEPENDENCY LIST (2026-08-07)

**First deliverable of the unit, per the V3 law: dependencies before build.**
Kicked off by Sam's overnight order. World: `main` at `8fa56778`.

Binding authoring sources, all three read:
- `docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md` — Sam's direction.
- `docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md` — **13 binding Sam rulings.**
  *(The order cited this at `artifacts/…`; it lives in `docs/`. Recorded so the
  next reader does not go looking in the wrong place.)*
- `artifacts/athlete-visible-copy-sheet.json` — the signed copy sheet.

---

## 1. THE VERDICT ON STOP CONDITIONS — **THREE QUARTERS CLEAN, AND ONE
## GENUINE STANDING CONDITION**

> **THIS SECTION'S FIRST VERDICT WAS "CLEAN" AND IT WAS WRONG.** It is corrected
> in place rather than quietly revised, because the way it was wrong is the
> finding. I confirmed that `componentCompletions` EXISTS as a field and
> inferred from that that a door existed to write it. **Existence of the state
> is not existence of the door.** Measuring the WRITE PATH refuted it.
> *(`pin-the-already-covered-claim` — the pin costs one grep, believing it costs
> a shipped defect.)*

| slice-1 element | verdict |
|---|---|
| today-first view + week strip (game-day anchored) | **CLEAN** — a new window onto `project()` |
| tappable component timeline → existing day-detail door | **CLEAN** — existing door, unchanged |
| no clock times | **CLEAN** — satisfied by construction (§2g) |
| **per-component check-off** | **STOP — genuine standing condition** |

### The stop, stated precisely

The order says check-off goes *"via the existing per-component completion"*.
**Measured, there is no such door.** `componentCompletions` exists only as a
field inside a whole-session outcome commit:

- The only writer is `commitSessionOutcomeTransaction`
  (`src/store/sessionOutcomeTransaction.ts:185`). It takes a full
  `RecordSessionOutcomeIntent` **including a session-level `completion` state**,
  and it emits a **session-outcome RECEIPT**.
- That receipt is not inert. It is what drives the **"Done" badge**, the
  completed-day display, and progression receipts
  (`HomeScreenV2.tsx:1484` — *"a persisted session-outcome receipt for this day
  means the athlete finished and saved feedback"*).
- **There is no draft-persistence path.** `feedbackDraft`
  (`SessionFeedbackPanel.tsx:279`) is component-local React state. Nothing
  persists a partially-ticked session.

So ticking one component of three on the timeline has exactly two
implementations, and **both trip a stop condition**:

1. **Commit through the existing door** → fabricates a session-outcome receipt
   for a session the athlete has not finished, turning on "Done", the
   completed-day display and progression. That is a **signed-behaviour change**,
   and it corrupts the very completed-day boundary that is already one of Sam's
   standing device flags.
2. **Persist an incremental tick** → **NEW STORED STATE**, and of the worst
   shape: partial progress toward a result, which is derived-output-shaped and
   which the north star presumes wrong without an explicit Sam-approved
   exception and a retirement plan.

**Neither is mine to choose**, and the escalation rule is explicit that the
answer is not to invent a door. **The check-off half of slice 1 does not
proceed.** The render half is clean and is what gets built.

### The fork, for Sam and the seat

- **(A)** Check-off is **display-only** in slice 1 — the timeline shows which
  components a SAVED outcome recorded as done, and ticking navigates into the
  existing feedback panel. Zero new state, zero behaviour change, ships tonight.
  *Recommended* — it is the honest vertical slice.
- **(B)** A real incremental per-component ledger is authored as its own unit,
  as a **decision/result input** with its own door — the north-star-shaped
  answer, and a genuinely bigger piece of work.
- **(C)** Extend `commitSessionOutcomeTransaction` with a partial state that
  does NOT mint a completion receipt — smaller than (B), but it changes a
  transaction that eight surfaces read, so it is not a slice-1-sized edit.

---

## 2. THE MEASURED DEPENDENCY LIST

### (a) The projection — PRESENT, and already the single narrator
`useResolvedWeek()` → `projectWeekFor()` → `project({week, weekStart})`
(`src/hooks/useSchedule.ts:311`). The card path and the day-detail path already
call `projectWeekFor` rather than `project` directly, precisely so two surfaces
cannot be handed different arguments. **The today-first view becomes a third
consumer of the same hook and inherits that guarantee for free.**

### (b) The shell switch — PRESENT, and the shape already exists
`HomeScreen.tsx:52` is a hardcoded `const DESIGN_VERSION: DesignVersion = 'v2'`
delegating to `HomeScreenV2`. **A third value is the switch this unit needs**;
no navigation change, no flag plumbing, no new route.

### (c) The week strip's game-day anchor — FREE
`VisibleDay.kind === 'game'` is already computed by `dayKind()`, from the typed
`FIXTURE_WORKOUT_TYPES` set rather than a title regex. The strip needs no new
derivation to anchor on the game.

### (d) The component timeline — PRESENT, **but the direction doc names the
### wrong half, and this is a measured correction**

The direction doc says the timeline "maps 1:1 onto `ProjectedDayParts`". It does
map 1:1 — **but `ProjectedDayParts` deliberately carries NO words.** Its own
header says so: `parts` is `Omit<VisiblePart, 'headline' | 'detail' | 'rows'>`,
because rows carry `SignedCopy` and composing them in the structural half made a
copy gap disarm the structural laws.

**So a timeline built on `projectParts` would render with no names.** The
surface must consume `project()`'s `VisibleDay.parts` (`VisiblePart`), which
carries `id`, `kind`, `headline: SignedCopy`, `detail`, `rows`, `capabilities`,
`countsTowardLoad` — exactly a tappable timeline. Same derivation, words applied.

### (e) Per-component check-off — PRESENT, and the round trip closes cleanly

`componentCompletions: Record<string, FeedbackCompletion | null>`
(`sessionFeedbackForm.ts:74`), keyed by `SessionComponent.id`. Parts carry
`id: \`${date}:${componentId}\`` (`projectVisibleWeek.ts:527`), so the component
id is recoverable and the round trip closes.

> **A HAZARD I DRAFTED HERE IS REFUTED BY MEASUREMENT, AND THE REFUTATION IS
> WORTH MORE THAN THE HAZARD WAS.**
>
> This section first claimed that `part.id.split(':')[1]` was unsafe, because
> `sessionComponents.ts:247` builds an id of the form
> `` `${sourceIdentity}:${movedKind}-component` `` — which contains a colon.
>
> **That id is a WORKOUT id (`movedWorkout.id` / `planEntryId`), not a
> `SessionComponent.id`, and it never becomes one.** `SessionComponent.id` is
> typed `SessionComponentKind`, a **closed union of ten colon-free literals**
> (`power` `strength` `support` `conditioning` `team_training` `speed`
> `finisher` `recovery_addon` `recovery` `session`), and every id
> `getSessionComponents` emits is one of those literals verbatim
> (`sessionComponents.ts:692-789`). There is no route by which a colon reaches a
> component id, so `part.id` has exactly one colon and the naive split is safe.
>
> Recorded rather than quietly deleted, because **a plausible hazard reasoned
> from two real code sites is exactly the kind of claim that gets built against.**
> The premise was checked before it was shipped; had it not been, this plan
> would have ordered a defensive parse against a defect that cannot occur.
> *(`a-ruling-premise-is-a-claim-too`, and it fired on my own draft.)*
>
> `slice(date.length + 1)` remains marginally more robust and costs nothing —
> but it is now a preference, **not a defect being avoided**, and the plan says
> so rather than dressing taste as necessity.

### (f) A second identity hazard — group by `id`, never by `kind`
`COMPONENT_TO_PART` is **many-to-one**: `finisher` and `conditioning` both
become part kind `conditioning`; `session` and `strength` both become
`strength`; `recovery` and `recovery_addon` both become `recovery`. A day
carrying both a conditioning component and a finisher yields **two parts of the
same `kind` with different ids.** Any timeline keyed on `kind` collides and
loses a row. Key on `id`.

> **THE PAIR THIS SECTION NAMED IS REFUTED, AND THE RULING IT SUPPORTS SURVIVES
> UNCHANGED — corrected in place at build time (2026-08-08, slice 1).**
>
> This section said the collision was *a day carrying both a conditioning
> component and a finisher*. **Measured at the emitter, that day cannot exist.**
> `getSessionComponents` (`sessionComponents.ts`, the conditioning block) pushes
> **one** of them from a single `if`, choosing on
> `attachedConditioningKind === 'finisher'` — so conditioning and finisher are
> mutually exclusive by construction. `session` and `strength` are the same
> story: `session` is emitted only when `components.length === 0`.
>
> **The reachable pair is `recovery` + `recovery_addon`.** `recovery` is emitted
> for a recovery workout with no other components, and `recovery_addon` is
> appended AFTER that check — so a recovery day with a populated add-on carries
> both, and both project as part kind `recovery`. `dayFirstTimelineTests` builds
> exactly that day and holds the keying against it (mutation-proven: keying the
> timeline by kind reds that cell).
>
> The plan's own NOT-COVERED demanded this: *"(f) ... has NOT been reproduced by
> a failing case — a day carrying both a conditioning and a finisher component
> should be built and observed before the timeline's keying is trusted."*
> Building it is what refuted it. **Key on `id`** was right for a reason that was
> wrong, and is now right for a measured one.
> *(`a-ruling-premise-is-a-claim-too`, second firing inside this one plan.)*
>
> **A CONSEQUENCE WORTH REPORTING RATHER THAN FIXING HERE:** those two `recovery`
> parts render with the SAME headline and the SAME rows, because `partHeadline`
> and `rowsForKind` both key on `kind`. Keying the timeline on `id` keeps both
> rows — no work vanishes — but the athlete would see two identical-looking
> lines. The projection carries nothing that tells them apart, so this is not the
> day-first surface's to answer: a surface that invented a distinguishing word
> would be composing. **Named for Sam, not patched.**

### (g) No clock times — nothing to suppress
Measured: the projection carries no time-of-day anywhere. Sam's "NO clock times"
is satisfied by construction, not by a rule the surface has to remember.

### (h) Copy — the projection already refuses to invent words
`project()` raises `UnsignedCopyError` for any day or part whose words are not
signed. Part headlines are therefore already signed by the time the timeline
sees them. **Only the new chrome is new copy** — the "today" framing, the icon
row labels — and it ships **PROPOSED**, equality-bound, into Sam's next signing
batch.

### (i) Icons — terminal-proposed by standing ruling
Rulings 6 and 10: every button and every option row carries a meaningful icon;
**icons are imagery, not copy, so they need no per-icon signing**, but nonsense
pairings are defects Sam calls at the device pass. Existing assets are used and
flagged for his pick session.

---

## 3. THE 13 RULINGS — WHERE EACH ONE ACTUALLY IS

**CORRECTED 2026-08-08, AND THE CORRECTION IS THE POINT.** This table used to
say "later slice" against nine of the thirteen. It was written from the plan's
own intentions and never checked against the code, and by 2026-08-08 it was
describing work that had **already shipped** — the seat ordered a whole close-out
unit off it before Sam caught that the screen was finished.

The law that follows, and it now binds this file: **a status claim about built
work carries a code receipt — `file:line`, a commit, or a doc — AT THE CLAIM, or
it says OPEN-UNKNOWN.** "Later slice" is not a status; it is a plan, and a plan
goes stale silently. Every row below was re-measured in the source on
2026-08-08.

| ruling | status | receipt |
|---|---|---|
| 1 — repeat-week FEATURE DIES | **BUILT** — writer retired, not relocated | `section18SafetyBoundaryTests.ts:412` ("the athlete-facing repeat-week writer is gone"); only survivor is the hydration lift that REFUSES the retired shape, `programHydrationIngress.ts:362` |
| 2 — Busy/Away split in two | **BUILT** | `HomeScreenV2.tsx:688` "Short on time today" · `:705` "Away this week?" — two doors, two chips |
| 3 — new "I'm injured" button | **BUILT** | `HomeScreenV2.tsx:750` |
| 4 — "I'm not 100%" → "I'm sick/flat today" | **BUILT** | `HomeScreenV2.tsx:733`, and the sheet at `:2586` |
| 5 — equipment + practice-match unchanged | **BUILT (unchanged, verified)** | `HomeScreenV2.tsx:771` "Missing equipment?" · `:174` "Practice match: …" |
| 6 — every button carries an icon | **BUILT** | all five chips carry an 18pt `Svg`, e.g. `HomeScreenV2.tsx:690` (stopwatch, Sam's 2026-08-03 icon ruling row 1) |
| 7, 8 — intermediate menu dies; four-action menu | **BUILT** | `PlanChangeSheet.tsx:69` — "THE INTERMEDIATE MENU IS GONE (ruling 7/8)" |
| 9 — cross-referenced sub-copy | **BUILT** | `planChangeProducer.ts:489-496` (state-selected Remove sub) and `CATEGORY_COPY` at `:191` |
| 10 — icons on every option-sheet row | **BUILT** | `EquipmentLimitationSheet.tsx` (9 icon sites), `GuidedInjuryFlowSheet.tsx` (12), readiness sheet region `HomeScreenV2.tsx:2586+` (8) |
| 11 — injury "Other" data path INVESTIGATION | **DELIVERED** | docs/INJURY_OTHER_PATH_TRACE_2026-07-30.md (traced with receipts, 2026-07-30) |
| 12 — "Edit exercises" modal retired, editing inline | **BUILT** | `DayWorkoutScreenV2.tsx:542` — "TASK 8 (ruling 12): the 'Edit exercises' link and its modal MENU are retired" |
| 13 — coach preset chips removed | **MOOT — delivered by R5.7** | the coach entry surface was cut entirely (`1c41e6d2`); no chip row is left to remove. Grep for the seven chips in `CoachScreen.tsx` returns nothing. |

**NOTHING IN THIS TABLE IS OPEN-UNKNOWN.** All thirteen are built, delivered or
moot, each on a receipt above. What the day-first unit adds is a new WINDOW onto
that finished screen, not the screen's remaining rulings.

---

## 4. SLICE 1, AS IT WILL BE BUILT (L16 — one complete loop)

The today-first Program view:
1. Week strip across the top, days + dates, **game-day anchored**, today leading.
2. The selected day's session as a **tappable component timeline** off
   `VisibleDay.parts`, keyed on `part.id`.
3. **Completion shown, not written** — pending the fork in §1. The timeline
   reads what a saved outcome recorded and routes a tap into the existing
   feedback panel. **No new state, no new door.**
4. No clock times. Existing doors behind every tap.

Landing with it, per §NOT-COVERED's L12 note: **`componentIdFromPartId`, one
owner for both halves of the part id**, placed in `projectVisibleWeek.ts` beside
where those ids are constructed — so a second parse is never written elsewhere.
(Drafted and held out of this commit rather than landed unused; it lands with
the surface that needs it.)

Gate per commit: full `test:bible` UNPIPED. Walker surface laws apply as to any
surface.

---

## NOT COVERED — honestly

- **Nothing is built yet.** This document is the whole of the first deliverable.
- **The dependency list is measured on SOURCE and TYPES, not on a running
  surface** — unlike the LR-29 list, no tape was run here, because the surface
  it would tape does not exist yet. Items (d), (e) and (f) are read from the
  types and the code. **(e) was a claimed hazard that measurement REFUTED**;
  **(f) is a live one and has NOT been reproduced by a failing case** — it is
  reasoned from the `COMPONENT_TO_PART` table, and a day carrying both a
  conditioning and a finisher component should be built and observed before the
  timeline's keying is trusted.
- **No device evidence.** None is possible until slice 1 renders.
- **The icon assets are not inventoried.** "Use existing assets" is the order's
  word; which assets exist for which row is not measured here.
- **~~Rulings 1–12 are scoped out of slice 1 by the order, not by judgement —
  they remain owed.~~ FALSE, AND CORRECTED 2026-08-08.** They were not owed; they
  were built, most of them before this plan was written. See §3, which now
  carries a receipt per ruling. The claim survived here for a day because it was
  read off this document's own status table instead of the code — the
  `a-doc-taken-for-the-record` sighting that cost a retracted unit.
- **L12 — what catches the NEXT defect of this class:** the class is **a
  surface that re-derives an identity the projection already carries** — (f) is
  a live instance and (e) was a near-miss of the same shape. The gate is an
  assertion that every consumer recovers a component id through ONE shared
  helper rather than parsing `part.id` itself, so that the day a part id's shape
  changes, one place fails loudly instead of three surfaces drifting. That
  helper lands with slice 1, before a second parse is written anywhere.
