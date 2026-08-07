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

## 3. WHAT IS *NOT* SLICE 1 — the rulings this unit still owes

The 13 rulings are a larger unit than the overnight slice. Recorded so none is
quietly lost:

| ruling | status against this plan |
|---|---|
| 1 — repeat-week FEATURE DIES | later slice; it is a DELETION, not a redesign |
| 2–5 — bottom button stack split/rename | later slice (the icon shortcut row) |
| 6, 10 — every button/row carries an icon | standing, applies to slice 1's own chrome |
| 7–9 — the intermediate menu dies; four-action menu | later slice |
| 11 — **injury "Other" data path INVESTIGATION** | **its own deliverable, not a UI slice** — Sam asked where a free-text injury answer GOES, and a stored answer that affects nothing is the worst class. Traced with receipts, reported. |
| 12 — inline exercise editing, "Edit exercises" modal retired | later slice |
| 13 — coach preset chips removed | **MOOT — already delivered.** R5.7 cut the coach entry surface entirely; there is no chip row left to remove. Recorded rather than re-done. |

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
- **Rulings 1–12 are scoped out of slice 1 by the order, not by judgement** —
  they remain owed.
- **L12 — what catches the NEXT defect of this class:** the class is **a
  surface that re-derives an identity the projection already carries** — (f) is
  a live instance and (e) was a near-miss of the same shape. The gate is an
  assertion that every consumer recovers a component id through ONE shared
  helper rather than parsing `part.id` itself, so that the day a part id's shape
  changes, one place fails loudly instead of three surfaces drifting. That
  helper lands with slice 1, before a second parse is written anywhere.
